import { describe, it, expect, vi, beforeEach } from "vitest"
import crypto from "node:crypto"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// The global setup mocks next/server to a near-empty stub. Restore NextRequest
// (and friends) by re-mocking with the actual module before each test.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")
  return { ...actual }
})

let mockDb: MockDb

const PLAINTEXT_TOKEN = "deadbeef"
const VALID_PIN = "123456"
const VALID_PIN_HASH = crypto.createHash("sha256").update(VALID_PIN).digest("hex")

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/auth-rate-limit", () => ({
    checkDevicePairClaimLimit: () => Promise.resolve({ success: true }),
  }))
  vi.doMock("@/lib/api-cors", () => ({
    withCorsHeaders: (r: Response) => r,
    handlePreflight: () => new Response(null, { status: 204 }),
  }))
})

async function makeRequest(body: object) {
  const { NextRequest } = await import("next/server")
  return new NextRequest("http://localhost/api/v1/auth/device-pair/claim", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "vitest" },
    body: JSON.stringify(body),
  })
}

describe("device-pair claim — atomic claim", () => {
  it("returns 410 when the atomic update finds zero rows (already claimed by a concurrent request)", async () => {
    mockDb.devicePairingToken.findUnique.mockResolvedValue({
      id: "tok-1",
      organizationId: "org-1",
      createdByUserId: "u-1",
      pinHash: VALID_PIN_HASH,
      failedAttempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      claimedAt: null, // findUnique still sees null...
    })
    // ...but the atomic updateMany loses the race — another request just claimed it.
    mockDb.devicePairingToken.updateMany.mockResolvedValue({ count: 0 })

    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: PLAINTEXT_TOKEN, pin: VALID_PIN }))

    expect(res.status).toBe(410)
    expect(mockDb.session.create).not.toHaveBeenCalled()
  })

  it("creates a session only when updateMany confirms it won the race", async () => {
    mockDb.devicePairingToken.findUnique.mockResolvedValue({
      id: "tok-1",
      organizationId: "org-1",
      createdByUserId: "u-1",
      pinHash: VALID_PIN_HASH,
      failedAttempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      claimedAt: null,
    })
    mockDb.devicePairingToken.updateMany.mockResolvedValue({ count: 1 })
    mockDb.session.create.mockResolvedValue({ id: "s-1" })
    mockDb.user.findUnique.mockResolvedValue({ id: "u-1", name: "Alice", email: "a@b.com", image: null })
    mockDb.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Org" })
    mockDb.member.findFirst.mockResolvedValue({ role: "owner" })

    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: PLAINTEXT_TOKEN, pin: VALID_PIN }))

    expect(res.status).toBe(200)
    expect(mockDb.session.create).toHaveBeenCalledTimes(1)
    // Verify the update used both guards so concurrent claims serialize and a
    // parallel wrong-PIN can't race past the lockout cap.
    const call = mockDb.devicePairingToken.updateMany.mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({
      id: "tok-1",
      claimedAt: null,
      failedAttempts: { lt: 5 },
    })
  })

  it("returns 410 when the upfront findUnique already shows claimedAt", async () => {
    mockDb.devicePairingToken.findUnique.mockResolvedValue({
      id: "tok-1",
      organizationId: "org-1",
      createdByUserId: "u-1",
      pinHash: VALID_PIN_HASH,
      failedAttempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      claimedAt: new Date(),
    })

    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: PLAINTEXT_TOKEN, pin: VALID_PIN }))

    expect(res.status).toBe(410)
    expect(mockDb.devicePairingToken.updateMany).not.toHaveBeenCalled()
    expect(mockDb.session.create).not.toHaveBeenCalled()
  })
})

describe("device-pair claim — PIN second factor", () => {
  it("returns 400 when the body is missing the pin", async () => {
    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: PLAINTEXT_TOKEN }))
    expect(res.status).toBe(400)
    expect(mockDb.devicePairingToken.findUnique).not.toHaveBeenCalled()
  })

  it("returns 400 when the pin is not exactly 6 digits", async () => {
    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: PLAINTEXT_TOKEN, pin: "12345" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    // RFC 7807 envelope — `detail` is the human-readable message.
    expect(body.detail).toMatch(/6 digits/i)
    expect(body).toMatchObject({ type: "about:blank", status: 400, title: "Bad Request" })
  })

  it("rejects a wrong PIN, increments failedAttempts, and returns remainingAttempts", async () => {
    mockDb.devicePairingToken.findUnique.mockResolvedValue({
      id: "tok-1",
      organizationId: "org-1",
      createdByUserId: "u-1",
      pinHash: VALID_PIN_HASH,
      failedAttempts: 1,
      expiresAt: new Date(Date.now() + 60_000),
      claimedAt: null,
    })
    mockDb.devicePairingToken.update.mockResolvedValue({ failedAttempts: 2 })

    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: PLAINTEXT_TOKEN, pin: "999999" }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toMatchObject({
      type: "about:blank",
      status: 401,
      title: "Unauthorized",
      detail: expect.any(String),
      remainingAttempts: 3,
    })
    expect(mockDb.devicePairingToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tok-1" },
        data: { failedAttempts: { increment: 1 } },
      }),
    )
    expect(mockDb.session.create).not.toHaveBeenCalled()
  })

  it("returns 410 once failedAttempts has hit the cap (no further session creates)", async () => {
    mockDb.devicePairingToken.findUnique.mockResolvedValue({
      id: "tok-1",
      organizationId: "org-1",
      createdByUserId: "u-1",
      pinHash: VALID_PIN_HASH,
      failedAttempts: 5, // already capped
      expiresAt: new Date(Date.now() + 60_000),
      claimedAt: null,
    })

    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: PLAINTEXT_TOKEN, pin: VALID_PIN }))

    expect(res.status).toBe(410)
    expect(mockDb.devicePairingToken.updateMany).not.toHaveBeenCalled()
    expect(mockDb.session.create).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// The global setup mocks next/server to a near-empty stub. Restore NextRequest
// (and friends) by re-mocking with the actual module before each test.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")
  return { ...actual }
})

let mockDb: MockDb

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/rate-limit", () => ({
    publicFormLimiter: { check: () => ({ success: true, remaining: 9 }) },
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
      expiresAt: new Date(Date.now() + 60_000),
      claimedAt: null, // findUnique still sees null...
    })
    // ...but the atomic updateMany loses the race — another request just claimed it.
    mockDb.devicePairingToken.updateMany.mockResolvedValue({ count: 0 })

    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: "abc" }))

    expect(res.status).toBe(410)
    expect(mockDb.session.create).not.toHaveBeenCalled()
  })

  it("creates a session only when updateMany confirms it won the race", async () => {
    mockDb.devicePairingToken.findUnique.mockResolvedValue({
      id: "tok-1",
      organizationId: "org-1",
      createdByUserId: "u-1",
      expiresAt: new Date(Date.now() + 60_000),
      claimedAt: null,
    })
    mockDb.devicePairingToken.updateMany.mockResolvedValue({ count: 1 })
    mockDb.session.create.mockResolvedValue({ id: "s-1" })
    mockDb.user.findUnique.mockResolvedValue({ id: "u-1", name: "Alice", email: "a@b.com", image: null })
    mockDb.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Org" })
    mockDb.member.findFirst.mockResolvedValue({ role: "owner" })

    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: "abc" }))

    expect(res.status).toBe(200)
    expect(mockDb.session.create).toHaveBeenCalledTimes(1)
    // Verify the update used the claimedAt: null guard so concurrent claims serialize.
    const call = mockDb.devicePairingToken.updateMany.mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({ id: "tok-1", claimedAt: null })
  })

  it("returns 410 when the upfront findUnique already shows claimedAt", async () => {
    mockDb.devicePairingToken.findUnique.mockResolvedValue({
      id: "tok-1",
      organizationId: "org-1",
      createdByUserId: "u-1",
      expiresAt: new Date(Date.now() + 60_000),
      claimedAt: new Date(),
    })

    const { POST } = await import("./route")
    const res = await POST(await makeRequest({ token: "abc" }))

    expect(res.status).toBe(410)
    expect(mockDb.devicePairingToken.updateMany).not.toHaveBeenCalled()
    expect(mockDb.session.create).not.toHaveBeenCalled()
  })
})

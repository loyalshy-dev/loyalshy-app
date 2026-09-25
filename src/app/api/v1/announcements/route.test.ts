import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")
  return { ...actual, after: vi.fn() }
})

let mockDb: MockDb
const mockSend = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/announcements", () => ({ sendAnnouncement: mockSend, ANNOUNCEMENT_MAX_LENGTH: 160 }))
  mockSend.mockReset()
  mockDb.session.findUnique.mockResolvedValue({
    expiresAt: new Date(Date.now() + 60_000),
    activeOrganizationId: "org-1",
    user: { id: "user-1" },
  })
  mockDb.member.findFirst.mockResolvedValue({ role: "admin" })
  mockDb.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Café", plan: "GROWTH", subscriptionStatus: "ACTIVE" })
})

async function send(body: Record<string, unknown>) {
  const { POST } = await import("./route")
  const { NextRequest } = await import("next/server")
  const res = await POST(
    new NextRequest("https://loyalshy.com/api/v1/announcements", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
  return { status: res.status, body: await res.json() }
}

describe("POST /api/v1/announcements", () => {
  it("is limited to owners and program managers", async () => {
    mockDb.member.findFirst.mockResolvedValue({ role: "member" })
    const { status } = await send({ templateId: "pt-1", message: "2x1 today" })
    expect(status).toBe(403)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("returns recipients and remaining quota", async () => {
    mockSend.mockResolvedValue({ ok: true, templateId: "pt-1", recipients: 42, remaining: 1 })
    const { status, body } = await send({ templateId: "pt-1", message: "2x1 today" })
    expect(status).toBe(200)
    expect(body.data).toEqual({ recipients: 42, remaining: 1 })
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ sentById: "user-1", message: "2x1 today" }))
  })

  it("surfaces quota errors as a 409 with a code", async () => {
    mockSend.mockResolvedValue({ ok: false, code: "quotaReached", nextAvailableAt: "2026-10-01T00:00:00.000Z" })
    const { status, body } = await send({ templateId: "pt-1", message: "2x1 today" })
    expect(status).toBe(409)
    expect(body).toMatchObject({ code: "quotaReached", nextAvailableAt: "2026-10-01T00:00:00.000Z" })
  })

  it("rejects messages over 160 characters", async () => {
    const { status } = await send({ templateId: "pt-1", message: "x".repeat(161) })
    expect(status).toBe(400)
  })
})

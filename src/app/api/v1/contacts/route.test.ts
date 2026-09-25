import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")
  return { ...actual, after: vi.fn() }
})

let mockDb: MockDb
const mockCreatePass = vi.fn()
const mockFindOrCreate = vi.fn()
const mockSendEmail = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/issue-pass", () => ({
    createPassInstanceForContact: mockCreatePass,
    findOrCreateContact: mockFindOrCreate,
    sendPassIssuedEmail: mockSendEmail,
  }))
  mockCreatePass.mockReset()
  mockFindOrCreate.mockReset()
  mockSendEmail.mockReset()

  mockDb.session.findUnique.mockResolvedValue({
    expiresAt: new Date(Date.now() + 60_000),
    activeOrganizationId: "org-1",
    user: { id: "user-1" },
  })
  mockDb.member.findFirst.mockResolvedValue({ role: "member" })
  mockDb.organization.findUnique.mockResolvedValue({
    id: "org-1", name: "Café", slug: "cafe", plan: "FREE", subscriptionStatus: "ACTIVE",
  })
  mockDb.passTemplate.findFirst.mockResolvedValue({ id: "pt-1", name: "Coffee", passType: "STAMP_CARD", config: {} })
  mockDb.contact.findFirst.mockResolvedValue(null)
  mockDb.contact.count.mockResolvedValue(3)
  mockFindOrCreate.mockResolvedValue({
    contact: { id: "c-1", fullName: "Ana", email: "ana@example.com", memberNumber: 4 },
    created: true,
  })
})

async function signup(body: Record<string, unknown>) {
  const { POST } = await import("./route")
  const { NextRequest } = await import("next/server")
  const req = new NextRequest("https://loyalshy.com/api/v1/contacts", {
    method: "POST",
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const res = await POST(req)
  return { status: res.status, body: await res.json() }
}

describe("POST /api/v1/contacts (counter signup)", () => {
  it("creates the contact, issues the pass and queues the email", async () => {
    mockCreatePass.mockResolvedValue({ status: "created", id: "pi-9" })
    const { status, body } = await signup({ templateId: "pt-1", fullName: "Ana", email: "ana@example.com" })
    expect(status).toBe(200)
    expect(body.data).toMatchObject({ contactId: "c-1", passInstanceId: "pi-9", emailQueued: true, memberNumber: 4 })
  })

  it("refuses a new contact beyond the plan limit", async () => {
    mockDb.contact.count.mockResolvedValue(50) // FREE = 50
    const { status, body } = await signup({ templateId: "pt-1", fullName: "Ana" })
    expect(status).toBe(409)
    expect(body.code).toBe("contactLimit")
    expect(mockFindOrCreate).not.toHaveBeenCalled()
  })

  it("points at the existing pass when the customer already has one", async () => {
    mockCreatePass.mockResolvedValue({ status: "already_exists" })
    mockDb.passInstance.findFirst.mockResolvedValue({ id: "pi-old" })
    const { status, body } = await signup({ templateId: "pt-1", fullName: "Ana", email: "ana@example.com" })
    expect(status).toBe(409)
    expect(body).toMatchObject({ code: "alreadyHasPass", passInstanceId: "pi-old" })
  })

  it("validates the name", async () => {
    const { status } = await signup({ templateId: "pt-1", fullName: "" })
    expect(status).toBe(400)
  })
})

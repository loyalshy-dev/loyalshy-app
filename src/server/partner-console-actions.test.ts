import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb
const mockAssertAuthenticated = vi.fn()

const SESSION = {
  user: { id: "user-rep", email: "rep@agency.test", name: "Agency Rep" },
  session: { id: "session-1", userId: "user-rep", expiresAt: new Date(), activeOrganizationId: null },
}

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/dal", () => ({ assertAuthenticated: mockAssertAuthenticated }))
  mockAssertAuthenticated.mockReset()
  mockAssertAuthenticated.mockResolvedValue(SESSION)
})

describe("getMyPartnerClients", () => {
  it("rejects non-partner users", async () => {
    mockDb.user.findUnique.mockResolvedValue({ isPartner: false })

    const { getMyPartnerClients } = await import("./partner-console-actions")
    const result = await getMyPartnerClients()

    expect(result).toEqual({ error: "not_a_partner" })
  })

  it("maps checklist, handoff, and membership state per client", async () => {
    mockDb.user.findUnique.mockResolvedValue({ isPartner: true })
    mockDb.organization.findMany.mockResolvedValue([
      {
        id: "org-done",
        name: "Cafe Done",
        logo: null,
        logoGoogle: "logo.png",
        plan: "STARTER",
        subscriptionStatus: "ACTIVE",
        createdAt: new Date("2026-07-01T00:00:00Z"),
        _count: { passTemplates: 1, contacts: 5 },
        // rep (partner, demoted... here still owner-listed) + real owner
        members: [
          { userId: "user-owner", user: { isPartner: false } },
        ],
        handoffTokens: [],
      },
      {
        id: "org-wip",
        name: "Cafe WIP",
        logo: null,
        logoGoogle: null,
        plan: "FREE",
        subscriptionStatus: "ACTIVE",
        createdAt: new Date("2026-08-10T00:00:00Z"),
        _count: { passTemplates: 0, contacts: 0 },
        // only the rep holds an owner seat → not yet claimed
        members: [{ userId: "user-rep", user: { isPartner: true } }],
        handoffTokens: [{ id: "handoff-1" }],
      },
    ])
    // Rep is a member of org-wip only (removed from org-done after setup)
    mockDb.member.findMany.mockResolvedValue([{ organizationId: "org-wip" }])

    const { getMyPartnerClients } = await import("./partner-console-actions")
    const result = await getMyPartnerClients()

    expect(Array.isArray(result)).toBe(true)
    const clients = result as Exclude<typeof result, { error: string }>

    const done = clients.find((c) => c.organizationId === "org-done")!
    expect(done.checklist).toEqual({
      programPublished: true,
      contactsJoined: true,
      ownerClaimed: true,
    })
    expect(done.handoffPending).toBe(false)
    expect(done.isMember).toBe(false)
    expect(done.logo).toBe("logo.png")

    const wip = clients.find((c) => c.organizationId === "org-wip")!
    expect(wip.checklist).toEqual({
      programPublished: false,
      contactsJoined: false,
      ownerClaimed: false, // partner-held owner seat doesn't count
    })
    expect(wip.handoffPending).toBe(true)
    expect(wip.isMember).toBe(true)
  })
})

describe("requestClientAccess", () => {
  const mockSend = vi.fn().mockResolvedValue({})

  function mockResend() {
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: mockSend }
      },
    }))
    vi.doMock("@/lib/rate-limit", () => ({
      publicFormLimiter: { check: vi.fn().mockReturnValue({ success: true }) },
    }))
    vi.doMock("@/lib/org-audit", () => ({ logOrgAction: vi.fn() }))
  }

  beforeEach(() => {
    mockSend.mockClear()
  })

  it("rejects orgs not attributed to the caller", async () => {
    mockResend()
    mockDb.user.findUnique.mockResolvedValue({ isPartner: true })
    mockDb.organization.findUnique.mockResolvedValue({
      id: "org-1",
      name: "Cafe X",
      referredById: "someone-else",
      members: [],
    })

    const { requestClientAccess } = await import("./partner-console-actions")
    const result = await requestClientAccess("org-1")

    expect(result).toEqual({ error: "not_your_client" })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("rejects when the rep is already a member", async () => {
    mockResend()
    mockDb.user.findUnique.mockResolvedValue({ isPartner: true })
    mockDb.organization.findUnique.mockResolvedValue({
      id: "org-1",
      name: "Cafe X",
      referredById: "user-rep",
      members: [{ userId: "u-o", user: { email: "o@x.test", isPartner: false } }],
    })
    mockDb.member.findFirst.mockResolvedValue({ id: "member-exists" })

    const { requestClientAccess } = await import("./partner-console-actions")
    const result = await requestClientAccess("org-1")

    expect(result).toEqual({ error: "already_member" })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("emails non-partner owners with the prefilled invite link", async () => {
    mockResend()
    mockDb.user.findUnique.mockResolvedValue({ isPartner: true })
    mockDb.organization.findUnique.mockResolvedValue({
      id: "org-1",
      name: "Cafe X",
      referredById: "user-rep",
      members: [
        { userId: "u-owner", user: { email: "owner@x.test", isPartner: false } },
        { userId: "u-partner2", user: { email: "rep2@agency.test", isPartner: true } },
      ],
    })
    mockDb.member.findFirst.mockResolvedValue(null)

    const { requestClientAccess } = await import("./partner-console-actions")
    const result = await requestClientAccess("org-1")

    expect(result).toEqual({ success: true, sentTo: 1 })
    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe("owner@x.test")
    expect(call.html).toContain("invite=rep%40agency.test")
    expect(call.html).toContain("inviteRole=admin")
  })
})

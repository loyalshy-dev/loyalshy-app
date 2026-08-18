import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// ─── Module mocks ─────────────────────────────────────────────

let mockDb: MockDb
const mockAssertAuthenticated = vi.fn()
const mockLogOrgAction = vi.fn()

const SESSION = {
  user: { id: "user-owner", email: "owner@cafe.example", name: "Café Owner" },
  session: { id: "session-1", userId: "user-owner", expiresAt: new Date(), activeOrganizationId: null },
}

beforeEach(() => {
  vi.resetModules()

  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/dal", () => ({
    assertAuthenticated: mockAssertAuthenticated,
    assertOrganizationRole: vi.fn().mockResolvedValue(undefined),
  }))
  vi.doMock("@/lib/org-audit", () => ({ logOrgAction: mockLogOrgAction }))
  vi.doMock("@/lib/rate-limit", () => ({
    publicFormLimiter: { check: vi.fn().mockReturnValue({ success: true }) },
  }))
  vi.doMock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "1.2.3.4"]])),
  }))

  mockAssertAuthenticated.mockReset()
  mockAssertAuthenticated.mockResolvedValue(SESSION)
  mockLogOrgAction.mockReset()
})

// ─── createClientOrg ────────────────────────────────────────────

describe("createClientOrg", () => {
  it("rejects non-partner users", async () => {
    mockDb.user.findUnique.mockResolvedValue({ isPartner: false })

    const { createClientOrg } = await import("./handoff-actions")
    const result = await createClientOrg({ name: "Café Central" })

    expect(result).toEqual({ error: "not_a_partner" })
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it("creates the org with the rep as owner and switches only this session", async () => {
    mockDb.user.findUnique.mockResolvedValue({ isPartner: true })
    mockDb.organization.findUnique.mockResolvedValue(null) // slug free
    mockDb._tx.organization.create.mockResolvedValue({ id: "org-new" })
    mockDb._tx.member.create.mockResolvedValue({ id: "member-rep" })

    const { createClientOrg } = await import("./handoff-actions")
    const result = await createClientOrg({ name: "Café Central" })

    expect(result).toEqual({ organizationId: "org-new" })
    expect(mockDb._tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plan: "FREE",
          subscriptionStatus: "ACTIVE",
          settings: expect.objectContaining({ createdByPartner: "user-owner" }),
          referredById: "user-owner",
        }),
      })
    )
    expect(mockDb._tx.member.create).toHaveBeenCalledWith({
      data: { userId: "user-owner", organizationId: "org-new", role: "owner" },
    })
    expect(mockDb.session.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { activeOrganizationId: "org-new" },
    })
  })
})

// ─── claimHandoff ───────────────────────────────────────────────

describe("claimHandoff", () => {
  const HANDOFF = {
    id: "handoff-1",
    organizationId: "org-1",
    createdById: "user-rep",
    expiresAt: new Date(Date.now() + 86_400_000),
    claimedAt: null,
    organization: { id: "org-1", name: "Café Central" },
  }

  function verifiedClaimant() {
    mockDb.user.findUnique.mockResolvedValue({ emailVerified: true })
  }

  it("blocks claimants with unverified email", async () => {
    mockDb.user.findUnique.mockResolvedValue({ emailVerified: false })

    const { claimHandoff } = await import("./handoff-actions")
    const result = await claimHandoff({ token: "tok" })

    expect(result).toEqual({ error: "email_not_verified" })
  })

  it("blocks the rep from claiming their own link", async () => {
    verifiedClaimant()
    mockDb._tx.orgHandoffToken.findUnique.mockResolvedValue({
      ...HANDOFF,
      createdById: "user-owner", // same as claimant
    })

    const { claimHandoff } = await import("./handoff-actions")
    const result = await claimHandoff({ token: "tok" })

    expect(result).toEqual({ error: "cannot_claim_own" })
    expect(mockDb._tx.member.create).not.toHaveBeenCalled()
  })

  it("rejects an expired token", async () => {
    verifiedClaimant()
    mockDb._tx.orgHandoffToken.findUnique.mockResolvedValue({
      ...HANDOFF,
      expiresAt: new Date(Date.now() - 1000),
    })

    const { claimHandoff } = await import("./handoff-actions")
    const result = await claimHandoff({ token: "tok" })

    expect(result).toEqual({ error: "expired" })
  })

  it("returns already_used when losing the atomic claim race", async () => {
    verifiedClaimant()
    mockDb._tx.orgHandoffToken.findUnique.mockResolvedValue(HANDOFF)
    mockDb._tx.orgHandoffToken.updateMany.mockResolvedValue({ count: 0 })

    const { claimHandoff } = await import("./handoff-actions")
    const result = await claimHandoff({ token: "tok" })

    expect(result).toEqual({ error: "already_used" })
    expect(mockDb._tx.member.create).not.toHaveBeenCalled()
  })

  it("makes the claimant owner, demotes partner owners, and lands the session in the org", async () => {
    verifiedClaimant()
    mockDb._tx.orgHandoffToken.findUnique.mockResolvedValue(HANDOFF)
    mockDb._tx.orgHandoffToken.updateMany.mockResolvedValue({ count: 1 })
    mockDb._tx.member.findFirst.mockResolvedValue(null)
    mockDb._tx.member.create.mockResolvedValue({ id: "member-new" })
    mockDb._tx.member.updateMany.mockResolvedValue({ count: 1 })

    const { claimHandoff } = await import("./handoff-actions")
    const result = await claimHandoff({ token: "tok" })

    expect(result).toEqual({ success: true, organizationName: "Café Central" })
    expect(mockDb._tx.member.create).toHaveBeenCalledWith({
      data: { userId: "user-owner", organizationId: "org-1", role: "owner" },
    })
    // Only partner-held owner seats are demoted — to "admin" (program
    // manager), keeping design/distribution access; the claimant is excluded
    expect(mockDb._tx.member.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        role: "owner",
        userId: { not: "user-owner" },
        user: { isPartner: true },
      },
      data: { role: "admin" },
    })
    expect(mockDb.session.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { activeOrganizationId: "org-1" },
    })
    expect(mockLogOrgAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "OWNERSHIP_CLAIMED", organizationId: "org-1" })
    )
  })

  it("promotes an existing membership instead of creating a duplicate", async () => {
    verifiedClaimant()
    mockDb._tx.orgHandoffToken.findUnique.mockResolvedValue(HANDOFF)
    mockDb._tx.orgHandoffToken.updateMany.mockResolvedValue({ count: 1 })
    mockDb._tx.member.findFirst.mockResolvedValue({ id: "member-existing" })
    mockDb._tx.member.updateMany.mockResolvedValue({ count: 0 })

    const { claimHandoff } = await import("./handoff-actions")
    const result = await claimHandoff({ token: "tok" })

    expect(result).toEqual({ success: true, organizationName: "Café Central" })
    expect(mockDb._tx.member.create).not.toHaveBeenCalled()
    expect(mockDb._tx.member.update).toHaveBeenCalledWith({
      where: { id: "member-existing" },
      data: { role: "owner" },
    })
  })
})

describe("createHandoffLink", () => {
  const mockSend = vi.fn().mockResolvedValue({})

  function setupPartnerOrg() {
    mockDb.user.findUnique.mockResolvedValue({ isPartner: true })
    mockDb.organization.findUnique.mockResolvedValue({ name: "Café Central" })
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: mockSend }
      },
    }))
  }

  beforeEach(() => {
    mockSend.mockClear()
  })

  it("rejects a malformed recipient email", async () => {
    setupPartnerOrg()

    const { createHandoffLink } = await import("./handoff-actions")
    const result = await createHandoffLink("org-1", "not-an-email")

    expect(result).toEqual({ error: "invalid_email" })
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  it("creates the link without email when no recipient is given", async () => {
    setupPartnerOrg()

    const { createHandoffLink } = await import("./handoff-actions")
    const result = await createHandoffLink("org-1")

    expect("url" in result && result.url).toContain("/claim/")
    expect((result as { emailSent: boolean }).emailSent).toBe(false)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("emails the link to the owner when a recipient is given", async () => {
    setupPartnerOrg()

    const { createHandoffLink } = await import("./handoff-actions")
    const result = await createHandoffLink("org-1", "owner@cafe.example")

    expect((result as { emailSent: boolean }).emailSent).toBe(true)
    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe("owner@cafe.example")
    expect(call.html).toContain("/claim/")
    expect(call.html).toContain("Café Central")
  })

  it("still returns the link when the email send fails", async () => {
    setupPartnerOrg()
    mockSend.mockRejectedValueOnce(new Error("resend down"))

    const { createHandoffLink } = await import("./handoff-actions")
    const result = await createHandoffLink("org-1", "owner@cafe.example")

    expect("url" in result && result.url).toContain("/claim/")
    expect((result as { emailSent: boolean }).emailSent).toBe(false)
  })
})

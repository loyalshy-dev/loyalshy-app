import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"
import { createMockSession } from "@/__tests__/mocks/auth"

// ─── Module mocks ─────────────────────────────────────────────

let mockDb: MockDb
const mockGetCurrentUser = vi.fn()

beforeEach(() => {
  vi.resetModules()

  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))

  const ADMIN_ROLES = new Set(["ADMIN_SUPPORT", "ADMIN_BILLING", "ADMIN_OPS", "SUPER_ADMIN"])

  vi.doMock("@/lib/dal", () => ({
    getCurrentUser: mockGetCurrentUser,
    assertOrganizationRole: vi.fn().mockResolvedValue(undefined),
    getOrganizationForUser: vi.fn().mockResolvedValue({
      id: "org-1",
      name: "Test Org",
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      trialEndsAt: null,
    }),
    isAdminRole: (role: string) => ADMIN_ROLES.has(role),
  }))

  mockGetCurrentUser.mockReset()
})

// ─── checkContactLimit ──────────────────────────────────────────

describe("checkContactLimit", () => {
  it("excludes soft-deleted contacts from count", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.contact.count.mockResolvedValue(10)

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    // Verify the count query filters deletedAt: null
    expect(mockDb.contact.count).toHaveBeenCalledWith({
      where: { organizationId: "org-1", deletedAt: null },
    })
    expect(result.allowed).toBe(true)
    expect(result.current).toBe(10)
    expect(result.limit).toBe(50)
  })

  it("allows when under the limit", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.contact.count.mockResolvedValue(49)

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    expect(result.allowed).toBe(true)
    expect(result.current).toBe(49)
  })

  it("blocks when at the limit", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.contact.count.mockResolvedValue(50)

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    expect(result.allowed).toBe(false)
    expect(result.current).toBe(50)
    expect(result.limit).toBe(50)
  })

  it("blocks when over the limit", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.contact.count.mockResolvedValue(55)

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    expect(result.allowed).toBe(false)
  })

  it("flags approaching when at 80%+", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.contact.count.mockResolvedValue(40) // 80% of 50

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    expect(result.allowed).toBe(true)
    expect(result.approaching).toBe(true)
  })

  it("does not flag approaching when under 80%", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.contact.count.mockResolvedValue(39) // 78% of 50

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    expect(result.approaching).toBe(false)
  })

  it("admin bypasses limit but still filters deleted contacts", async () => {
    const session = createMockSession({ role: "SUPER_ADMIN" })
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.contact.count.mockResolvedValue(200)

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    expect(mockDb.contact.count).toHaveBeenCalledWith({
      where: { organizationId: "org-1", deletedAt: null },
    })
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(Infinity)
  })

  it("blocks when organization not found", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue(null)

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-nonexistent")

    expect(result.allowed).toBe(false)
    expect(result.current).toBe(0)
    expect(result.limit).toBe(0)
  })

  it("blocks when subscription is inactive", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "STARTER",
      subscriptionStatus: "CANCELED",
    })

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    expect(result.allowed).toBe(false)
  })

  it("uses correct limit per plan tier", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "GROWTH",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.contact.count.mockResolvedValue(100)

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    expect(result.limit).toBe(2_500)
    expect(result.allowed).toBe(true)
    expect(result.approaching).toBe(false)
  })

  it("never flags approaching for unlimited plans", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "SCALE",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.contact.count.mockResolvedValue(10_000)

    const { checkContactLimit } = await import("./billing-actions")
    const result = await checkContactLimit("org-1")

    expect(result.allowed).toBe(true)
    expect(result.approaching).toBe(false)
    expect(result.limit).toBe(Infinity)
  })
})

// ─── checkStaffLimit (partner seat exemption) ───────────────────

describe("checkStaffLimit", () => {
  it("excludes partner members from the seat count", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "STARTER",
      subscriptionStatus: "ACTIVE",
    })
    // 1 non-partner member (the partner rep is filtered out by the where)
    mockDb.member.count.mockResolvedValue(1)
    mockDb.staffInvitation.findMany.mockResolvedValue([])

    const { checkStaffLimit } = await import("./billing-actions")
    const result = await checkStaffLimit("org-1")

    expect(mockDb.member.count).toHaveBeenCalledWith({
      where: { organizationId: "org-1", user: { isPartner: false } },
    })
    expect(result.allowed).toBe(true)
    expect(result.current).toBe(1)
    expect(result.limit).toBe(2)
  })

  it("blocks a non-partner invite at the plan limit", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "STARTER",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.user.findUnique.mockResolvedValue({ isPartner: false })
    mockDb.member.count.mockResolvedValue(2)
    mockDb.staffInvitation.findMany.mockResolvedValue([])

    const { checkStaffLimit } = await import("./billing-actions")
    const result = await checkStaffLimit("org-1", { inviteeEmail: "barista@example.com" })

    expect(result.allowed).toBe(false)
    expect(result.current).toBe(2)
  })

  it("allows inviting a partner user even when the org is at its limit", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.user.findUnique.mockResolvedValue({ isPartner: true })
    mockDb.member.count.mockResolvedValue(2) // Pro limit already reached

    const { checkStaffLimit } = await import("./billing-actions")
    const result = await checkStaffLimit("org-1", { inviteeEmail: "rep@agency.example" })

    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(Infinity)
  })

  it("does not count pending invitations addressed to partner users", async () => {
    const session = createMockSession()
    mockGetCurrentUser.mockResolvedValue(session)

    mockDb.organization.findUnique.mockResolvedValue({
      plan: "STARTER",
      subscriptionStatus: "ACTIVE",
    })
    mockDb.member.count.mockResolvedValue(1)
    mockDb.staffInvitation.findMany.mockResolvedValue([
      { email: "rep@agency.example" },
      { email: "barista@example.com" },
    ])
    // One of the two pending invites belongs to a partner user
    mockDb.user.count.mockResolvedValue(1)

    const { checkStaffLimit } = await import("./billing-actions")
    const result = await checkStaffLimit("org-1")

    // 1 member + (2 pending - 1 partner) = 2, which is NOT < 2
    expect(result.current).toBe(2)
    expect(result.allowed).toBe(false)
  })
})

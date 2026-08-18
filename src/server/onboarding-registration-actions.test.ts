import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb
const mockAssertAuthenticated = vi.fn()

const SESSION = {
  user: { id: "user-1", email: "owner@cafe.test", name: "Café Owner" },
  session: { id: "session-1", userId: "user-1", expiresAt: new Date(), activeOrganizationId: null },
}

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/dal", () => ({ assertAuthenticated: mockAssertAuthenticated }))
  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
  vi.doMock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn().mockResolvedValue({}) } }))
  mockAssertAuthenticated.mockReset()
  mockAssertAuthenticated.mockResolvedValue(SESSION)

  // Defaults for the happy path
  mockDb.member.findFirst.mockResolvedValue(null) // no existing org
  mockDb.organization.findUnique.mockResolvedValue(null) // slug free
  mockDb._tx.organization.create.mockResolvedValue({ id: "org-1" })
  mockDb._tx.member.create.mockResolvedValue({ id: "member-1" })
  mockDb.passTemplate.findFirst.mockResolvedValue(null)
})

describe("createOrganization referral attribution", () => {
  it("stamps referredById for a valid partner code", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "user-partner", isPartner: true })

    const { createOrganization } = await import("./onboarding-registration-actions")
    const result = await createOrganization({ name: "Café Central", ref: "agency-rep-abc123" })

    expect(result).toEqual({ organizationId: "org-1" })
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { referralCode: "agency-rep-abc123" },
      select: { id: true, isPartner: true },
    })
    expect(mockDb._tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referredById: "user-partner" }),
      })
    )
  })

  it("ignores an unknown referral code without blocking signup", async () => {
    mockDb.user.findUnique.mockResolvedValue(null)

    const { createOrganization } = await import("./onboarding-registration-actions")
    const result = await createOrganization({ name: "Café Central", ref: "bogus-code" })

    expect(result).toEqual({ organizationId: "org-1" })
    expect(mockDb._tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referredById: null }),
      })
    )
  })

  it("ignores a code belonging to a non-partner user", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "user-x", isPartner: false })

    const { createOrganization } = await import("./onboarding-registration-actions")
    const result = await createOrganization({ name: "Café Central", ref: "some-code" })

    expect(result).toEqual({ organizationId: "org-1" })
    expect(mockDb._tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referredById: null }),
      })
    )
  })

  it("ignores self-referral", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "user-1", isPartner: true })

    const { createOrganization } = await import("./onboarding-registration-actions")
    const result = await createOrganization({ name: "Café Central", ref: "my-own-code" })

    expect(result).toEqual({ organizationId: "org-1" })
    expect(mockDb._tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referredById: null }),
      })
    )
  })

  it("skips the referral lookup entirely when no ref is given", async () => {
    const { createOrganization } = await import("./onboarding-registration-actions")
    const result = await createOrganization({ name: "Café Central" })

    expect(result).toEqual({ organizationId: "org-1" })
    expect(mockDb.user.findUnique).not.toHaveBeenCalled()
  })
})

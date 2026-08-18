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

describe("getMyReferralLink", () => {
  it("rejects non-partner users", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      isPartner: false,
      referralCode: null,
      name: "Someone",
    })

    const { getMyReferralLink } = await import("./referral-actions")
    const result = await getMyReferralLink()

    expect(result).toEqual({ error: "not_a_partner" })
    expect(mockDb.user.update).not.toHaveBeenCalled()
  })

  it("returns the existing code without regenerating", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      isPartner: true,
      referralCode: "agency-rep-abc123",
      name: "Agency Rep",
    })

    const { getMyReferralLink } = await import("./referral-actions")
    const result = await getMyReferralLink()

    expect(result).toMatchObject({ code: "agency-rep-abc123" })
    expect((result as { url: string }).url).toContain("/register?ref=agency-rep-abc123")
    expect(mockDb.user.update).not.toHaveBeenCalled()
  })

  it("lazily generates and persists a name-based code", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      isPartner: true,
      referralCode: null,
      name: "Agency Rep",
    })
    mockDb.user.update.mockResolvedValue({})

    const { getMyReferralLink } = await import("./referral-actions")
    const result = await getMyReferralLink()

    expect("code" in result).toBe(true)
    const code = (result as { code: string }).code
    expect(code).toMatch(/^agency-rep-[0-9a-f]{6}$/)
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user-rep" },
      data: { referralCode: code },
    })
  })

  it("retries on a unique-code collision", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      isPartner: true,
      referralCode: null,
      name: "Agency Rep",
    })
    const { Prisma } = await import("@prisma/client")
    const p2002 = new Prisma.PrismaClientKnownRequestError("collision", {
      code: "P2002",
      clientVersion: "test",
    })
    mockDb.user.update.mockRejectedValueOnce(p2002).mockResolvedValueOnce({})

    const { getMyReferralLink } = await import("./referral-actions")
    const result = await getMyReferralLink()

    expect("code" in result).toBe(true)
    expect(mockDb.user.update).toHaveBeenCalledTimes(2)
  })
})

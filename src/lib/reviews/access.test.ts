import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
})

async function allows(plan: string, subscriptionStatus = "ACTIVE") {
  const { orgAllowsReviewPrompts } = await import("./access")
  return orgAllowsReviewPrompts({ id: "org-1", plan, subscriptionStatus })
}

describe("orgAllowsReviewPrompts", () => {
  it("allows paid plans without looking at members", async () => {
    expect(await allows("STARTER")).toBe(true)
    expect(await allows("SCALE", "TRIALING")).toBe(true)
    expect(mockDb.member.findFirst).not.toHaveBeenCalled()
  })

  it("blocks Free and lapsed paid orgs owned by normal users", async () => {
    mockDb.member.findFirst.mockResolvedValue(null)
    expect(await allows("FREE")).toBe(false)
    expect(await allows("GROWTH", "CANCELED")).toBe(false)
  })

  it("allows a Free org whose owner is a platform admin", async () => {
    mockDb.member.findFirst.mockResolvedValue({ id: "m-1" })
    expect(await allows("FREE")).toBe(true)
    expect(mockDb.member.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        role: "owner",
        user: { role: { in: ["ADMIN_SUPPORT", "ADMIN_BILLING", "ADMIN_OPS", "SUPER_ADMIN"] } },
      },
      select: { id: true },
    })
  })
})

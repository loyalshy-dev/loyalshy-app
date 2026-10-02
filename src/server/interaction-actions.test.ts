import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// Dashboard coupon redemption (register-visit dialog).

let mockDb: MockDb
const mockSchedule = vi.fn()

const ORG = { id: "org-1", name: "Café", plan: "GROWTH", subscriptionStatus: "ACTIVE" }
const UNLIMITED = { redemptionLimit: "unlimited", discountType: "percentage", discountValue: 10 }
const SINGLE = { ...UNLIMITED, redemptionLimit: "single" }

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  mockSchedule.mockReset()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/dal", () => ({
    assertAuthenticated: vi.fn(async () => ({ user: { id: "user-1" } })),
    getOrganizationForUser: vi.fn(async () => ORG),
    assertOrganizationAccess: vi.fn(),
  }))
  vi.doMock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }))
  vi.doMock("@/lib/wallet/dispatch", () => ({ dispatchWalletUpdate: vi.fn() }))
  vi.doMock("@/lib/reviews/schedule", () => ({ maybeScheduleReviewPrompt: mockSchedule }))
})

function couponPass(config: unknown) {
  return {
    id: "pi-1",
    status: "ACTIVE",
    walletProvider: "APPLE",
    contact: { id: "c-1", organizationId: "org-1", deletedAt: null, totalInteractions: 4 },
    passTemplate: { id: "pt-1", name: "10%", passType: "COUPON", config, status: "ACTIVE", endsAt: null },
  }
}

function freshData(data: Record<string, unknown>) {
  mockDb._tx.passInstance.findUnique.mockResolvedValue({ data })
  mockDb._tx.passInstance.update.mockResolvedValue({})
  mockDb._tx.reward.findFirst.mockResolvedValue(null)
  mockDb._tx.reward.create.mockResolvedValue({})
  mockDb._tx.interaction.create.mockResolvedValue({})
  mockDb._tx.contact.update.mockResolvedValue({})
}

async function redeem() {
  const { redeemCoupon } = await import("./interaction-actions")
  return redeemCoupon("pi-1")
}

describe("redeemCoupon (dashboard)", () => {
  it("re-redeems an unlimited coupon on the same pass and schedules the review prompt", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(couponPass(UNLIMITED))
    freshData({ redeemed: true, redeemedAt: new Date(Date.now() - 120_000).toISOString(), redeemCount: 2 })

    const result = await redeem()
    expect(result.success).toBe(true)
    expect(mockDb._tx.passInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ data: expect.objectContaining({ redeemCount: 3 }) }) }),
    )
    expect(mockDb._tx.passInstance.create).not.toHaveBeenCalled()
    expect(mockDb._tx.reward.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passInstanceId: "pi-1" }) }),
    )
    expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({ passType: "COUPON", newVisitCount: 3 }))
  })

  it("debounces an unlimited coupon redeemed less than a minute ago", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(couponPass(UNLIMITED))
    freshData({ redeemed: true, redeemedAt: new Date(Date.now() - 10_000).toISOString() })

    expect(await redeem()).toEqual({ success: false, error: "couponJustRedeemed" })
    expect(mockDb._tx.passInstance.update).not.toHaveBeenCalled()
  })

  it("still refuses a second redemption of a single-use coupon", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(couponPass(SINGLE))
    freshData({ redeemed: true, redeemedAt: new Date(Date.now() - 120_000).toISOString() })

    expect(await redeem()).toEqual({ success: false, error: "couponAlreadyRedeemed" })
    expect(mockSchedule).not.toHaveBeenCalled()
  })
})

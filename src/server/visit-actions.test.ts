import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"
import {
  createMockSession,
  createMockRestaurant,
  createMockEnrollment,
  createMockMember,
} from "@/__tests__/mocks/auth"

// ─── Module mocks ─────────────────────────────────────────────

let mockDb: MockDb

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: vi.fn() },
}))

beforeEach(() => {
  vi.resetModules()

  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))

  const session = createMockSession()
  const restaurant = createMockRestaurant()

  vi.doMock("@/lib/dal", () => ({
    assertAuthenticated: vi.fn().mockResolvedValue(session),
    assertRestaurantAccess: vi.fn().mockResolvedValue({
      session,
      member: createMockMember(),
    }),
    getRestaurantForUser: vi.fn().mockResolvedValue(restaurant),
  }))
})

// ─── Tests ─────────────────────────────────────────────────────

describe("registerVisit", () => {
  it("increments currentCycleVisits on a normal visit", async () => {
    const { registerVisit } = await import("./visit-actions")

    const enrollment = createMockEnrollment({ currentCycleVisits: 3, totalVisits: 13 })
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)
    mockDb.visit.findFirst.mockResolvedValue(null) // no recent visit

    const result = await registerVisit("enrollment-1")

    expect(result.success).toBe(true)
    expect(result.wasRewardEarned).toBe(false)
    expect(result.newCycleVisits).toBe(4)
    expect(result.newTotalVisits).toBe(14)
    expect(result.visitsRequired).toBe(10)
  })

  it("triggers reward when cycle completes", async () => {
    const { registerVisit } = await import("./visit-actions")

    // Enrollment at 9/10 visits — next visit completes the cycle
    const enrollment = createMockEnrollment({
      currentCycleVisits: 9,
      totalVisits: 19,
      customer: {
        id: "customer-1",
        restaurantId: "restaurant-1",
        deletedAt: null,
        totalVisits: 19,
        fullName: "Jane Doe",
      },
    })
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)
    mockDb.visit.findFirst.mockResolvedValue(null)

    const result = await registerVisit("enrollment-1")

    expect(result.success).toBe(true)
    expect(result.wasRewardEarned).toBe(true)
    expect(result.newCycleVisits).toBe(0) // reset
    expect(result.newTotalVisits).toBe(20)
    expect(result.rewardDescription).toBe("Free coffee")
  })

  it("creates Visit + Reward records in a transaction when cycle completes", async () => {
    const { registerVisit } = await import("./visit-actions")

    const enrollment = createMockEnrollment({
      currentCycleVisits: 9,
      totalVisits: 9,
      customer: {
        id: "customer-1",
        restaurantId: "restaurant-1",
        deletedAt: null,
        totalVisits: 9,
        fullName: "Jane Doe",
      },
    })
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)
    mockDb.visit.findFirst.mockResolvedValue(null)

    await registerVisit("enrollment-1")

    // $transaction was called
    expect(mockDb.$transaction).toHaveBeenCalledOnce()

    // Check the transaction created a visit
    const txFn = mockDb.$transaction.mock.calls[0]![0] as Function
    const tx = mockDb._tx
    await txFn(tx)

    expect(tx.visit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "customer-1",
          enrollmentId: "enrollment-1",
          visitNumber: 10,
        }),
      })
    )

    // Check a reward was created
    expect(tx.reward.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "customer-1",
          enrollmentId: "enrollment-1",
          status: "AVAILABLE",
        }),
      })
    )

    // Check enrollment cycle was reset to 0
    expect(tx.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentCycleVisits: 0,
        }),
      })
    )
  })

  it("blocks double registration within 1 minute", async () => {
    const { registerVisit } = await import("./visit-actions")

    const enrollment = createMockEnrollment()
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)
    mockDb.visit.findFirst.mockResolvedValue({ id: "visit-recent" }) // recent visit exists

    const result = await registerVisit("enrollment-1")

    expect(result.success).toBe(false)
    expect(result.error).toContain("less than a minute ago")
  })

  it("returns error when enrollment not found", async () => {
    const { registerVisit } = await import("./visit-actions")

    mockDb.enrollment.findUnique.mockResolvedValue(null)

    const result = await registerVisit("nonexistent")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Enrollment not found")
  })

  it("returns error when no restaurant found", async () => {
    vi.resetModules()
    mockDb = createMockDb()
    vi.doMock("@/lib/db", () => ({ db: mockDb }))

    const session = createMockSession()
    vi.doMock("@/lib/dal", () => ({
      assertAuthenticated: vi.fn().mockResolvedValue(session),
      assertRestaurantAccess: vi.fn(),
      getRestaurantForUser: vi.fn().mockResolvedValue(null),
    }))

    const { registerVisit } = await import("./visit-actions")
    const result = await registerVisit("enrollment-1")

    expect(result.success).toBe(false)
    expect(result.error).toBe("No restaurant found")
  })

  it("returns error when enrollment is not ACTIVE", async () => {
    const { registerVisit } = await import("./visit-actions")

    const enrollment = createMockEnrollment({ status: "FROZEN" })
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)

    const result = await registerVisit("enrollment-1")

    expect(result.success).toBe(false)
    expect(result.error).toContain("frozen")
  })

  it("returns error when program has expired", async () => {
    const { registerVisit } = await import("./visit-actions")

    const enrollment = createMockEnrollment({
      loyaltyProgram: {
        id: "program-1",
        name: "Test Program",
        programType: "STAMP_CARD",
        visitsRequired: 10,
        rewardDescription: "Free coffee",
        rewardExpiryDays: 30,
        status: "ACTIVE",
        endsAt: new Date("2025-01-01"), // expired
      },
    })
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)

    const result = await registerVisit("enrollment-1")

    expect(result.success).toBe(false)
    expect(result.error).toContain("expired")
  })

  it("dispatches wallet pass update for enrollments with wallet passes", async () => {
    const { registerVisit } = await import("./visit-actions")
    const { tasks } = await import("@trigger.dev/sdk")

    const enrollment = createMockEnrollment({
      currentCycleVisits: 2,
      walletPassType: "APPLE",
    })
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)
    mockDb.visit.findFirst.mockResolvedValue(null)

    await registerVisit("enrollment-1")

    // Allow the dynamic import promise to settle
    await new Promise((r) => setTimeout(r, 10))

    expect(tasks.trigger).toHaveBeenCalledWith("update-wallet-pass", {
      enrollmentId: "enrollment-1",
      updateType: "VISIT",
    })
  })
})

describe("redeemCoupon", () => {
  function createCouponEnrollment(overrides?: Record<string, unknown>) {
    return createMockEnrollment({
      loyaltyProgram: {
        id: "program-1",
        name: "Summer Coupon",
        programType: "COUPON",
        config: {
          discountType: "percentage",
          discountValue: 20,
          couponDescription: "20% off your order",
          redemptionLimit: "single",
        },
        rewardDescription: "20% off",
        rewardExpiryDays: 30,
        status: "ACTIVE",
        endsAt: null,
      },
      ...overrides,
    })
  }

  it("redeems AVAILABLE reward and marks enrollment COMPLETED for single-use", async () => {
    const { redeemCoupon } = await import("./visit-actions")

    const enrollment = createCouponEnrollment()
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)
    mockDb.reward.findFirst.mockResolvedValue({ id: "reward-1" })

    const result = await redeemCoupon("enrollment-1")

    expect(result.success).toBe(true)
    expect(result.discountText).toBe("20% off")
    expect(result.redemptionLimit).toBe("single")
    expect(result.programName).toBe("Summer Coupon")
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
  })

  it("redeems reward and auto-creates new one for unlimited", async () => {
    const { redeemCoupon } = await import("./visit-actions")

    const enrollment = createCouponEnrollment({
      loyaltyProgram: {
        id: "program-1",
        name: "Unlimited Coupon",
        programType: "COUPON",
        config: {
          discountType: "freebie",
          discountValue: 0,
          couponDescription: "Free dessert",
          redemptionLimit: "unlimited",
        },
        rewardDescription: "Free dessert",
        rewardExpiryDays: 30,
        status: "ACTIVE",
        endsAt: null,
      },
    })
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)
    mockDb.reward.findFirst.mockResolvedValue({ id: "reward-1" })

    const result = await redeemCoupon("enrollment-1")

    expect(result.success).toBe(true)
    expect(result.redemptionLimit).toBe("unlimited")

    // Verify transaction created a new reward
    const txFn = mockDb.$transaction.mock.calls[0]![0] as Function
    const tx = mockDb._tx
    await txFn(tx)

    expect(tx.reward.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "AVAILABLE",
          enrollmentId: "enrollment-1",
        }),
      })
    )
  })

  it("returns error when no AVAILABLE reward", async () => {
    const { redeemCoupon } = await import("./visit-actions")

    const enrollment = createCouponEnrollment()
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)
    mockDb.reward.findFirst.mockResolvedValue(null)

    const result = await redeemCoupon("enrollment-1")

    expect(result.success).toBe(false)
    expect(result.error).toBe("No available coupon to redeem")
  })

  it("returns error when enrollment not found", async () => {
    const { redeemCoupon } = await import("./visit-actions")

    mockDb.enrollment.findUnique.mockResolvedValue(null)

    const result = await redeemCoupon("nonexistent")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Enrollment not found")
  })

  it("returns error when not COUPON type", async () => {
    const { redeemCoupon } = await import("./visit-actions")

    const enrollment = createMockEnrollment() // default is STAMP_CARD
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)

    const result = await redeemCoupon("enrollment-1")

    expect(result.success).toBe(false)
    expect(result.error).toBe("This is not a coupon program")
  })

  it("returns error when enrollment not ACTIVE", async () => {
    const { redeemCoupon } = await import("./visit-actions")

    const enrollment = createCouponEnrollment({ status: "COMPLETED" })
    mockDb.enrollment.findUnique.mockResolvedValue(enrollment)

    const result = await redeemCoupon("enrollment-1")

    expect(result.success).toBe(false)
    expect(result.error).toContain("completed")
  })
})

describe("searchCustomersForVisit", () => {
  it("returns matching customers with enrollments", async () => {
    const { searchCustomersForVisit } = await import("./visit-actions")

    const mockCustomers = [
      {
        id: "c1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        phone: null,
        totalVisits: 5,
        lastVisitAt: new Date(),
        enrollments: [
          {
            id: "e1",
            currentCycleVisits: 3,
            totalVisits: 5,
            walletPassType: "NONE",
            status: "ACTIVE",
            loyaltyProgram: {
              id: "program-1",
              name: "Test Program",
              visitsRequired: 10,
            },
          },
        ],
      },
    ]
    mockDb.customer.findMany.mockResolvedValue(mockCustomers)

    const result = await searchCustomersForVisit("Jane")

    expect(result.customers).toHaveLength(1)
    expect(result.customers[0].enrollments).toHaveLength(1)
    expect(result.customers[0].enrollments[0].programName).toBe("Test Program")
  })

  it("returns empty array for empty query", async () => {
    const { searchCustomersForVisit } = await import("./visit-actions")

    const result = await searchCustomersForVisit("")

    expect(result.customers).toEqual([])
    expect(mockDb.customer.findMany).not.toHaveBeenCalled()
  })

  it("returns empty array for whitespace-only query", async () => {
    const { searchCustomersForVisit } = await import("./visit-actions")

    const result = await searchCustomersForVisit("   ")

    expect(result.customers).toEqual([])
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"
import {
  createMockSession,
  createMockRestaurant,
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
    assertRestaurantRole: vi.fn().mockResolvedValue({
      session,
      member: createMockMember(),
    }),
    getRestaurantForUser: vi.fn().mockResolvedValue(restaurant),
  }))
})

// ─── Tests ─────────────────────────────────────────────────────

describe("redeemReward", () => {
  it("successfully redeems an AVAILABLE reward", async () => {
    const { redeemReward } = await import("./reward-actions")

    const reward = {
      id: "reward-1",
      status: "AVAILABLE",
      customerId: "customer-1",
      expiresAt: new Date(Date.now() + 86400_000), // tomorrow
    }
    mockDb.reward.findFirst.mockResolvedValue(reward)

    const result = await redeemReward("reward-1")

    expect(result.success).toBe(true)
    expect(mockDb.$transaction).toHaveBeenCalled()
  })

  it("rejects already redeemed reward", async () => {
    const { redeemReward } = await import("./reward-actions")

    mockDb.reward.findFirst.mockResolvedValue({
      id: "reward-1",
      status: "REDEEMED",
      customerId: "customer-1",
      expiresAt: new Date(Date.now() + 86400_000),
    })

    const result = await redeemReward("reward-1")

    expect(result.success).toBe(false)
    expect(result.error).toContain("already been redeemed")
  })

  it("rejects expired reward", async () => {
    const { redeemReward } = await import("./reward-actions")

    mockDb.reward.findFirst.mockResolvedValue({
      id: "reward-1",
      status: "AVAILABLE",
      customerId: "customer-1",
      expiresAt: new Date(Date.now() - 86400_000), // yesterday
    })

    const result = await redeemReward("reward-1")

    expect(result.success).toBe(false)
    expect(result.error).toContain("expired")
    // It should auto-expire the reward
    expect(mockDb.reward.update).toHaveBeenCalledWith({
      where: { id: "reward-1" },
      data: { status: "EXPIRED" },
    })
  })

  it("returns error for nonexistent reward", async () => {
    const { redeemReward } = await import("./reward-actions")

    mockDb.reward.findFirst.mockResolvedValue(null)

    const result = await redeemReward("nonexistent")

    expect(result.success).toBe(false)
    expect(result.error).toBe("Reward not found")
  })

  it("increments totalRewardsRedeemed in transaction", async () => {
    const { redeemReward } = await import("./reward-actions")

    const reward = {
      id: "reward-1",
      status: "AVAILABLE",
      customerId: "customer-1",
      enrollmentId: "enrollment-1",
      expiresAt: new Date(Date.now() + 86400_000),
    }
    mockDb.reward.findFirst.mockResolvedValue(reward)

    await redeemReward("reward-1")

    // Verify the transaction function was called
    const txFn = mockDb.$transaction.mock.calls[0]![0] as Function
    const tx = mockDb._tx
    await txFn(tx)

    expect(tx.reward.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REDEEMED",
          redeemedById: "user-1",
        }),
      })
    )

    expect(tx.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { totalRewardsRedeemed: { increment: 1 } },
      })
    )
  })

  it("dispatches wallet pass update via Trigger.dev", async () => {
    // Set TRIGGER_SECRET_KEY so the code path that dispatches Trigger.dev is taken
    const original = process.env.TRIGGER_SECRET_KEY
    process.env.TRIGGER_SECRET_KEY = "test-secret"

    try {
      const { redeemReward } = await import("./reward-actions")
      const { tasks } = await import("@trigger.dev/sdk")

      mockDb.reward.findFirst.mockResolvedValue({
        id: "reward-1",
        status: "AVAILABLE",
        customerId: "customer-1",
        enrollmentId: "enrollment-1",
        expiresAt: new Date(Date.now() + 86400_000),
      })

      await redeemReward("reward-1")

      // Allow the dynamic import promise to settle
      await new Promise((r) => setTimeout(r, 10))

      expect(tasks.trigger).toHaveBeenCalledWith("update-wallet-pass", {
        enrollmentId: "enrollment-1",
        updateType: "REWARD_REDEEMED",
      })
    } finally {
      if (original === undefined) {
        delete process.env.TRIGGER_SECRET_KEY
      } else {
        process.env.TRIGGER_SECRET_KEY = original
      }
    }
  })
})

describe("getRewards", () => {
  it("paginates results correctly", async () => {
    const { getRewards } = await import("./reward-actions")

    mockDb.reward.findMany.mockResolvedValue([])
    mockDb.reward.count.mockResolvedValue(45)

    const result = await getRewards({ page: 2, perPage: 20 })

    expect(result.total).toBe(45)
    expect(result.pageCount).toBe(3)
    expect(mockDb.reward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
      })
    )
  })

  it("filters by tab status", async () => {
    const { getRewards } = await import("./reward-actions")

    mockDb.reward.findMany.mockResolvedValue([])
    mockDb.reward.count.mockResolvedValue(0)

    await getRewards({ tab: "redeemed" })

    expect(mockDb.reward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "REDEEMED",
        }),
      })
    )
  })

  it("defaults to available tab", async () => {
    const { getRewards } = await import("./reward-actions")

    mockDb.reward.findMany.mockResolvedValue([])
    mockDb.reward.count.mockResolvedValue(0)

    await getRewards({})

    expect(mockDb.reward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "AVAILABLE",
        }),
      })
    )
  })
})

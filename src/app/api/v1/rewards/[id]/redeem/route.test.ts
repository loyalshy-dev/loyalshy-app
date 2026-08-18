import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Prisma } from "@prisma/client"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// ─── Module mocks ───────────────────────────────────────────

let mockDb: MockDb

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/pass-config", () => ({
    parseCouponConfig: (cfg: unknown) =>
      cfg && typeof cfg === "object" && "couponConfig" in cfg
        ? (cfg as { couponConfig: { redemptionLimit: "single" | "unlimited" } }).couponConfig
        : null,
  }))
})

// ─── Fixtures ───────────────────────────────────────────────

type RewardFixture = {
  id: string
  revealedAt: Date | null
  passInstanceId: string | null
  passInstance: {
    walletProvider: string
    passTemplate: { passType: "STAMP_CARD" | "COUPON"; config: Prisma.JsonValue } | null
  } | null
}

function makeReward(overrides: Partial<RewardFixture> = {}): RewardFixture {
  return {
    id: "rw-1",
    revealedAt: new Date("2026-08-01T00:00:00Z"),
    passInstanceId: "pi-1",
    passInstance: {
      walletProvider: "NONE",
      passTemplate: {
        passType: "STAMP_CARD" as const,
        config: { stampsRequired: 10 },
      },
    },
    ...overrides,
  }
}

function makeSingleUseCouponReward() {
  return makeReward({
    passInstance: {
      walletProvider: "NONE",
      passTemplate: {
        passType: "COUPON" as const,
        config: { couponConfig: { redemptionLimit: "single" as const } },
      },
    },
  })
}

// ─── performRewardRedeem — atomic claim ─────────────────────

describe("performRewardRedeem — atomic claim", () => {
  it("redeems an available reward (regression: raw-SQL enum mismatch made this 409 unconditionally)", async () => {
    mockDb._tx.reward.updateMany.mockResolvedValue({ count: 1 })
    mockDb._tx.passInstance.findUnique.mockResolvedValue({ data: { totalRewardsRedeemed: 2 } })
    mockDb._tx.passInstance.update.mockResolvedValue({})

    const { performRewardRedeem } = await import("./route")
    await performRewardRedeem(makeReward(), "user-1")

    expect(mockDb._tx.reward.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rw-1", status: "AVAILABLE" },
        data: expect.objectContaining({ status: "REDEEMED", redeemedById: "user-1" }),
      }),
    )
    expect(mockDb._tx.passInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          data: expect.objectContaining({ totalRewardsRedeemed: 3 }),
        }),
      }),
    )
  })

  it("rejects with 409 'already redeemed' when the claim matches no row (losing tx)", async () => {
    mockDb._tx.reward.updateMany.mockResolvedValue({ count: 0 })
    mockDb._tx.reward.findUnique.mockResolvedValue({ status: "REDEEMED" })

    const { performRewardRedeem } = await import("./route")

    await expect(performRewardRedeem(makeReward(), "user-1")).rejects.toMatchObject({
      status: 409,
      title: "Conflict",
      detail: "Reward is already redeemed",
    })
    expect(mockDb._tx.passInstance.update).not.toHaveBeenCalled()
  })

  it("rejects with 409 'already expired' when the reward expired between pre-check and claim", async () => {
    mockDb._tx.reward.updateMany.mockResolvedValue({ count: 0 })
    mockDb._tx.reward.findUnique.mockResolvedValue({ status: "EXPIRED" })

    const { performRewardRedeem } = await import("./route")

    await expect(performRewardRedeem(makeReward(), "user-1")).rejects.toMatchObject({
      status: 409,
      detail: "Reward is already expired",
    })
  })

  it("falls back to 'unavailable' when the reward row vanished under the claim", async () => {
    mockDb._tx.reward.updateMany.mockResolvedValue({ count: 0 })
    mockDb._tx.reward.findUnique.mockResolvedValue(null)

    const { performRewardRedeem } = await import("./route")

    await expect(performRewardRedeem(makeReward(), "user-1")).rejects.toMatchObject({
      status: 409,
      detail: "Reward is already unavailable",
    })
  })

  it("sets revealedAt only when the reward was not yet revealed", async () => {
    mockDb._tx.reward.updateMany.mockResolvedValue({ count: 1 })
    mockDb._tx.passInstance.findUnique.mockResolvedValue({ data: {} })
    mockDb._tx.passInstance.update.mockResolvedValue({})

    const { performRewardRedeem } = await import("./route")

    await performRewardRedeem(makeReward({ revealedAt: null }), "user-1")
    expect(mockDb._tx.reward.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revealedAt: expect.any(Date) }),
      }),
    )

    await performRewardRedeem(makeReward(), "user-1")
    const lastData = mockDb._tx.reward.updateMany.mock.calls.at(-1)?.[0]?.data
    expect(lastData).not.toHaveProperty("revealedAt")
  })

  it("marks the pass instance COMPLETED only for single-use coupons", async () => {
    mockDb._tx.reward.updateMany.mockResolvedValue({ count: 1 })
    mockDb._tx.passInstance.findUnique.mockResolvedValue({ data: {} })
    mockDb._tx.passInstance.update.mockResolvedValue({})

    const { performRewardRedeem } = await import("./route")

    await performRewardRedeem(makeSingleUseCouponReward(), "user-1")
    expect(mockDb._tx.passInstance.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }),
    )

    await performRewardRedeem(makeReward(), "user-1") // stamp card — no status change
    const lastData = mockDb._tx.passInstance.update.mock.calls.at(-1)?.[0]?.data
    expect(lastData).not.toHaveProperty("status")
  })

  it("skips the pass instance update when the reward has no pass instance", async () => {
    mockDb._tx.reward.updateMany.mockResolvedValue({ count: 1 })

    const { performRewardRedeem } = await import("./route")
    await performRewardRedeem(makeReward({ passInstanceId: null, passInstance: null }), "user-1")

    expect(mockDb._tx.passInstance.findUnique).not.toHaveBeenCalled()
    expect(mockDb._tx.passInstance.update).not.toHaveBeenCalled()
  })
})

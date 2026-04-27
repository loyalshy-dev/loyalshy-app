import { describe, it, expect, vi, beforeEach } from "vitest"
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
    parseMinigameConfig: () => null,
    weightedRandomPrize: () => "prize",
  }))
})

// ─── Fixtures ───────────────────────────────────────────────

function makeStampPass() {
  return {
    id: "pi-1",
    walletProvider: "NONE",
    passTemplate: {
      id: "pt-1",
      name: "Stamp Card",
      passType: "STAMP_CARD" as const,
      config: { stampsRequired: 10 },
      status: "ACTIVE" as const,
      endsAt: null,
    },
    contact: {
      id: "c-1",
      organizationId: "org-1",
      deletedAt: null,
      totalInteractions: 0,
    },
  }
}

function makeCouponPass(redemptionLimit: "single" | "unlimited" = "single") {
  return {
    id: "pi-2",
    walletProvider: "NONE",
    passTemplate: {
      id: "pt-2",
      name: "Coupon",
      passType: "COUPON" as const,
      config: { couponConfig: { redemptionLimit } },
      status: "ACTIVE" as const,
      endsAt: null,
    },
    contact: {
      id: "c-1",
      organizationId: "org-1",
      deletedAt: null,
      totalInteractions: 0,
    },
  }
}

// ─── performStamp ───────────────────────────────────────────

describe("performStamp — concurrency safety", () => {
  it("acquires FOR UPDATE row lock before reading interaction history", async () => {
    mockDb._tx.passInstance.findUnique.mockResolvedValue({
      data: { currentCycleVisits: 1, totalVisits: 1 },
    })
    mockDb._tx.interaction.findFirst.mockResolvedValue(null)
    mockDb._tx.interaction.create.mockResolvedValue({ id: "int-new" })
    mockDb._tx.passInstance.update.mockResolvedValue({})
    mockDb._tx.contact.update.mockResolvedValue({})
    mockDb._tx.$queryRaw.mockResolvedValue([])

    const { performStamp } = await import("./route")
    await performStamp(makeStampPass(), "user-1")

    const lockOrder = mockDb._tx.$queryRaw.mock.invocationCallOrder[0]
    const findUniqueOrder = mockDb._tx.passInstance.findUnique.mock.invocationCallOrder[0]
    const findRecentOrder = mockDb._tx.interaction.findFirst.mock.invocationCallOrder[0]

    expect(lockOrder).toBeLessThan(findUniqueOrder)
    expect(lockOrder).toBeLessThan(findRecentOrder)
  })

  it("rejects with 409 when a recent stamp exists (simulates losing tx)", async () => {
    mockDb._tx.passInstance.findUnique.mockResolvedValue({
      data: { currentCycleVisits: 1, totalVisits: 1 },
    })
    // Winning tx has already committed an interaction <60s ago
    mockDb._tx.interaction.findFirst.mockResolvedValue({ id: "int-existing" })
    mockDb._tx.$queryRaw.mockResolvedValue([])

    const { performStamp } = await import("./route")

    await expect(performStamp(makeStampPass(), "user-1")).rejects.toMatchObject({
      status: 409,
      title: "Conflict",
    })
    expect(mockDb._tx.interaction.create).not.toHaveBeenCalled()
    expect(mockDb._tx.passInstance.update).not.toHaveBeenCalled()
  })

  it("two sequential calls — second sees the first's interaction and rejects", async () => {
    // Simulate the lock serializing: first call sees no recent stamp,
    // second call (after first has 'committed') sees the new interaction.
    mockDb._tx.passInstance.findUnique.mockResolvedValue({
      data: { currentCycleVisits: 0, totalVisits: 0 },
    })
    mockDb._tx.interaction.findFirst
      .mockResolvedValueOnce(null) // first caller — no recent
      .mockResolvedValueOnce({ id: "int-from-first" }) // second caller blocked, then sees it
    mockDb._tx.interaction.create.mockResolvedValue({ id: "int-from-first" })
    mockDb._tx.passInstance.update.mockResolvedValue({})
    mockDb._tx.contact.update.mockResolvedValue({})
    mockDb._tx.$queryRaw.mockResolvedValue([])

    const { performStamp } = await import("./route")

    await performStamp(makeStampPass(), "user-1") // winner
    await expect(performStamp(makeStampPass(), "user-1")).rejects.toMatchObject({ status: 409 })

    expect(mockDb._tx.interaction.create).toHaveBeenCalledTimes(1)
  })
})

// ─── performRedeemCoupon ────────────────────────────────────

describe("performRedeemCoupon — concurrency safety", () => {
  it("acquires FOR UPDATE row lock before reading state", async () => {
    mockDb._tx.passInstance.findUnique.mockResolvedValue({ data: { redeemed: false } })
    mockDb._tx.passInstance.update.mockResolvedValue({})
    mockDb._tx.reward.findFirst.mockResolvedValue(null)
    mockDb._tx.interaction.create.mockResolvedValue({ id: "int" })
    mockDb._tx.contact.update.mockResolvedValue({})
    mockDb._tx.$queryRaw.mockResolvedValue([])

    const { performRedeemCoupon } = await import("./route")
    await performRedeemCoupon(makeCouponPass("single"), "user-1")

    const lockOrder = mockDb._tx.$queryRaw.mock.invocationCallOrder[0]
    const findUniqueOrder = mockDb._tx.passInstance.findUnique.mock.invocationCallOrder[0]
    expect(lockOrder).toBeLessThan(findUniqueOrder)
  })

  it("single-use: rejects with 409 when redeemed=true (simulates losing tx)", async () => {
    mockDb._tx.passInstance.findUnique.mockResolvedValue({
      data: { redeemed: true, redeemedAt: new Date().toISOString() },
    })
    mockDb._tx.$queryRaw.mockResolvedValue([])

    const { performRedeemCoupon } = await import("./route")

    await expect(performRedeemCoupon(makeCouponPass("single"), "user-1")).rejects.toMatchObject({
      status: 409,
      detail: expect.stringContaining("already redeemed"),
    })
    expect(mockDb._tx.passInstance.update).not.toHaveBeenCalled()
    expect(mockDb._tx.interaction.create).not.toHaveBeenCalled()
  })

  it("unlimited: rejects with 409 if redeemed within last 60 seconds", async () => {
    mockDb._tx.passInstance.findUnique.mockResolvedValue({
      data: {
        redeemed: true,
        redeemedAt: new Date(Date.now() - 5_000).toISOString(),
      },
    })
    mockDb._tx.$queryRaw.mockResolvedValue([])

    const { performRedeemCoupon } = await import("./route")

    await expect(performRedeemCoupon(makeCouponPass("unlimited"), "user-1")).rejects.toMatchObject({
      status: 409,
      detail: expect.stringContaining("less than a minute ago"),
    })
    expect(mockDb._tx.passInstance.update).not.toHaveBeenCalled()
  })

  it("unlimited: allows redeem when last redemption was >60 seconds ago", async () => {
    mockDb._tx.passInstance.findUnique.mockResolvedValue({
      data: {
        redeemed: true,
        redeemedAt: new Date(Date.now() - 120_000).toISOString(),
      },
    })
    mockDb._tx.passInstance.update.mockResolvedValue({})
    mockDb._tx.passInstance.create.mockResolvedValue({ id: "pi-new" })
    mockDb._tx.reward.findFirst.mockResolvedValue(null)
    mockDb._tx.reward.create.mockResolvedValue({})
    mockDb._tx.interaction.create.mockResolvedValue({ id: "int" })
    mockDb._tx.contact.update.mockResolvedValue({})
    mockDb._tx.$queryRaw.mockResolvedValue([])

    const { performRedeemCoupon } = await import("./route")
    await performRedeemCoupon(makeCouponPass("unlimited"), "user-1")

    expect(mockDb._tx.passInstance.update).toHaveBeenCalled()
    expect(mockDb._tx.passInstance.create).toHaveBeenCalled() // re-issued
  })
})

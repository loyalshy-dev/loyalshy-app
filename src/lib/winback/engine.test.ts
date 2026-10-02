import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Prisma } from "@prisma/client"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb
const notifyApple = vi.fn()
const notifyGoogle = vi.fn()

// 10:30 in Madrid
const AT_SEND_HOUR = new Date("2026-06-10T08:30:00Z")
const NOT_SEND_HOUR = new Date("2026-06-10T13:30:00Z")
const COUPON_UNLIMITED = { redemptionLimit: "unlimited", discountType: "percentage", discountValue: 10 }
const COUPON_SINGLE = { ...COUPON_UNLIMITED, redemptionLimit: "single" }

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  notifyApple.mockReset().mockResolvedValue(undefined)
  notifyGoogle.mockReset().mockResolvedValue(undefined)
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/wallet/apple/update-pass", () => ({ notifyApplePassUpdate: notifyApple }))
  vi.doMock("@/lib/wallet/google/update-pass", () => ({ notifyGooglePassUpdate: notifyGoogle }))
  vi.stubEnv("WINBACK_TEST_INACTIVE_MINUTES", "")
  mockDb.winbackSettings.findMany.mockResolvedValue([settingsRow()])
  mockDb.winbackSend.create.mockResolvedValue({})
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org-1",
    inactiveDays: 30,
    message: "¡Te echamos de menos!",
    holdout: false,
    includeExisting: true,
    startedAt: new Date("2026-05-01T00:00:00Z"),
    organization: { plan: "STARTER", subscriptionStatus: "ACTIVE", timezone: "Europe/Madrid" },
    ...overrides,
  }
}

function interactionOn(id: string, walletProvider: string, passType: string, config: unknown = {}) {
  return { passInstance: { id, walletProvider, passTemplate: { passType, config } } }
}

async function run(now: Date = AT_SEND_HOUR) {
  const { runWinback } = await import("./engine")
  return runWinback(now)
}

describe("runWinback", () => {
  it("only runs for an org at its local 10:00", async () => {
    mockDb.$queryRaw.mockResolvedValue([])
    expect(await run(NOT_SEND_HOUR)).toEqual([])
    expect(mockDb.$queryRaw).not.toHaveBeenCalled()
    expect(await run(AT_SEND_HOUR)).toHaveLength(1)
  })

  it("skips orgs that may not use win-back", async () => {
    mockDb.winbackSettings.findMany.mockResolvedValue([
      settingsRow({ organization: { plan: "FREE", subscriptionStatus: "ACTIVE", timezone: "Europe/Madrid" } }),
    ])
    mockDb.member.findFirst.mockResolvedValue(null)
    expect(await run()).toEqual([])
  })

  it("records the absence and pushes the most recently used eligible pass", async () => {
    const lapse = new Date("2026-05-01T09:00:00Z")
    mockDb.$queryRaw.mockResolvedValue([{ id: "c-1", lastInteractionAt: lapse }])
    mockDb.interaction.findMany.mockResolvedValue([
      interactionOn("pi-single", "APPLE", "COUPON", COUPON_SINGLE), // not eligible
      interactionOn("pi-google", "GOOGLE", "STAMP_CARD"),
    ])

    const [result] = await run()
    expect(result).toMatchObject({ candidates: 1, sent: 1, control: 0, unreachable: 0 })
    expect(mockDb.winbackSend.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: "c-1",
        passInstanceId: "pi-google",
        lapseKey: lapse,
        control: false,
        reachable: true,
        message: "¡Te echamos de menos!",
      }),
    })
    expect(notifyGoogle).toHaveBeenCalledWith("pi-google")
    expect(notifyApple).not.toHaveBeenCalled()
  })

  it("unlimited coupons can carry it too", async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: "c-1", lastInteractionAt: new Date("2026-05-01T09:00:00Z") }])
    mockDb.interaction.findMany.mockResolvedValue([interactionOn("pi-coupon", "APPLE", "COUPON", COUPON_UNLIMITED)])
    const [result] = await run()
    expect(result.sent).toBe(1)
    expect(notifyApple).toHaveBeenCalledWith("pi-coupon")
  })

  it("marks customers without a wallet pass as unreachable, without pushing", async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: "c-1", lastInteractionAt: new Date("2026-05-01T09:00:00Z") }])
    mockDb.interaction.findMany.mockResolvedValue([])
    const [result] = await run()
    expect(result).toMatchObject({ unreachable: 1, sent: 0 })
    expect(mockDb.winbackSend.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ passInstanceId: null, reachable: false, control: false }),
    })
    expect(notifyApple).not.toHaveBeenCalled()
  })

  it("holds back the comparison group: a row, no push", async () => {
    // Find a contact id that lands in the 10% comparison group.
    const { isHoldout } = await import("./timing")
    const lapse = new Date("2026-05-01T09:00:00Z")
    let id = ""
    for (let i = 0; !id; i++) if (isHoldout(`c-${i}`, lapse)) id = `c-${i}`

    mockDb.winbackSettings.findMany.mockResolvedValue([settingsRow({ holdout: true })])
    mockDb.$queryRaw.mockResolvedValue([{ id, lastInteractionAt: lapse }])
    mockDb.interaction.findMany.mockResolvedValue([interactionOn("pi-1", "APPLE", "STAMP_CARD")])

    const [result] = await run()
    expect(result).toMatchObject({ control: 1, sent: 0 })
    expect(mockDb.winbackSend.create).toHaveBeenCalledWith({ data: expect.objectContaining({ control: true }) })
    expect(notifyApple).not.toHaveBeenCalled()
  })

  it("skips an absence another run already handled", async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: "c-1", lastInteractionAt: new Date("2026-05-01T09:00:00Z") }])
    mockDb.interaction.findMany.mockResolvedValue([interactionOn("pi-1", "APPLE", "STAMP_CARD")])
    mockDb.winbackSend.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" }),
    )
    const [result] = await run()
    expect(result).toMatchObject({ sent: 0, control: 0, unreachable: 0 })
    expect(notifyApple).not.toHaveBeenCalled()
  })

  it("counts a failed push without failing the run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockDb.$queryRaw.mockResolvedValue([{ id: "c-1", lastInteractionAt: new Date("2026-05-01T09:00:00Z") }])
    mockDb.interaction.findMany.mockResolvedValue([interactionOn("pi-1", "APPLE", "STAMP_CARD")])
    notifyApple.mockRejectedValue(new Error("apns down"))
    const [result] = await run()
    expect(result).toMatchObject({ sent: 0, failedPushes: 1 })
  })

  it("test hook ignores the send hour", async () => {
    vi.stubEnv("WINBACK_TEST_INACTIVE_MINUTES", "2")
    mockDb.$queryRaw.mockResolvedValue([])
    expect(await run(NOT_SEND_HOUR)).toHaveLength(1)
  })
})

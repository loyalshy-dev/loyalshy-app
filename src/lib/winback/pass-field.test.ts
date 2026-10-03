import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  mockDb.winbackSettings.findUnique.mockResolvedValue({
    enabled: true,
    organization: { plan: "GROWTH", subscriptionStatus: "ACTIVE" },
  })
})

async function load(lastInteractionAt: Date | null, passType = "STAMP_CARD", templateConfig: unknown = {}) {
  const { loadWinbackPassField } = await import("./pass-field")
  return loadWinbackPassField({ organizationId: "org-1", passInstanceId: "pi-1", passType, templateConfig, lastInteractionAt })
}

describe("loadWinbackPassField", () => {
  const lastVisit = new Date(Date.now() - 40 * 86_400_000)

  it("placeholder when nothing was sent since the last visit", async () => {
    mockDb.winbackSend.findFirst.mockResolvedValue(null)
    expect(await load(lastVisit)).toEqual({ message: null, fresh: false, sendId: null })
    expect(mockDb.winbackSend.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { passInstanceId: "pi-1", control: false, reachable: true, sentAt: { gt: lastVisit } },
      }),
    )
  })

  it("the message, notifying for 24h after the send", async () => {
    mockDb.winbackSend.findFirst.mockResolvedValue({ id: "s-1", message: "¡Vuelve!", sentAt: new Date(Date.now() - 3_600_000) })
    expect(await load(lastVisit)).toEqual({ message: "¡Vuelve!", fresh: true, sendId: "s-1" })

    mockDb.winbackSend.findFirst.mockResolvedValue({ id: "s-1", message: "¡Vuelve!", sentAt: new Date(Date.now() - 30 * 3_600_000) })
    expect(await load(lastVisit)).toEqual({ message: "¡Vuelve!", fresh: false, sendId: "s-1" })
  })

  it("nothing when off, and never on single-use coupons", async () => {
    mockDb.winbackSettings.findUnique.mockResolvedValue({ enabled: false, organization: { plan: "GROWTH", subscriptionStatus: "ACTIVE" } })
    expect(await load(lastVisit)).toBeNull()
    expect(await load(lastVisit, "COUPON", { redemptionLimit: "single", discountType: "percentage", discountValue: 5 })).toBeNull()
  })

  it("a lookup failure drops the field instead of failing the pass update", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockDb.winbackSettings.findUnique.mockRejectedValue(new Error("db blip"))
    expect(await load(lastVisit)).toBeNull()
  })
})

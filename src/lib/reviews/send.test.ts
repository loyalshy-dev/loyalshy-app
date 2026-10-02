import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb
const notifyApple = vi.fn()
const notifyGoogle = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  notifyApple.mockReset()
  notifyGoogle.mockReset()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/wallet/apple/update-pass", () => ({ notifyApplePassUpdate: notifyApple }))
  vi.doMock("@/lib/wallet/google/update-pass", () => ({ notifyGooglePassUpdate: notifyGoogle }))
  vi.doMock("@/lib/env", () => ({ env: () => ({ BETTER_AUTH_SECRET: "s" }) }))
})

function pass(overrides: Record<string, unknown> = {}) {
  return {
    id: "pi-1",
    status: "ACTIVE",
    walletProvider: "APPLE",
    contactId: "c-1",
    data: { totalVisits: 3 },
    passTemplate: { organizationId: "org-1", passType: "STAMP_CARD", config: { stampsRequired: 10 } },
    contact: { reviewPromptedAt: null, deletedAt: null },
    ...overrides,
  }
}

const SINGLE_COUPON = { redemptionLimit: "single", discountType: "percentage", discountValue: 10 }
const UNLIMITED_COUPON = { ...SINGLE_COUPON, redemptionLimit: "unlimited" }

function liveSettings(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    reviewUrl: "https://search.google.com/local/writereview?placeid=P",
    triggerStamp: 3,
    message: "¿Qué tal?",
    linkLabel: "Reseña",
    organization: { name: "Café", timezone: "Europe/Madrid", plan: "STARTER", subscriptionStatus: "ACTIVE" },
    ...overrides,
  }
}

async function send() {
  const { sendReviewPrompt } = await import("./send")
  return sendReviewPrompt({ contactId: "c-1", passInstanceId: "pi-1" })
}

describe("sendReviewPrompt", () => {
  it("claims the contact and pushes the Apple pass", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(pass())
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(liveSettings())
    mockDb.contact.updateMany.mockResolvedValue({ count: 1 })

    expect(await send()).toEqual({ sent: true, provider: "APPLE" })
    expect(mockDb.contact.updateMany).toHaveBeenCalledWith({
      where: { id: "c-1", reviewPromptedAt: null },
      data: { reviewPromptedAt: expect.any(Date), reviewPromptPassId: "pi-1" },
    })
    expect(notifyApple).toHaveBeenCalledWith("pi-1")
    expect(notifyGoogle).not.toHaveBeenCalled()
  })

  it("uses the Google path for Google passes", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(pass({ walletProvider: "GOOGLE" }))
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(liveSettings())
    mockDb.contact.updateMany.mockResolvedValue({ count: 1 })

    expect(await send()).toEqual({ sent: true, provider: "GOOGLE" })
    expect(notifyGoogle).toHaveBeenCalledWith("pi-1")
  })

  it("skips when the triggering stamp was undone", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(pass({ data: { totalVisits: 2 } }))
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(liveSettings())

    expect(await send()).toEqual({ sent: false, reason: "belowTrigger" })
    expect(mockDb.contact.updateMany).not.toHaveBeenCalled()
  })

  it("skips when the feature was turned off or the plan lapsed", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(pass())
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(liveSettings({ enabled: false }))
    expect(await send()).toEqual({ sent: false, reason: "featureOff" })

    mockDb.googleReviewSettings.findUnique.mockResolvedValue(
      liveSettings({ organization: { name: "C", timezone: "UTC", plan: "FREE", subscriptionStatus: "ACTIVE" } }),
    )
    expect(await send()).toEqual({ sent: false, reason: "featureOff" })
    expect(notifyApple).not.toHaveBeenCalled()
  })

  it("sends for a Free org owned by a platform admin", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(pass())
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(
      liveSettings({ organization: { name: "C", timezone: "UTC", plan: "FREE", subscriptionStatus: "ACTIVE" } }),
    )
    mockDb.member.findFirst.mockResolvedValue({ id: "m-admin" })
    mockDb.contact.updateMany.mockResolvedValue({ count: 1 })

    expect(await send()).toEqual({ sent: true, provider: "APPLE" })
  })

  it("counts redemptions on an unlimited coupon", async () => {
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(liveSettings())
    mockDb.contact.updateMany.mockResolvedValue({ count: 1 })
    const coupon = { organizationId: "org-1", passType: "COUPON", config: UNLIMITED_COUPON }

    mockDb.passInstance.findUnique.mockResolvedValue(pass({ passTemplate: coupon, data: { redeemCount: 2 } }))
    expect(await send()).toEqual({ sent: false, reason: "belowTrigger" })

    mockDb.passInstance.findUnique.mockResolvedValue(pass({ passTemplate: coupon, data: { redeemCount: 3 } }))
    expect(await send()).toEqual({ sent: true, provider: "APPLE" })
  })

  it("sends at most once when another run claimed it first", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(pass())
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(liveSettings())
    mockDb.contact.updateMany.mockResolvedValue({ count: 0 })

    expect(await send()).toEqual({ sent: false, reason: "alreadyPrompted" })
    expect(notifyApple).not.toHaveBeenCalled()
  })

  it("never asks twice or asks for removed contacts and other passes", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(pass({ contact: { reviewPromptedAt: new Date(), deletedAt: null } }))
    expect(await send()).toEqual({ sent: false, reason: "alreadyPrompted" })

    mockDb.passInstance.findUnique.mockResolvedValue(pass({ contactId: "someone-else" }))
    expect(await send()).toEqual({ sent: false, reason: "passNotFound" })

    mockDb.passInstance.findUnique.mockResolvedValue(
      pass({ passTemplate: { organizationId: "org-1", passType: "COUPON", config: SINGLE_COUPON } }),
    )
    expect(await send()).toEqual({ sent: false, reason: "notEligible" })
  })

  it("releases the claim when the push throws, so the retry can send", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(pass())
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(liveSettings())
    mockDb.contact.updateMany.mockResolvedValue({ count: 1 })
    notifyApple.mockRejectedValue(new Error("apns down"))

    await expect(send()).rejects.toThrow("apns down")
    expect(mockDb.contact.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { reviewPromptedAt: null, reviewPromptPassId: null },
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb
let afterTasks: (() => Promise<void>)[]
const trigger = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  afterTasks = []
  trigger.mockReset()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/env", () => ({ env: () => ({ BETTER_AUTH_SECRET: "s" }) }))
  vi.doMock("next/server", () => ({ after: (fn: () => Promise<void>) => afterTasks.push(fn) }))
  vi.doMock("@trigger.dev/sdk", () => ({ tasks: { trigger } }))
  vi.stubEnv("TRIGGER_SECRET_KEY", "tr_test")
  vi.stubEnv("REVIEW_PROMPT_DELAY_SECONDS", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const settings = {
  enabled: true,
  reviewUrl: "https://g.page/r/a/review",
  triggerStamp: 3,
  message: "m",
  linkLabel: "l",
  organization: { name: "Café", timezone: "Europe/Madrid", plan: "GROWTH", subscriptionStatus: "ACTIVE" },
}

async function schedule(
  overrides: Partial<{ walletProvider: string; passType: string; templateConfig: unknown; newVisitCount: number }> = {},
) {
  const { maybeScheduleReviewPrompt } = await import("./schedule")
  maybeScheduleReviewPrompt({
    organizationId: "org-1",
    contactId: "c-1",
    passInstanceId: "pi-1",
    walletProvider: "APPLE",
    passType: "STAMP_CARD",
    templateConfig: { stampsRequired: 10 },
    newVisitCount: 3,
    ...overrides,
  })
  for (const task of afterTasks) await task()
}

describe("maybeScheduleReviewPrompt", () => {
  it("schedules a delayed run once the trigger is reached", async () => {
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(settings)
    mockDb.contact.findUnique.mockResolvedValue({ reviewPromptedAt: null, deletedAt: null })

    await schedule()
    expect(trigger).toHaveBeenCalledWith(
      "send-review-prompt",
      { contactId: "c-1", passInstanceId: "pi-1" },
      { delay: expect.any(Date) },
    )
  })

  it("also asks customers already past the trigger", async () => {
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(settings)
    mockDb.contact.findUnique.mockResolvedValue({ reviewPromptedAt: null, deletedAt: null })
    await schedule({ newVisitCount: 12 })
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it("does nothing below the trigger, once asked, or without a wallet pass", async () => {
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(settings)
    mockDb.contact.findUnique.mockResolvedValue({ reviewPromptedAt: null, deletedAt: null })
    await schedule({ newVisitCount: 2 })

    mockDb.contact.findUnique.mockResolvedValue({ reviewPromptedAt: new Date(), deletedAt: null })
    await schedule()

    await schedule({ walletProvider: "NONE" })
    await schedule({ passType: "COUPON", templateConfig: { redemptionLimit: "single", discountType: "percentage", discountValue: 10 } })
    expect(trigger).not.toHaveBeenCalled()
  })

  it("does nothing on a plan without review prompts", async () => {
    mockDb.googleReviewSettings.findUnique.mockResolvedValue({
      ...settings,
      organization: { ...settings.organization, plan: "FREE" },
    })
    mockDb.contact.findUnique.mockResolvedValue({ reviewPromptedAt: null, deletedAt: null })
    await schedule()
    expect(trigger).not.toHaveBeenCalled()
  })

  it("honours the test delay override", async () => {
    vi.stubEnv("REVIEW_PROMPT_DELAY_SECONDS", "60")
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(settings)
    mockDb.contact.findUnique.mockResolvedValue({ reviewPromptedAt: null, deletedAt: null })
    const before = Date.now()
    await schedule()
    const delay = (trigger.mock.calls[0][2] as { delay: Date }).delay.getTime() - before
    expect(delay).toBeGreaterThanOrEqual(59_000)
    expect(delay).toBeLessThan(65_000)
  })

  it("schedules for an unlimited coupon once its redemptions reach the trigger", async () => {
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(settings)
    mockDb.contact.findUnique.mockResolvedValue({ reviewPromptedAt: null, deletedAt: null })
    await schedule({
      passType: "COUPON",
      templateConfig: { redemptionLimit: "unlimited", discountType: "percentage", discountValue: 10 },
      newVisitCount: 3,
    })
    expect(trigger).toHaveBeenCalledTimes(1)
  })
})

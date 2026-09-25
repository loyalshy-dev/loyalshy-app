import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// ─── Module mocks ─────────────────────────────────────────────

let mockDb: MockDb
const mockAssertOrganizationRole = vi.fn()
const mockGetOrganizationForUser = vi.fn()
const mockGetCurrentUser = vi.fn()
const mockSendGoogleClassAnnouncement = vi.fn()
const mockNotifyApple = vi.fn()
const mockNotifyGoogle = vi.fn()

const ORG = {
  id: "org-1",
  name: "Café Central",
  slug: "cafe-central",
  plan: "GROWTH",
  subscriptionStatus: "ACTIVE",
}
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.resetModules()

  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/dal", () => ({
    assertOrganizationRole: mockAssertOrganizationRole,
    getOrganizationForUser: mockGetOrganizationForUser,
    getCurrentUser: mockGetCurrentUser,
  }))
  vi.doMock("@/lib/wallet/google/announce", () => ({
    sendGoogleClassAnnouncement: mockSendGoogleClassAnnouncement,
  }))
  vi.doMock("@/lib/wallet/apple/update-pass", () => ({
    notifyApplePassUpdate: mockNotifyApple,
  }))
  vi.doMock("@/lib/wallet/google/update-pass", () => ({
    notifyGooglePassUpdate: mockNotifyGoogle,
  }))
  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
  vi.doMock("next-intl/server", () => ({
    getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  }))

  mockAssertOrganizationRole.mockReset()
  mockAssertOrganizationRole.mockResolvedValue(undefined)
  mockGetOrganizationForUser.mockReset()
  mockGetOrganizationForUser.mockResolvedValue(ORG)
  mockGetCurrentUser.mockReset()
  mockGetCurrentUser.mockResolvedValue({ user: { id: "user-1" } })
  mockSendGoogleClassAnnouncement.mockReset()
  mockSendGoogleClassAnnouncement.mockResolvedValue(undefined)
  mockNotifyApple.mockReset()
  mockNotifyGoogle.mockReset()

  delete process.env.TRIGGER_SECRET_KEY
})

function mockActiveTemplate(opts: { weeklySends?: Date[]; lifetimeSends?: number; programSends?: number } = {}) {
  mockDb.passTemplate.findFirst.mockResolvedValue({
    id: "tpl-1",
    name: "Coffee Card",
    status: "ACTIVE",
  })
  const tx = mockDb._tx
  tx.$executeRaw.mockResolvedValue(1)
  tx.programAnnouncement.findMany.mockResolvedValue(
    (opts.weeklySends ?? []).map((createdAt) => ({ createdAt }))
  )
  // First count() = lifetime (Free only), otherwise the per-program 24h count
  tx.programAnnouncement.count.mockImplementation(({ where }: { where: { passTemplateId?: string } }) =>
    Promise.resolve(where.passTemplateId ? (opts.programSends ?? 0) : (opts.lifetimeSends ?? 0))
  )
  tx.programAnnouncement.create.mockResolvedValue({ id: "ann-1" })
  tx.passTemplate.update.mockResolvedValue({ id: "tpl-1" })
  tx.passInstance.count.mockResolvedValue(7)
  mockDb.passInstance.findMany.mockResolvedValue([])
}

// ─── sendProgramAnnouncement ─────────────────────────────────

describe("sendProgramAnnouncement", () => {
  it("rejects an empty message", async () => {
    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "   " })

    expect(result).toEqual({ error: "invalidInput" })
    expect(mockDb.passTemplate.update).not.toHaveBeenCalled()
  })

  it("rejects a message over 160 characters", async () => {
    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({
      templateId: "tpl-1",
      message: "x".repeat(161),
    })

    expect(result).toEqual({ error: "invalidInput" })
  })

  it("rejects when the template belongs to another org (not found)", async () => {
    mockDb.passTemplate.findFirst.mockResolvedValue(null)

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-other", message: "2x1 today" })

    expect(result).toEqual({ error: "templateNotFound" })
    expect(mockDb.passTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-other", organizationId: ORG.id },
      })
    )
  })

  it("rejects non-active programs", async () => {
    mockDb.passTemplate.findFirst.mockResolvedValue({
      id: "tpl-1",
      name: "Coffee Card",
      status: "DRAFT",
      announcement: null,
    })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toEqual({ error: "announcementProgramNotActive" })
  })

  it("enforces the weekly plan quota per organization (Business = 2 / 7 days)", async () => {
    const oldest = new Date(Date.now() - 2 * DAY)
    mockActiveTemplate({ weeklySends: [oldest, new Date(Date.now() - DAY)] })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toEqual({
      error: "announcementQuotaReachedWeek",
      code: "quotaReached",
      nextAvailableAt: new Date(oldest.getTime() + 7 * DAY).toISOString(),
    })
    expect(mockDb._tx.programAnnouncement.create).not.toHaveBeenCalled()
    expect(mockSendGoogleClassAnnouncement).not.toHaveBeenCalled()
    // Window is org-wide, not per template
    expect(mockDb._tx.programAnnouncement.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ organizationId: ORG.id })
    )
  })

  it("counts lifetime sends on the Free plan", async () => {
    mockGetOrganizationForUser.mockResolvedValue({ ...ORG, plan: "FREE" })
    mockActiveTemplate({ lifetimeSends: 2 })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toEqual({
      error: "announcementQuotaReachedFree",
      code: "quotaReached",
      nextAvailableAt: null,
    })
  })

  it("allows the Free plan's second announcement", async () => {
    mockGetOrganizationForUser.mockResolvedValue({ ...ORG, plan: "FREE" })
    mockActiveTemplate({ lifetimeSends: 1 })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toEqual({ success: true, recipients: 7, remaining: 0 })
  })

  it("blocks sends when the subscription is inactive", async () => {
    mockGetOrganizationForUser.mockResolvedValue({ ...ORG, subscriptionStatus: "PAST_DUE" })
    mockActiveTemplate()

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toMatchObject({ code: "subscriptionInactive" })
  })

  it("keeps Google's 3-per-24h cap per program even on unlimited plans", async () => {
    mockGetOrganizationForUser.mockResolvedValue({ ...ORG, plan: "ENTERPRISE" })
    mockActiveTemplate({ programSends: 3 })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toMatchObject({ error: "announcementProgramDailyCap", code: "programDailyCap" })
  })

  it("stores the announcement, notifies Google via class PATCH, and returns recipients", async () => {
    mockActiveTemplate()

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toEqual({ success: true, recipients: 7, remaining: 1 })

    const updateArg = mockDb._tx.passTemplate.update.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: "tpl-1" })
    expect(updateArg.data.announcement.message).toBe("2x1 today")

    expect(mockDb._tx.programAnnouncement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG.id,
        passTemplateId: "tpl-1",
        sentById: "user-1",
        message: "2x1 today",
        recipients: 7,
      }),
    })

    expect(mockSendGoogleClassAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "tpl-1",
        organizationName: ORG.name,
        message: "2x1 today",
      })
    )
  })

  it("still succeeds when the Google class PATCH throws", async () => {
    mockActiveTemplate()
    mockSendGoogleClassAnnouncement.mockRejectedValue(new Error("wallet API down"))

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toEqual({ success: true, recipients: 7, remaining: 1 })
  })

  it("refuses to send (and doesn't consume quota) when no one holds the pass", async () => {
    mockGetOrganizationForUser.mockResolvedValue({ ...ORG, plan: "FREE" })
    mockActiveTemplate({ lifetimeSends: 0 })
    mockDb._tx.passInstance.count.mockResolvedValue(0)

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toMatchObject({ error: "announcementNoRecipients", code: "noRecipients" })
    expect(mockDb._tx.programAnnouncement.create).not.toHaveBeenCalled()
    expect(mockSendGoogleClassAnnouncement).not.toHaveBeenCalled()
  })

  it("doesn't suggest a self-serve upgrade when Scale runs out", async () => {
    mockGetOrganizationForUser.mockResolvedValue({ ...ORG, plan: "SCALE" })
    const sends = Array.from({ length: 5 }, (_, i) => new Date(Date.now() - (5 - i) * 60_000))
    mockActiveTemplate({ weeklySends: sends })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toMatchObject({
      error: "announcementQuotaReachedWeekTopPlan",
      code: "quotaReached",
    })
  })

  it("ignores sends that fell out of the rolling 7-day window", async () => {
    // Only in-window rows are returned by the query; one send left on Business
    mockActiveTemplate({ weeklySends: [new Date(Date.now() - DAY)] })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "new offer" })

    expect(result).toEqual({ success: true, recipients: 7, remaining: 0 })
    const where = mockDb._tx.programAnnouncement.findMany.mock.calls[0][0].where
    expect(Date.now() - where.createdAt.gt.getTime()).toBeGreaterThanOrEqual(7 * DAY - 1000)
  })
})

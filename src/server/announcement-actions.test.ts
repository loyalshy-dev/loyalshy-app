import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// ─── Module mocks ─────────────────────────────────────────────

let mockDb: MockDb
const mockAssertOrganizationRole = vi.fn()
const mockGetOrganizationForUser = vi.fn()
const mockSendGoogleClassAnnouncement = vi.fn()
const mockNotifyApple = vi.fn()
const mockNotifyGoogle = vi.fn()

const ORG = { id: "org-1", name: "Café Central", slug: "cafe-central" }

beforeEach(() => {
  vi.resetModules()

  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/dal", () => ({
    assertOrganizationRole: mockAssertOrganizationRole,
    getOrganizationForUser: mockGetOrganizationForUser,
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
  mockSendGoogleClassAnnouncement.mockReset()
  mockSendGoogleClassAnnouncement.mockResolvedValue(undefined)
  mockNotifyApple.mockReset()
  mockNotifyGoogle.mockReset()

  delete process.env.TRIGGER_SECRET_KEY
})

function mockActiveTemplate(announcement: unknown = null) {
  mockDb.passTemplate.findFirst.mockResolvedValue({
    id: "tpl-1",
    name: "Coffee Card",
    status: "ACTIVE",
    announcement,
  })
  mockDb.passTemplate.update.mockResolvedValue({ id: "tpl-1" })
  mockDb.passInstance.count.mockResolvedValue(7)
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

  it("enforces the 3-per-24h quota", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    mockActiveTemplate({
      message: "old",
      sentAt: recent,
      history: [recent, recent, recent],
    })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toEqual({ error: "announcementQuotaReached", remainingQuota: 0 })
    expect(mockDb.passTemplate.update).not.toHaveBeenCalled()
    expect(mockSendGoogleClassAnnouncement).not.toHaveBeenCalled()
  })

  it("ignores quota entries older than 24h", async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    mockActiveTemplate({ message: "old", sentAt: stale, history: [stale, stale, stale] })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toEqual({ success: true, recipients: 7 })
  })

  it("stores the announcement, notifies Google via class PATCH, and returns recipients", async () => {
    mockActiveTemplate()

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "2x1 today" })

    expect(result).toEqual({ success: true, recipients: 7 })

    const updateArg = mockDb.passTemplate.update.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: "tpl-1" })
    expect(updateArg.data.announcement.message).toBe("2x1 today")
    expect(updateArg.data.announcement.history).toHaveLength(1)

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

    expect(result).toEqual({ success: true, recipients: 7 })
  })

  it("appends to existing recent history within quota", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    mockActiveTemplate({ message: "old", sentAt: recent, history: [recent] })

    const { sendProgramAnnouncement } = await import("./announcement-actions")
    const result = await sendProgramAnnouncement({ templateId: "tpl-1", message: "new offer" })

    expect(result).toEqual({ success: true, recipients: 7 })
    const updateArg = mockDb.passTemplate.update.mock.calls[0][0]
    expect(updateArg.data.announcement.history).toHaveLength(2)
    expect(updateArg.data.announcement.history[0]).toBe(recent)
  })
})

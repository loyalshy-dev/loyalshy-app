import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// The public join surface: only PUBLIC programs are listed, and an
// invite-only program cannot be joined even with its id in hand.

let mockDb: MockDb

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb, getNextMemberNumber: vi.fn(async () => 1) }))
  vi.doMock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }))
  vi.doMock("@/lib/rate-limit", () => ({
    publicFormLimiter: { check: () => ({ success: true }) },
    joinPassLimiter: { check: () => ({ success: true }) },
  }))
  vi.doMock("@/lib/wallet/apple/generate-pass", () => ({ generateApplePass: vi.fn() }))
  vi.doMock("@/lib/wallet/google/generate-pass", () => ({ generateGoogleWalletSaveUrl: vi.fn() }))
  vi.doMock("@/lib/wallet/dispatch", () => ({ dispatchWalletUpdate: vi.fn() }))
  vi.doMock("@/lib/wallet/card-design", () => ({ resolveCardDesign: vi.fn() }))
  vi.doMock("@/lib/card-access", () => ({ buildCardUrl: vi.fn(), verifyCardSignature: vi.fn() }))
  vi.doMock("@/lib/proximity/settings", () => ({ loadPassProximity: vi.fn() }))
})

describe("getOrganizationBySlug", () => {
  it("only lists active PUBLIC programs", async () => {
    mockDb.organization.findUnique.mockResolvedValue(null)
    const { getOrganizationBySlug } = await import("./onboarding-actions")
    expect(await getOrganizationBySlug("cafe-sol")).toBeNull()
    const args = mockDb.organization.findUnique.mock.calls[0][0]
    expect(args.select.passTemplates.where).toEqual({ status: "ACTIVE", joinMode: "PUBLIC" })
  })
})

describe("joinTemplate", () => {
  function form(entries: Record<string, string>) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(entries)) fd.set(k, v)
    return fd
  }

  it("refuses an invite-only program before creating anything", async () => {
    mockDb.organization.findUnique.mockResolvedValue({ id: "org-1" })
    mockDb.passTemplate.findFirst.mockResolvedValue({ id: "tpl-1", passType: "STAMP_CARD", config: {}, joinMode: "INVITE_ONLY" })
    const { joinTemplate } = await import("./onboarding-actions")
    const result = await joinTemplate(form({ fullName: "Ana", email: "ana@example.com", organizationSlug: "cafe-sol", templateId: "tpl-1" }))
    expect(result).toEqual({ success: false, error: "This program is by invitation only." })
    expect(mockDb.contact.findUnique).not.toHaveBeenCalled()
    expect(mockDb.contact.create).not.toHaveBeenCalled()
  })
})

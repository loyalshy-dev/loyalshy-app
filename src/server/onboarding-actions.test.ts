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
  vi.doMock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }))
})

const tpl = (id: string, joinMode: "PUBLIC" | "INVITE_ONLY") => ({ id, name: id, passType: "STAMP_CARD", joinMode, config: {}, passDesign: null })
const org = (templates: unknown[]) => ({ id: "org-1", name: "Café Sol", slug: "cafe-sol", logo: null, logoApple: null, logoGoogle: null, brandColor: null, secondaryColor: null, passTemplates: templates })

describe("getOrganizationBySlug", () => {
  it("lists only the PUBLIC programs and flags the invite-only ones", async () => {
    mockDb.organization.findUnique.mockResolvedValue(org([tpl("a", "INVITE_ONLY"), tpl("b", "PUBLIC")]))
    const { getOrganizationBySlug } = await import("./onboarding-actions")
    const result = await getOrganizationBySlug("cafe-sol")
    expect(result?.templates.map((t) => t.id)).toEqual(["b"])
    expect(result?.hasInviteOnlyPrograms).toBe(true)
  })

  it("still resolves, with nothing to list, when every active program is invite only", async () => {
    mockDb.organization.findUnique.mockResolvedValue(org([tpl("a", "INVITE_ONLY")]))
    const { getOrganizationBySlug } = await import("./onboarding-actions")
    const result = await getOrganizationBySlug("cafe-sol")
    expect(result?.templates).toEqual([])
    expect(result?.hasInviteOnlyPrograms).toBe(true)
  })

  it("is null with no active programs at all (unchanged)", async () => {
    mockDb.organization.findUnique.mockResolvedValue(org([]))
    const { getOrganizationBySlug } = await import("./onboarding-actions")
    expect(await getOrganizationBySlug("cafe-sol")).toBeNull()
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
    expect(result).toEqual({ success: false, error: "inviteOnlyError" })
    expect(mockDb.contact.findUnique).not.toHaveBeenCalled()
    expect(mockDb.contact.create).not.toHaveBeenCalled()
  })
})

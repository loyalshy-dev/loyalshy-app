import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb
const assertRole = vi.fn()
const revalidatePath = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  assertRole.mockReset()
  revalidatePath.mockReset()
  vi.doMock("@/lib/db", () => ({ db: mockDb, getNextMemberNumber: vi.fn() }))
  vi.doMock("@/lib/dal", () => ({
    assertAuthenticated: vi.fn(),
    getOrganizationForUser: vi.fn(async () => ({ id: "org-1", slug: "cafe-sol" })),
    assertOrganizationRole: assertRole,
    assertOrganizationAccess: vi.fn(),
  }))
  vi.doMock("next/cache", () => ({ revalidatePath }))
  vi.doMock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }))
  // Heavy wallet/email modules the action under test never reaches
  vi.doMock("@/lib/wallet/generate-pass-for-email", () => ({ generateApplePassForEmail: vi.fn() }))
  vi.doMock("@/lib/email-templates", () => ({ buildPassIssuedEmailHtml: vi.fn(), getEmailFrom: vi.fn(), buildWalletDownloadUrl: vi.fn() }))
  vi.doMock("@/lib/issue-pass", () => ({ createPassInstanceForContact: vi.fn(), sendPassIssuedEmail: vi.fn(), PASS_TYPE_LABELS: {} }))
  vi.doMock("@/lib/card-access", () => ({ buildCardUrl: vi.fn() }))
})

describe("setProgramJoinMode", () => {
  it("sets the mode on the org's own program (admin+) and revalidates the pages that show it", async () => {
    mockDb.passTemplate.updateMany.mockResolvedValue({ count: 1 })
    const { setProgramJoinMode } = await import("./distribution-actions")
    expect(await setProgramJoinMode({ templateId: "tpl-1", joinMode: "INVITE_ONLY" })).toEqual({ success: true })
    expect(assertRole).toHaveBeenCalledWith("org-1", "admin")
    expect(mockDb.passTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: "tpl-1", organizationId: "org-1" },
      data: { joinMode: "INVITE_ONLY" },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/programs/tpl-1/distribution")
  })

  it("reports programNotFound when the id belongs to another organization", async () => {
    mockDb.passTemplate.updateMany.mockResolvedValue({ count: 0 })
    const { setProgramJoinMode } = await import("./distribution-actions")
    expect(await setProgramJoinMode({ templateId: "foreign", joinMode: "PUBLIC" })).toEqual({ error: "programNotFound" })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("rejects an unknown mode before touching the database", async () => {
    const { setProgramJoinMode } = await import("./distribution-actions")
    // @ts-expect-error — the runtime guard is what's under test
    expect(await setProgramJoinMode({ templateId: "tpl-1", joinMode: "SECRET" })).toEqual({ error: "invalidInput" })
    expect(mockDb.passTemplate.updateMany).not.toHaveBeenCalled()
  })
})

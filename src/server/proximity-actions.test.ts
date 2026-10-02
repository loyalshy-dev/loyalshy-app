import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb
const refresh = vi.fn()
const assertRole = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  refresh.mockReset()
  assertRole.mockReset()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/dal", () => ({
    getOrganizationForUser: vi.fn(async () => ({ id: "org-1", plan: "FREE", subscriptionStatus: "ACTIVE" })),
    assertOrganizationRole: assertRole,
  }))
  vi.doMock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }))
  vi.doMock("@/lib/wallet/refresh-org-passes", () => ({ refreshOrgPasses: refresh }))
  mockDb.$transaction.mockResolvedValue([])
})

const valid = { enabled: true, address: "Calle Mayor 1, Madrid", latitude: 40.41, longitude: -3.7, message: "" }

describe("saveProximitySettings", () => {
  it("saves on any plan (even Free), mirrors the address into every design and refreshes passes", async () => {
    const { saveProximitySettings } = await import("./proximity-actions")
    expect(await saveProximitySettings(valid)).toEqual({ success: true })
    expect(assertRole).toHaveBeenCalledWith("org-1", "admin")
    expect(mockDb.proximitySettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        update: expect.objectContaining({ address: "Calle Mayor 1, Madrid", message: null }),
      }),
    )
    expect(mockDb.passDesign.updateMany).toHaveBeenCalledWith({
      where: { passTemplate: { organizationId: "org-1" } },
      data: { mapAddress: "Calle Mayor 1, Madrid", mapLatitude: 40.41, mapLongitude: -3.7 },
    })
    expect(refresh).toHaveBeenCalledWith("org-1", { syncGoogleClasses: true })
  })

  it("rejects bad input", async () => {
    const { saveProximitySettings } = await import("./proximity-actions")
    expect(await saveProximitySettings({ ...valid, latitude: 120 })).toEqual({ error: "invalidInput" })
    expect(await saveProximitySettings({ ...valid, address: " " })).toEqual({ error: "invalidInput" })
    expect(await saveProximitySettings({ ...valid, message: "x".repeat(81) })).toEqual({ error: "invalidInput" })
    expect(refresh).not.toHaveBeenCalled()
  })
})

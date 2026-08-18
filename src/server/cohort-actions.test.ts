import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb
const mockAssertAdminRole = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(Date.UTC(2026, 7, 18))) // Aug 18, 2026
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/dal", () => ({ assertAdminRole: mockAssertAdminRole }))
  mockAssertAdminRole.mockReset()
  mockAssertAdminRole.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe("getCohortRetention", () => {
  it("segments partner vs organic and computes activity-based retention", async () => {
    mockDb.organization.findMany.mockResolvedValue([
      {
        id: "org-p",
        createdAt: new Date(Date.UTC(2026, 5, 10)), // June cohort, partner
        referredById: "partner-1",
        plan: "STARTER",
        subscriptionStatus: "ACTIVE",
      },
      {
        id: "org-a",
        createdAt: new Date(Date.UTC(2026, 5, 20)), // June cohort, organic
        referredById: null,
        plan: "FREE",
        subscriptionStatus: "ACTIVE",
      },
      {
        id: "org-b",
        createdAt: new Date(Date.UTC(2026, 7, 2)), // Aug cohort, organic
        referredById: null,
        plan: "FREE",
        subscriptionStatus: "CANCELED",
      },
    ])
    mockDb.$queryRaw.mockResolvedValue([
      { organizationId: "org-p", month: "2026-06" },
      { organizationId: "org-p", month: "2026-07" },
      { organizationId: "org-a", month: "2026-06" },
      { organizationId: "org-b", month: "2026-08" },
    ])

    const { getCohortRetention } = await import("./cohort-actions")
    const result = await getCohortRetention()

    expect("all" in result).toBe(true)
    const s = result as Exclude<typeof result, { error: string }>

    // Partner segment: one June cohort — active in M0 + M1, churned M2 (Aug)
    expect(s.partner).toHaveLength(1)
    const p = s.partner[0]
    expect(p.cohortMonth).toBe("2026-06")
    expect(p.orgCount).toBe(1)
    expect(p.paidCount).toBe(1)
    expect(p.subscribedCount).toBe(1)
    expect(p.retention.slice(0, 4)).toEqual([100, 100, 0, null])

    // Organic segment: June (active M0 only) + Aug cohorts
    expect(s.organic.map((r) => r.cohortMonth)).toEqual(["2026-06", "2026-08"])
    const oJune = s.organic[0]
    expect(oJune.retention.slice(0, 3)).toEqual([100, 0, 0])
    const oAug = s.organic[1]
    expect(oAug.orgCount).toBe(1)
    expect(oAug.subscribedCount).toBe(0) // canceled
    expect(oAug.retention.slice(0, 2)).toEqual([100, null])

    // All segment: June cohort blends both — M1 is 1 of 2 orgs = 50%
    const allJune = s.all.find((r) => r.cohortMonth === "2026-06")!
    expect(allJune.orgCount).toBe(2)
    expect(allJune.retention.slice(0, 3)).toEqual([100, 50, 0])
  })

  it("handles year boundaries in the month arithmetic", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 1, 10))) // Feb 2026
    mockDb.organization.findMany.mockResolvedValue([
      {
        id: "org-x",
        createdAt: new Date(Date.UTC(2025, 11, 5)), // Dec 2025 cohort
        referredById: null,
        plan: "FREE",
        subscriptionStatus: "ACTIVE",
      },
    ])
    mockDb.$queryRaw.mockResolvedValue([
      { organizationId: "org-x", month: "2025-12" },
      { organizationId: "org-x", month: "2026-02" }, // skips January
    ])

    const { getCohortRetention } = await import("./cohort-actions")
    const result = await getCohortRetention()
    const s = result as Exclude<typeof result, { error: string }>

    const row = s.all[0]
    expect(row.cohortMonth).toBe("2025-12")
    // M0 = Dec (active), M1 = Jan (inactive), M2 = Feb (active), M3 = future
    expect(row.retention.slice(0, 4)).toEqual([100, 0, 100, null])
  })
})

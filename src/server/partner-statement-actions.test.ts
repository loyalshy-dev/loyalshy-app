import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb
const mockAssertAdminRole = vi.fn()
const mockInvoicesList = vi.fn()
const mockRefundsList = vi.fn()

function paged(items: unknown[]) {
  return { autoPagingToArray: async () => items }
}

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/dal", () => ({ assertAdminRole: mockAssertAdminRole }))
  vi.doMock("@/lib/stripe", () => ({
    stripe: {
      invoices: { list: mockInvoicesList },
      refunds: { list: mockRefundsList },
    },
  }))
  mockAssertAdminRole.mockReset()
  mockAssertAdminRole.mockResolvedValue({})
  mockInvoicesList.mockReset()
  mockRefundsList.mockReset()
})

describe("getPartnerStatement", () => {
  it("rejects a non-partner target", async () => {
    mockDb.user.findUnique.mockResolvedValue({ isPartner: false })

    const { getPartnerStatement } = await import("./partner-statement-actions")
    const result = await getPartnerStatement("user-x", 2026, 7)

    expect(result).toEqual({ error: "not_a_partner" })
  })

  it("rejects an invalid period", async () => {
    const { getPartnerStatement } = await import("./partner-statement-actions")
    expect(await getPartnerStatement("p", 2026, 13)).toEqual({ error: "invalid_period" })
    expect(await getPartnerStatement("p", 2026, 0)).toEqual({ error: "invalid_period" })
  })

  it("computes collected revenue, refund clawbacks, activation credit, and net payout", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "partner-1",
      name: "Agency Rep",
      email: "rep@agency.test",
      isPartner: true,
    })

    // July 2026 statement
    const inMonth = new Date(Date.UTC(2026, 6, 10))
    const older = new Date(Date.UTC(2026, 2, 1))

    mockDb.organization.findMany.mockResolvedValue([
      {
        id: "org-a",
        name: "Cafe A",
        plan: "STARTER",
        subscriptionStatus: "ACTIVE",
        stripeCustomerId: "cus_A",
        createdAt: older,
        _count: { passTemplates: 1 },
      },
      {
        id: "org-b",
        name: "Cafe B",
        plan: "GROWTH",
        subscriptionStatus: "ACTIVE",
        stripeCustomerId: "cus_B",
        createdAt: inMonth, // created this month + active program → activated
        _count: { passTemplates: 1 },
      },
      {
        id: "org-c",
        name: "Cafe C (free)",
        plan: "FREE",
        subscriptionStatus: "ACTIVE",
        stripeCustomerId: null,
        createdAt: inMonth,
        _count: { passTemplates: 0 }, // created this month but NOT activated
      },
    ])

    mockInvoicesList.mockImplementation(({ customer }: { customer: string }) => {
      if (customer === "cus_A")
        return paged([
          { amount_paid: 2900, currency: "eur" },
          { amount_paid: 2900, currency: "eur" },
          { amount_paid: 999, currency: "usd" }, // non-eur ignored
        ])
      if (customer === "cus_B") return paged([{ amount_paid: 4900, currency: "eur" }])
      return paged([])
    })

    mockRefundsList.mockReturnValue(
      paged([
        { amount: 2900, currency: "eur", charge: { customer: "cus_A" } },
        { amount: 5000, currency: "eur", charge: { customer: "cus_UNRELATED" } },
      ])
    )

    const { getPartnerStatement } = await import("./partner-statement-actions")
    const result = await getPartnerStatement("partner-1", 2026, 7)

    expect("totals" in result).toBe(true)
    const s = result as Exclude<typeof result, { error: string }>

    // Period boundaries hit Stripe correctly
    expect(mockInvoicesList).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_A",
        status: "paid",
        created: {
          gte: Date.UTC(2026, 6, 1) / 1000,
          lt: Date.UTC(2026, 7, 1) / 1000,
        },
      })
    )

    // Lines: A = 5800 gross − 2900 refund; B = 4900; C = 0
    const byName = Object.fromEntries(s.lines.map((l) => [l.name, l]))
    expect(byName["Cafe A"].grossCollectedCents).toBe(5800)
    expect(byName["Cafe A"].refundedCents).toBe(2900)
    expect(byName["Cafe A"].netCents).toBe(2900)
    expect(byName["Cafe A"].activatedThisMonth).toBe(false)
    expect(byName["Cafe B"].netCents).toBe(4900)
    expect(byName["Cafe B"].activatedThisMonth).toBe(true)
    expect(byName["Cafe C (free)"].netCents).toBe(0)
    expect(byName["Cafe C (free)"].activatedThisMonth).toBe(false)

    // Totals: gross 10700, refunds 2900, net 7800
    expect(s.totals.grossCollectedCents).toBe(10700)
    expect(s.totals.refundedCents).toBe(2900)
    expect(s.totals.netCollectedCents).toBe(7800)
    // 30% rev-share = 2340; 1 activation × 3000 = 3000 → payout −660
    expect(s.totals.revShareCents).toBe(2340)
    expect(s.totals.newActivatedCount).toBe(1)
    expect(s.totals.setupFeeShareCents).toBe(3000)
    expect(s.totals.payoutCents).toBe(-660)
  })

  it("skips the Stripe refunds call when no org has a Stripe customer", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "partner-1",
      name: "Agency Rep",
      email: "rep@agency.test",
      isPartner: true,
    })
    mockDb.organization.findMany.mockResolvedValue([
      {
        id: "org-c",
        name: "Cafe C",
        plan: "FREE",
        subscriptionStatus: "ACTIVE",
        stripeCustomerId: null,
        createdAt: new Date(Date.UTC(2026, 6, 2)),
        _count: { passTemplates: 1 },
      },
    ])

    const { getPartnerStatement } = await import("./partner-statement-actions")
    const result = await getPartnerStatement("partner-1", 2026, 7)

    expect("totals" in result).toBe(true)
    const s = result as Exclude<typeof result, { error: string }>
    expect(mockRefundsList).not.toHaveBeenCalled()
    // Activated free client still nets a negative payout (they owe the 30€)
    expect(s.totals.newActivatedCount).toBe(1)
    expect(s.totals.payoutCents).toBe(-3000)
  })
})

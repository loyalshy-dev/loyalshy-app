import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"
import {
  createMockSession,
  createMockRestaurant,
  createMockMember,
} from "@/__tests__/mocks/auth"

// ─── Module mocks ─────────────────────────────────────────────

let mockDb: MockDb

beforeEach(() => {
  vi.resetModules()

  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))

  const session = createMockSession()
  const restaurant = createMockRestaurant()

  vi.doMock("@/lib/dal", () => ({
    assertAuthenticated: vi.fn().mockResolvedValue(session),
    assertRestaurantAccess: vi.fn().mockResolvedValue({
      session,
      member: createMockMember(),
    }),
    assertRestaurantRole: vi.fn().mockResolvedValue({
      session,
      member: createMockMember(),
    }),
    getRestaurantForUser: vi.fn().mockResolvedValue(restaurant),
  }))
})

// ─── Tests ─────────────────────────────────────────────────────

describe("checkCustomerLimit", () => {
  it("allows adding customer when under limit", async () => {
    const { checkCustomerLimit } = await import("./billing-actions")

    mockDb.restaurant.findUnique.mockResolvedValue({ plan: "STARTER" })
    mockDb.customer.count.mockResolvedValue(100) // Starter limit is 500

    const result = await checkCustomerLimit("restaurant-1")

    expect(result.allowed).toBe(true)
    expect(result.current).toBe(100)
    expect(result.limit).toBe(500)
    expect(result.approaching).toBe(false)
  })

  it("blocks adding customer at limit", async () => {
    const { checkCustomerLimit } = await import("./billing-actions")

    mockDb.restaurant.findUnique.mockResolvedValue({ plan: "FREE" })
    mockDb.customer.count.mockResolvedValue(50) // FREE limit is 50

    const result = await checkCustomerLimit("restaurant-1")

    expect(result.allowed).toBe(false)
    expect(result.current).toBe(50)
    expect(result.limit).toBe(50)
  })

  it("signals approaching limit at 80%", async () => {
    const { checkCustomerLimit } = await import("./billing-actions")

    mockDb.restaurant.findUnique.mockResolvedValue({ plan: "FREE" })
    mockDb.customer.count.mockResolvedValue(40) // 80% of 50

    const result = await checkCustomerLimit("restaurant-1")

    expect(result.allowed).toBe(true)
    expect(result.approaching).toBe(true)
  })

  it("never approaching for unlimited plans", async () => {
    const { checkCustomerLimit } = await import("./billing-actions")

    mockDb.restaurant.findUnique.mockResolvedValue({ plan: "PRO" })
    mockDb.customer.count.mockResolvedValue(10_000)

    const result = await checkCustomerLimit("restaurant-1")

    expect(result.allowed).toBe(true)
    expect(result.approaching).toBe(false)
  })

  it("returns allowed=false for nonexistent restaurant", async () => {
    const { checkCustomerLimit } = await import("./billing-actions")

    mockDb.restaurant.findUnique.mockResolvedValue(null)

    const result = await checkCustomerLimit("nonexistent")

    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(0)
  })
})

describe("checkStaffLimit", () => {
  it("allows inviting staff when under limit", async () => {
    const { checkStaffLimit } = await import("./billing-actions")

    mockDb.restaurant.findUnique.mockResolvedValue({ plan: "STARTER", slug: "test" })
    mockDb.organization.findUnique.mockResolvedValue({
      _count: { members: 1 },
    })
    mockDb.staffInvitation.count.mockResolvedValue(0)

    const result = await checkStaffLimit("restaurant-1")

    expect(result.allowed).toBe(true)
    expect(result.current).toBe(1)
    expect(result.limit).toBe(3) // STARTER allows 3 staff
  })

  it("counts pending invitations toward the limit", async () => {
    const { checkStaffLimit } = await import("./billing-actions")

    mockDb.restaurant.findUnique.mockResolvedValue({ plan: "STARTER", slug: "test" })
    mockDb.organization.findUnique.mockResolvedValue({
      _count: { members: 2 },
    })
    mockDb.staffInvitation.count.mockResolvedValue(1) // 2 members + 1 pending = 3 = limit

    const result = await checkStaffLimit("restaurant-1")

    expect(result.allowed).toBe(false)
    expect(result.current).toBe(3) // 2 + 1
    expect(result.limit).toBe(3)
  })

  it("blocks at the FREE plan limit (1 staff)", async () => {
    const { checkStaffLimit } = await import("./billing-actions")

    mockDb.restaurant.findUnique.mockResolvedValue({ plan: "FREE", slug: "test" })
    mockDb.organization.findUnique.mockResolvedValue({
      _count: { members: 1 },
    })
    mockDb.staffInvitation.count.mockResolvedValue(0)

    const result = await checkStaffLimit("restaurant-1")

    expect(result.allowed).toBe(false)
    expect(result.current).toBe(1)
    expect(result.limit).toBe(1)
  })
})

describe("getBillingData", () => {
  it("returns billing data with usage percentages", async () => {
    const { getBillingData } = await import("./billing-actions")

    mockDb.customer.count.mockResolvedValue(250)
    mockDb.organization.findUnique.mockResolvedValue({
      _count: { members: 2 },
    })

    const result = await getBillingData()

    // Should not be an error
    expect(result).not.toHaveProperty("error")
    if ("error" in result) return

    expect(result.restaurant.plan).toBe("STARTER")
    expect(result.usage.customers).toBe(250)
    expect(result.usage.customerLimit).toBe(500)
    expect(result.usage.customerPercent).toBe(50)
    expect(result.usage.staff).toBe(2)
    expect(result.usage.staffLimit).toBe(3)
  })
})

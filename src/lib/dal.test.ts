import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"
import { createMockSession } from "@/__tests__/mocks/auth"
import { RedirectError } from "@/__tests__/setup"

// ─── Module mocks ─────────────────────────────────────────────

let mockDb: MockDb
const mockGetSession = vi.fn()

beforeEach(() => {
  vi.resetModules()

  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))

  vi.doMock("@/lib/auth", () => ({
    auth: {
      api: {
        getSession: mockGetSession,
      },
    },
  }))

  // Reset React cache by resetting modules
  mockGetSession.mockReset()
})

// ─── Tests ─────────────────────────────────────────────────────

describe("assertAuthenticated", () => {
  it("returns session when authenticated", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    const { assertAuthenticated } = await import("./dal")
    const result = await assertAuthenticated()

    expect(result.user.id).toBe("user-1")
    expect(result.user.email).toBe("test@example.com")
  })

  it("redirects to /login when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null)

    const { assertAuthenticated } = await import("./dal")

    await expect(assertAuthenticated()).rejects.toThrow(RedirectError)
    await expect(assertAuthenticated()).rejects.toThrow("NEXT_REDIRECT: /login")
  })
})

describe("assertSuperAdmin", () => {
  it("returns session for super admin", async () => {
    const session = createMockSession({ role: "super_admin" })
    mockGetSession.mockResolvedValue(session)

    const { assertSuperAdmin } = await import("./dal")
    const result = await assertSuperAdmin()

    expect(result.user.role).toBe("super_admin")
  })

  it("redirects regular users to /dashboard", async () => {
    const session = createMockSession({ role: "USER" })
    mockGetSession.mockResolvedValue(session)

    const { assertSuperAdmin } = await import("./dal")

    await expect(assertSuperAdmin()).rejects.toThrow(RedirectError)
    await expect(assertSuperAdmin()).rejects.toThrow("/dashboard")
  })
})

describe("assertRestaurantAccess", () => {
  it("allows super admin to access any restaurant", async () => {
    const session = createMockSession({ role: "super_admin" })
    mockGetSession.mockResolvedValue(session)

    const { assertRestaurantAccess } = await import("./dal")
    const result = await assertRestaurantAccess("any-restaurant-id")

    expect(result.member.role).toBe("owner") // super admins get owner role
    expect(mockDb.restaurant.findUnique).not.toHaveBeenCalled() // skips DB lookup
  })

  it("allows org member to access their restaurant", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.restaurant.findUnique.mockResolvedValue({ slug: "test-restaurant" })
    mockDb.organization.findUnique.mockResolvedValue({ id: "org-1", slug: "test-restaurant" })
    mockDb.member.findFirst.mockResolvedValue({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date(),
    })

    const { assertRestaurantAccess } = await import("./dal")
    const result = await assertRestaurantAccess("restaurant-1")

    expect(result.member.role).toBe("member")
  })

  it("redirects when user is not a member", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.restaurant.findUnique.mockResolvedValue({ slug: "test-restaurant" })
    mockDb.organization.findUnique.mockResolvedValue({ id: "org-1" })
    mockDb.member.findFirst.mockResolvedValue(null)

    const { assertRestaurantAccess } = await import("./dal")

    await expect(assertRestaurantAccess("restaurant-1")).rejects.toThrow(RedirectError)
  })

  it("redirects when restaurant does not exist", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.restaurant.findUnique.mockResolvedValue(null)

    const { assertRestaurantAccess } = await import("./dal")

    await expect(assertRestaurantAccess("nonexistent")).rejects.toThrow(RedirectError)
  })

  it("redirects when organization not found", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.restaurant.findUnique.mockResolvedValue({ slug: "test-restaurant" })
    mockDb.organization.findUnique.mockResolvedValue(null)

    const { assertRestaurantAccess } = await import("./dal")

    await expect(assertRestaurantAccess("restaurant-1")).rejects.toThrow(RedirectError)
  })
})

describe("assertRestaurantRole", () => {
  it("allows owner when owner is required", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.restaurant.findUnique.mockResolvedValue({ slug: "test-restaurant" })
    mockDb.organization.findUnique.mockResolvedValue({ id: "org-1" })
    mockDb.member.findFirst.mockResolvedValue({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "owner",
      createdAt: new Date(),
    })

    const { assertRestaurantRole } = await import("./dal")
    const result = await assertRestaurantRole("restaurant-1", "owner")

    expect(result.member.role).toBe("owner")
  })

  it("allows owner when member role is required (hierarchy)", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.restaurant.findUnique.mockResolvedValue({ slug: "test-restaurant" })
    mockDb.organization.findUnique.mockResolvedValue({ id: "org-1" })
    mockDb.member.findFirst.mockResolvedValue({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "owner",
      createdAt: new Date(),
    })

    const { assertRestaurantRole } = await import("./dal")
    const result = await assertRestaurantRole("restaurant-1", "member")

    expect(result.member.role).toBe("owner")
  })

  it("rejects member when owner is required", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.restaurant.findUnique.mockResolvedValue({ slug: "test-restaurant" })
    mockDb.organization.findUnique.mockResolvedValue({ id: "org-1" })
    mockDb.member.findFirst.mockResolvedValue({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date(),
    })

    const { assertRestaurantRole } = await import("./dal")

    await expect(assertRestaurantRole("restaurant-1", "owner")).rejects.toThrow(
      RedirectError
    )
  })
})

describe("getRestaurantForUser", () => {
  it("returns restaurant with active loyalty program", async () => {
    const session = createMockSession({ restaurantId: "restaurant-1" })
    mockGetSession.mockResolvedValue(session)

    const mockRestaurant = {
      id: "restaurant-1",
      name: "Test",
      loyaltyPrograms: [{ id: "prog-1", status: "ACTIVE", cardDesign: null }],
    }
    mockDb.restaurant.findUnique.mockResolvedValue(mockRestaurant)

    const { getRestaurantForUser } = await import("./dal")
    const result = await getRestaurantForUser()

    expect(result).toEqual(mockRestaurant)
    expect(mockDb.restaurant.findUnique).toHaveBeenCalledWith({
      where: { id: "restaurant-1" },
      include: {
        loyaltyPrograms: {
          where: { status: "ACTIVE" },
          include: { cardDesign: true },
          orderBy: { createdAt: "asc" },
        },
      },
    })
  })

  it("returns null when user has no restaurantId", async () => {
    const session = createMockSession({ restaurantId: null })
    mockGetSession.mockResolvedValue(session)

    const { getRestaurantForUser } = await import("./dal")
    const result = await getRestaurantForUser()

    expect(result).toBeNull()
  })
})

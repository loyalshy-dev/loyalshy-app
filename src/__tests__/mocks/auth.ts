import { vi } from "vitest"
import type { AuthSession, OrgMember } from "@/lib/dal"

/**
 * Creates a mock authenticated session for testing.
 */
export function createMockSession(overrides?: Partial<AuthSession["user"]>): AuthSession {
  return {
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      image: null,
      role: "USER",
      restaurantId: "restaurant-1",
      ...overrides,
    },
    session: {
      id: "session-1",
      userId: overrides?.id ?? "user-1",
      expiresAt: new Date(Date.now() + 86400_000),
      activeOrganizationId: "org-1",
    },
  }
}

/**
 * Creates a mock org member for testing.
 */
export function createMockMember(overrides?: Partial<OrgMember>): OrgMember {
  return {
    id: "member-1",
    organizationId: "org-1",
    userId: "user-1",
    role: "owner",
    createdAt: new Date(),
    ...overrides,
  }
}

/**
 * Creates a mock restaurant with active loyalty programs.
 */
export function createMockRestaurant(overrides?: Record<string, unknown>) {
  return {
    id: "restaurant-1",
    name: "Test Restaurant",
    slug: "test-restaurant",
    plan: "STARTER",
    subscriptionStatus: "ACTIVE",
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    trialEndsAt: null,
    loyaltyPrograms: [
      {
        id: "program-1",
        restaurantId: "restaurant-1",
        name: "Test Program",
        visitsRequired: 10,
        rewardDescription: "Free coffee",
        rewardExpiryDays: 30,
        status: "ACTIVE",
        startsAt: new Date("2026-01-01"),
        endsAt: null,
        cardDesign: null,
      },
    ],
    ...overrides,
  }
}

/**
 * Creates a mock customer.
 */
export function createMockCustomer(overrides?: Record<string, unknown>) {
  return {
    id: "customer-1",
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: null,
    restaurantId: "restaurant-1",
    totalVisits: 13,
    lastVisitAt: new Date("2026-02-20"),
    deletedAt: null,
    ...overrides,
  }
}

/**
 * Creates a mock enrollment for testing.
 */
export function createMockEnrollment(overrides?: Record<string, unknown>) {
  return {
    id: "enrollment-1",
    customerId: "customer-1",
    loyaltyProgramId: "program-1",
    currentCycleVisits: 3,
    totalVisits: 13,
    totalRewardsRedeemed: 0,
    walletPassId: null,
    walletPassSerialNumber: null,
    walletPassType: "NONE",
    status: "ACTIVE",
    enrolledAt: new Date("2026-01-15"),
    frozenAt: null,
    customer: {
      id: "customer-1",
      restaurantId: "restaurant-1",
      deletedAt: null,
      totalVisits: 13,
      fullName: "Jane Doe",
    },
    loyaltyProgram: {
      id: "program-1",
      name: "Test Program",
      visitsRequired: 10,
      rewardDescription: "Free coffee",
      rewardExpiryDays: 30,
      status: "ACTIVE",
      endsAt: null,
    },
    ...overrides,
  }
}

/**
 * Sets up mock DAL functions to return authenticated session + restaurant.
 * Call this in beforeEach for server action tests.
 */
export function setupMockAuth(
  session: AuthSession = createMockSession(),
  restaurant = createMockRestaurant()
) {
  const mockGetCurrentUser = vi.fn().mockResolvedValue(session)
  const mockAssertAuthenticated = vi.fn().mockResolvedValue(session)
  const mockAssertRestaurantAccess = vi.fn().mockResolvedValue({
    session,
    member: createMockMember(),
  })
  const mockAssertRestaurantRole = vi.fn().mockResolvedValue({
    session,
    member: createMockMember(),
  })
  const mockGetRestaurantForUser = vi.fn().mockResolvedValue(restaurant)

  vi.doMock("@/lib/dal", () => ({
    getCurrentUser: mockGetCurrentUser,
    assertAuthenticated: mockAssertAuthenticated,
    assertRestaurantAccess: mockAssertRestaurantAccess,
    assertRestaurantRole: mockAssertRestaurantRole,
    getRestaurantForUser: mockGetRestaurantForUser,
  }))

  return {
    mockGetCurrentUser,
    mockAssertAuthenticated,
    mockAssertRestaurantAccess,
    mockAssertRestaurantRole,
    mockGetRestaurantForUser,
  }
}

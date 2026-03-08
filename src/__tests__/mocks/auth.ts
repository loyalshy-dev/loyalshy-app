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
 * Creates a mock organization with active pass templates.
 */
export function createMockOrganization(overrides?: Record<string, unknown>) {
  return {
    id: "org-1",
    name: "Test Organization",
    slug: "test-org",
    plan: "STARTER",
    subscriptionStatus: "ACTIVE",
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    trialEndsAt: null,
    passTemplates: [
      {
        id: "template-1",
        organizationId: "org-1",
        name: "Test Template",
        passType: "STAMP_CARD",
        status: "ACTIVE",
        startsAt: new Date("2026-01-01"),
        endsAt: null,
        config: {
          stampsRequired: 10,
          rewardDescription: "Free coffee",
          rewardExpiryDays: 30,
        },
        passDesign: null,
      },
    ],
    ...overrides,
  }
}

/**
 * Creates a mock contact.
 */
export function createMockContact(overrides?: Record<string, unknown>) {
  return {
    id: "contact-1",
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: null,
    organizationId: "org-1",
    totalInteractions: 13,
    lastInteractionAt: new Date("2026-02-20"),
    deletedAt: null,
    ...overrides,
  }
}

/**
 * Creates a mock pass instance for testing.
 */
export function createMockPassInstance(overrides?: Record<string, unknown>) {
  return {
    id: "instance-1",
    contactId: "contact-1",
    passTemplateId: "template-1",
    walletPassId: null,
    walletPassSerialNumber: null,
    walletProvider: "NONE",
    status: "ACTIVE",
    issuedAt: new Date("2026-01-15"),
    expiresAt: null,
    suspendedAt: null,
    revokedAt: null,
    data: {
      currentCycleVisits: 3,
      totalVisits: 13,
      totalRewardsEarned: 0,
    },
    contact: {
      id: "contact-1",
      organizationId: "org-1",
      deletedAt: null,
      totalInteractions: 13,
      fullName: "Jane Doe",
    },
    passTemplate: {
      id: "template-1",
      name: "Test Template",
      passType: "STAMP_CARD",
      status: "ACTIVE",
      endsAt: null,
      config: {
        stampsRequired: 10,
        rewardDescription: "Free coffee",
        rewardExpiryDays: 30,
      },
    },
    ...overrides,
  }
}

/**
 * Sets up mock DAL functions to return authenticated session + organization.
 * Call this in beforeEach for server action tests.
 */
export function setupMockAuth(
  session: AuthSession = createMockSession(),
  organization = createMockOrganization()
) {
  const mockGetCurrentUser = vi.fn().mockResolvedValue(session)
  const mockAssertAuthenticated = vi.fn().mockResolvedValue(session)
  const mockAssertOrganizationAccess = vi.fn().mockResolvedValue({
    session,
    member: createMockMember(),
  })
  const mockAssertOrganizationRole = vi.fn().mockResolvedValue({
    session,
    member: createMockMember(),
  })
  const mockGetOrganizationForUser = vi.fn().mockResolvedValue(organization)

  vi.doMock("@/lib/dal", () => ({
    getCurrentUser: mockGetCurrentUser,
    assertAuthenticated: mockAssertAuthenticated,
    assertOrganizationAccess: mockAssertOrganizationAccess,
    assertOrganizationRole: mockAssertOrganizationRole,
    getOrganizationForUser: mockGetOrganizationForUser,
  }))

  return {
    mockGetCurrentUser,
    mockAssertAuthenticated,
    mockAssertOrganizationAccess,
    mockAssertOrganizationRole,
    mockGetOrganizationForUser,
  }
}

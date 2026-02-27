import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "./auth"
import { db } from "./db"

// ─── Types ──────────────────────────────────────────────────

export type AuthUser = {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  restaurantId: string | null
}

export type AuthSession = {
  user: AuthUser
  session: {
    id: string
    userId: string
    expiresAt: Date
    activeOrganizationId: string | null
  }
}

export type OrgMember = {
  id: string
  organizationId: string
  userId: string
  role: string
  createdAt: Date
}

// ─── Core: getCurrentUser ───────────────────────────────────
// Cached per-request via React cache(). This is the foundation
// of all auth checks. Every Server Component and Server Action
// that needs auth MUST call this (or a wrapper).

export const getCurrentUser = cache(async (): Promise<AuthSession | null> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return null
  }

  return session as unknown as AuthSession
})

// ─── Guards ─────────────────────────────────────────────────

/**
 * Throws redirect to /login if no valid session.
 * Use in Server Components and Server Actions.
 */
export async function assertAuthenticated(): Promise<AuthSession> {
  const session = await getCurrentUser()
  if (!session) {
    redirect("/login")
  }
  return session
}

/**
 * Checks User.role === "super_admin" (global role).
 * Throws redirect if not authenticated or not a super admin.
 */
export async function assertSuperAdmin(): Promise<AuthSession> {
  const session = await assertAuthenticated()
  if (session.user.role !== "super_admin") {
    redirect("/dashboard")
  }
  return session
}

/**
 * Verifies user is a member of the restaurant's organization.
 * This checks org membership — the real tenant access control.
 */
export async function assertRestaurantAccess(
  restaurantId: string
): Promise<{ session: AuthSession; member: OrgMember }> {
  const session = await assertAuthenticated()

  // Super admins can access any restaurant
  if (session.user.role === "super_admin") {
    return {
      session,
      member: {
        id: "super_admin",
        organizationId: restaurantId,
        userId: session.user.id,
        role: "owner",
        createdAt: new Date(),
      },
    }
  }

  // Look up the restaurant to get its slug, then find the matching org
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
  })

  if (!restaurant) {
    redirect("/dashboard")
  }

  // Organizations are linked to restaurants by sharing the same slug
  const org = await db.organization.findUnique({
    where: { slug: restaurant.slug },
  })

  if (!org) {
    redirect("/dashboard")
  }

  // Check if user is a member of this organization
  const member = await db.member.findFirst({
    where: {
      organizationId: org.id,
      userId: session.user.id,
    },
  })

  if (!member) {
    redirect("/dashboard")
  }

  return {
    session,
    member: member as OrgMember,
  }
}

/**
 * Verifies user has a specific role in the restaurant's organization.
 * e.g., assertRestaurantRole(restaurantId, "owner") for billing pages.
 */
export async function assertRestaurantRole(
  restaurantId: string,
  requiredRole: "owner" | "admin" | "member"
): Promise<{ session: AuthSession; member: OrgMember }> {
  const { session, member } = await assertRestaurantAccess(restaurantId)

  // Role hierarchy: owner > admin > member
  const roleHierarchy: Record<string, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  }

  const userLevel = roleHierarchy[member.role] ?? 0
  const requiredLevel = roleHierarchy[requiredRole] ?? 0

  if (userLevel < requiredLevel) {
    redirect("/dashboard")
  }

  return { session, member }
}

/**
 * Returns the restaurant record for the current user.
 * Includes all ACTIVE loyalty programs with their card designs.
 */
export async function getRestaurantForUser() {
  const session = await assertAuthenticated()

  if (!session.user.restaurantId) {
    return null
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: session.user.restaurantId },
    include: {
      loyaltyPrograms: {
        where: { status: "ACTIVE" },
        include: { cardDesign: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  return restaurant
}

/**
 * Returns all ACTIVE programs for a restaurant with their card designs.
 */
export async function getActivePrograms(restaurantId: string) {
  return db.loyaltyProgram.findMany({
    where: { restaurantId, status: "ACTIVE" },
    include: { cardDesign: true },
    orderBy: { createdAt: "asc" },
  })
}

/**
 * Returns all enrollments for a customer in a restaurant, with program info.
 */
export async function getCustomerEnrollments(customerId: string, restaurantId: string) {
  return db.enrollment.findMany({
    where: {
      customerId,
      loyaltyProgram: { restaurantId },
    },
    include: {
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          visitsRequired: true,
          rewardDescription: true,
          status: true,
        },
      },
    },
    orderBy: { enrolledAt: "asc" },
  })
}

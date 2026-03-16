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

export async function assertAuthenticated(): Promise<AuthSession> {
  const session = await getCurrentUser()
  if (!session) {
    redirect("/login")
  }
  return session
}

// ─── Admin Role Hierarchy ──────────────────────────────────

const ADMIN_ROLE_HIERARCHY: Record<string, number> = {
  ADMIN_SUPPORT: 1,
  ADMIN_BILLING: 2,
  ADMIN_OPS: 3,
  SUPER_ADMIN: 4,
}

/**
 * Verifies the user has at least the specified admin role level.
 * Hierarchy: ADMIN_SUPPORT < ADMIN_BILLING < ADMIN_OPS < SUPER_ADMIN
 */
export async function assertAdminRole(
  minRole: "ADMIN_SUPPORT" | "ADMIN_BILLING" | "ADMIN_OPS" | "SUPER_ADMIN"
): Promise<AuthSession> {
  const session = await assertAuthenticated()
  const userLevel = ADMIN_ROLE_HIERARCHY[session.user.role] ?? 0
  const requiredLevel = ADMIN_ROLE_HIERARCHY[minRole] ?? 0
  if (userLevel < requiredLevel) {
    redirect("/dashboard")
  }
  return session
}

/** Returns true if the role is any admin-tier role */
export function isAdminRole(role: string): boolean {
  return role in ADMIN_ROLE_HIERARCHY
}

export async function assertSuperAdmin(): Promise<AuthSession> {
  return assertAdminRole("SUPER_ADMIN")
}

/**
 * Returns the member record for the current user in the given organization.
 * Cached per-request to avoid duplicate DB lookups across layout/page/actions.
 */
export const getOrgMember = cache(async (organizationId: string): Promise<OrgMember | null> => {
  const session = await assertAuthenticated()

  // Admin-tier roles always get owner-level access
  if (isAdminRole(session.user.role)) {
    return {
      id: "super_admin",
      organizationId,
      userId: session.user.id,
      role: "owner",
      createdAt: new Date(),
    }
  }

  const member = await db.member.findFirst({
    where: { organizationId, userId: session.user.id },
  })

  return member as OrgMember | null
})

/**
 * Verifies user is a member of the organization.
 * Direct lookup — no slug translation needed (org IS the tenant).
 */
export async function assertOrganizationAccess(
  organizationId: string
): Promise<{ session: AuthSession; member: OrgMember }> {
  const session = await assertAuthenticated()
  const member = await getOrgMember(organizationId)

  if (!member) {
    redirect("/dashboard")
  }

  return { session, member }
}

/**
 * Verifies user has a specific role in the organization.
 * Role hierarchy: owner > admin > member
 */
export async function assertOrganizationRole(
  organizationId: string,
  requiredRole: "owner" | "admin" | "member"
): Promise<{ session: AuthSession; member: OrgMember }> {
  const { session, member } = await assertOrganizationAccess(organizationId)

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
 * Returns the organization for the current user.
 * Uses session.activeOrganizationId or falls back to first membership.
 * Includes all ACTIVE pass templates with their designs.
 */
export const getOrganizationForUser = cache(async () => {
  const session = await assertAuthenticated()

  let organizationId = session.session.activeOrganizationId

  if (!organizationId) {
    const membership = await db.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
      orderBy: { createdAt: "asc" },
    })
    organizationId = membership?.organizationId ?? null
  }

  if (!organizationId) {
    return null
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
  })

  return organization
})


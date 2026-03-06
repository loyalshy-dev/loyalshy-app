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

export async function assertSuperAdmin(): Promise<AuthSession> {
  const session = await assertAuthenticated()
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard")
  }
  return session
}

/**
 * Verifies user is a member of the organization.
 * Direct lookup — no slug translation needed (org IS the tenant).
 */
export async function assertOrganizationAccess(
  organizationId: string
): Promise<{ session: AuthSession; member: OrgMember }> {
  const session = await assertAuthenticated()

  // Super admins can access any organization
  if (session.user.role === "SUPER_ADMIN") {
    return {
      session,
      member: {
        id: "super_admin",
        organizationId,
        userId: session.user.id,
        role: "owner",
        createdAt: new Date(),
      },
    }
  }

  const member = await db.member.findFirst({
    where: {
      organizationId,
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
export async function getOrganizationForUser() {
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
    include: {
      passTemplates: {
        where: { status: "ACTIVE" },
        include: { passDesign: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  return organization
}

/**
 * Returns all ACTIVE templates for an organization with their designs.
 */
export async function getActiveTemplates(organizationId: string) {
  return db.passTemplate.findMany({
    where: { organizationId, status: "ACTIVE" },
    include: { passDesign: true },
    orderBy: { createdAt: "asc" },
  })
}

/**
 * Returns all pass instances for a contact in an organization, with template info.
 */
export async function getContactPassInstances(contactId: string, organizationId: string) {
  return db.passInstance.findMany({
    where: {
      contactId,
      passTemplate: { organizationId },
    },
    include: {
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          status: true,
        },
      },
    },
    orderBy: { issuedAt: "asc" },
  })
}

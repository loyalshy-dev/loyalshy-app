"use server"

import { headers } from "next/headers"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { assertSuperAdmin } from "@/lib/dal"

// ─── Types ──────────────────────────────────────────────────

export type AdminPlatformStats = {
  totalUsers: number
  totalOrganizations: number
  totalContacts: number
  totalInteractions: number
  totalRewards: number
  newUsersThisMonth: number
  newOrganizationsThisMonth: number
  activeSubscriptions: number
  estimatedMrr: number
  subscriptionBreakdown: { status: string; count: number }[]
  planBreakdown: { plan: string; count: number }[]
}

export type AdminUserRow = {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  banned: boolean
  banReason: string | null
  createdAt: Date
  emailVerified: boolean
  organizationName?: string | null
}

export type AdminUsersResult = {
  users: AdminUserRow[]
  total: number
  pageCount: number
}

export type AdminOrganizationRow = {
  id: string
  name: string
  slug: string
  plan: string
  subscriptionStatus: string
  stripeCustomerId: string | null
  trialEndsAt: Date | null
  createdAt: Date
  _count: {
    members: number
    passTemplates: number
    contacts: number
  }
}

export type AdminOrganizationsResult = {
  organizations: AdminOrganizationRow[]
  total: number
  pageCount: number
}

export type AdminUserSession = {
  id: string
  createdAt: Date
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
}

export type AdminOrganizationDetail = {
  id: string
  name: string
  slug: string
  plan: string
  subscriptionStatus: string
  stripeCustomerId: string | null
  trialEndsAt: Date | null
  createdAt: Date
  _count: {
    members: number
    passTemplates: number
    contacts: number
  }
  members: {
    id: string
    userId: string
    role: string
    user: {
      id: string
      name: string
      email: string
      image: string | null
      role: string
    }
  }[]
}

// ─── Validation Schemas ────────────────────────────────────

const banUserSchema = z.object({
  userId: z.string().min(1),
  banReason: z.string().max(500).optional(),
})

const unbanUserSchema = z.object({
  userId: z.string().min(1),
})

const setRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "SUPER_ADMIN"]),
})

const revokeSessionsSchema = z.object({
  userId: z.string().min(1),
})

// ─── Plan Pricing (for MRR estimate) ───────────────────────

const PLAN_MONTHLY_PRICE: Record<string, number> = {
  STARTER: 0,
  PRO: 29,
  BUSINESS: 79,
  ENTERPRISE: 199,
}

// ─── Platform Stats ────────────────────────────────────────

export async function getAdminPlatformStats(): Promise<AdminPlatformStats> {
  await assertSuperAdmin()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [
    totalUsers,
    totalOrganizations,
    totalContacts,
    totalInteractions,
    totalRewards,
    newUsersThisMonth,
    newOrganizationsThisMonth,
    subscriptionGroups,
    planGroups,
  ] = await Promise.all([
    db.user.count(),
    db.organization.count(),
    db.contact.count(),
    db.interaction.count(),
    db.reward.count(),
    db.user.count({ where: { createdAt: { gte: monthStart } } }),
    db.organization.count({ where: { createdAt: { gte: monthStart } } }),
    db.organization.groupBy({
      by: ["subscriptionStatus"],
      _count: { id: true },
    }),
    db.organization.groupBy({
      by: ["plan"],
      _count: { id: true },
    }),
  ])

  const subscriptionBreakdown = subscriptionGroups.map((g) => ({
    status: g.subscriptionStatus,
    count: g._count.id,
  }))

  const planBreakdown = planGroups.map((g) => ({
    plan: g.plan,
    count: g._count.id,
  }))

  const activeSubscriptions = subscriptionBreakdown
    .filter((s) => s.status === "ACTIVE" || s.status === "TRIALING")
    .reduce((sum, s) => sum + s.count, 0)

  const estimatedMrr = planGroups.reduce((sum, g) => {
    return sum + (PLAN_MONTHLY_PRICE[g.plan] ?? 0) * g._count.id
  }, 0)

  return {
    totalUsers,
    totalOrganizations,
    totalContacts,
    totalInteractions,
    totalRewards,
    newUsersThisMonth,
    newOrganizationsThisMonth,
    activeSubscriptions,
    estimatedMrr,
    subscriptionBreakdown,
    planBreakdown,
  }
}

// ─── Users List ────────────────────────────────────────────

type GetAdminUsersOpts = {
  page: number
  perPage: number
  search: string
  sort: string
  order: "asc" | "desc"
  filter: "all" | "banned" | "super_admin"
}

export async function getAdminUsers(opts: GetAdminUsersOpts): Promise<AdminUsersResult> {
  await assertSuperAdmin()

  const { page, perPage, search, sort, order, filter } = opts

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ]
  }

  if (filter === "banned") {
    where.banned = true
  } else if (filter === "super_admin") {
    where.role = "SUPER_ADMIN"
  }

  const allowedSorts = ["name", "email", "createdAt", "role"]
  const sortField = allowedSorts.includes(sort) ? sort : "createdAt"

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { [sortField]: order },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.user.count({ where }),
  ])

  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      banned: u.banned,
      banReason: u.banReason,
      createdAt: u.createdAt,
      emailVerified: u.emailVerified,
    })),
    total,
    pageCount: Math.ceil(total / perPage),
  }
}

// ─── Organizations List ──────────────────────────────────────

type GetAdminOrganizationsOpts = {
  page: number
  perPage: number
  search: string
  sort: string
  order: "asc" | "desc"
  filter: "all" | "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED"
}

export async function getAdminOrganizations(opts: GetAdminOrganizationsOpts): Promise<AdminOrganizationsResult> {
  await assertSuperAdmin()

  const { page, perPage, search, sort, order, filter } = opts

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ]
  }

  if (filter !== "all") {
    where.subscriptionStatus = filter
  }

  const allowedSorts = ["name", "createdAt", "plan", "subscriptionStatus"]
  const sortField = allowedSorts.includes(sort) ? sort : "createdAt"

  const [organizations, total] = await Promise.all([
    db.organization.findMany({
      where,
      include: {
        _count: {
          select: {
            members: true,
            passTemplates: true,
            contacts: true,
          },
        },
      },
      orderBy: { [sortField]: order },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.organization.count({ where }),
  ])

  return {
    organizations: organizations.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      subscriptionStatus: o.subscriptionStatus,
      stripeCustomerId: o.stripeCustomerId,
      trialEndsAt: o.trialEndsAt,
      createdAt: o.createdAt,
      _count: o._count,
    })),
    total,
    pageCount: Math.ceil(total / perPage),
  }
}

// ─── Organization Detail ─────────────────────────────────────

export async function getAdminOrganizationDetail(id: string): Promise<AdminOrganizationDetail | null> {
  await assertSuperAdmin()

  const organization = await db.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          members: true,
          passTemplates: true,
          contacts: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
            },
          },
        },
      },
    },
  })

  if (!organization) return null

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    plan: organization.plan,
    subscriptionStatus: organization.subscriptionStatus,
    stripeCustomerId: organization.stripeCustomerId,
    trialEndsAt: organization.trialEndsAt,
    createdAt: organization.createdAt,
    _count: organization._count,
    members: organization.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      user: m.user,
    })),
  }
}

// ─── User Actions ──────────────────────────────────────────

export async function adminBanUser(formData: FormData) {
  await assertSuperAdmin()

  const parsed = banUserSchema.safeParse({
    userId: formData.get("userId"),
    banReason: formData.get("banReason") || undefined,
  })

  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  const { userId, banReason } = parsed.data

  try {
    await auth.api.banUser({
      body: { userId, banReason },
      headers: await headers(),
    })
    return { success: true }
  } catch {
    return { error: "Failed to ban user." }
  }
}

export async function adminUnbanUser(formData: FormData) {
  await assertSuperAdmin()

  const parsed = unbanUserSchema.safeParse({
    userId: formData.get("userId"),
  })

  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  try {
    await auth.api.unbanUser({
      body: { userId: parsed.data.userId },
      headers: await headers(),
    })
    return { success: true }
  } catch {
    return { error: "Failed to unban user." }
  }
}

export async function adminSetRole(formData: FormData) {
  await assertSuperAdmin()

  const parsed = setRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  })

  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  const { userId, role } = parsed.data

  try {
    await auth.api.setRole({
      body: { userId, role },
      headers: await headers(),
    })
    return { success: true }
  } catch {
    return { error: "Failed to update role." }
  }
}

export async function adminRevokeAllSessions(formData: FormData) {
  await assertSuperAdmin()

  const parsed = revokeSessionsSchema.safeParse({
    userId: formData.get("userId"),
  })

  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  try {
    await auth.api.revokeUserSessions({
      body: { userId: parsed.data.userId },
      headers: await headers(),
    })
    return { success: true }
  } catch {
    return { error: "Failed to revoke sessions." }
  }
}

export async function adminGetUserSessions(userId: string): Promise<AdminUserSession[]> {
  await assertSuperAdmin()

  try {
    const result = await auth.api.listUserSessions({
      body: { userId },
      headers: await headers(),
    })

    const sessions = (result as unknown as { sessions: Array<Record<string, unknown>> }).sessions ?? (result as unknown as Array<Record<string, unknown>>)
    return (Array.isArray(sessions) ? sessions : []).map((s) => ({
      id: s.id as string,
      createdAt: new Date(s.createdAt as string),
      expiresAt: new Date(s.expiresAt as string),
      ipAddress: (s.ipAddress as string) ?? null,
      userAgent: (s.userAgent as string) ?? null,
    }))
  } catch {
    return []
  }
}

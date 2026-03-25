"use server"

import { headers } from "next/headers"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { assertAdminRole, isAdminRole } from "@/lib/dal"
import { logAdminAction } from "@/lib/admin-audit"

// ─── Types ──────────────────────────────────────────────────

export type AdminPlatformStats = {
  totalUsers: number
  totalOrganizations: number
  totalContacts: number
  totalPassInstances: number
  totalInteractions: number
  totalRewards: number
  newUsersThisMonth: number
  newOrganizationsThisMonth: number
  activeSubscriptions: number
  estimatedMrr: number
  subscriptionBreakdown: { status: string; count: number }[]
  planBreakdown: { plan: string; count: number }[]
  passTypeBreakdown: { passType: string; count: number }[]
  recentSignups: { id: string; name: string; email: string; createdAt: Date }[]
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

export type AdminAuditLogRow = {
  id: string
  action: string
  targetType: string
  targetId: string
  targetLabel: string | null
  metadata: unknown
  reason: string | null
  ipAddress: string | null
  createdAt: Date
  admin: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

export type AdminAuditLogsResult = {
  logs: AdminAuditLogRow[]
  total: number
  pageCount: number
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
  role: z.enum(["USER", "ADMIN_SUPPORT", "ADMIN_BILLING", "ADMIN_OPS", "SUPER_ADMIN"]),
})

const revokeSessionsSchema = z.object({
  userId: z.string().min(1),
})

const impersonateSchema = z.object({
  userId: z.string().min(1),
})

// ─── Plan Pricing (for MRR estimate) ───────────────────────

const PLAN_MONTHLY_PRICE: Record<string, number> = {
  STARTER: 29,
  GROWTH: 49,
  SCALE: 99,
  ENTERPRISE: 199,
}

// ─── Platform Stats ────────────────────────────────────────

export async function getAdminPlatformStats(): Promise<AdminPlatformStats> {
  await assertAdminRole("ADMIN_SUPPORT")

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [
    totalUsers,
    totalOrganizations,
    totalContacts,
    totalPassInstances,
    totalInteractions,
    totalRewards,
    newUsersThisMonth,
    newOrganizationsThisMonth,
    subscriptionGroups,
    planGroups,
    passTypeGroups,
    recentSignups,
  ] = await Promise.all([
    db.user.count(),
    db.organization.count(),
    db.contact.count(),
    db.passInstance.count(),
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
    db.passTemplate.groupBy({
      by: ["passType"],
      _count: { id: true },
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
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

  const passTypeBreakdown = passTypeGroups
    .map((g) => ({ passType: g.passType, count: g._count.id }))
    .sort((a, b) => b.count - a.count)

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
    totalPassInstances,
    totalInteractions,
    totalRewards,
    newUsersThisMonth,
    newOrganizationsThisMonth,
    activeSubscriptions,
    estimatedMrr,
    subscriptionBreakdown,
    planBreakdown,
    passTypeBreakdown,
    recentSignups,
  }
}

// ─── Users List ────────────────────────────────────────────

type GetAdminUsersOpts = {
  page: number
  perPage: number
  search: string
  sort: string
  order: "asc" | "desc"
  filter: "all" | "banned" | "super_admin" | "admins"
}

export async function getAdminUsers(opts: GetAdminUsersOpts): Promise<AdminUsersResult> {
  await assertAdminRole("ADMIN_SUPPORT")

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
  } else if (filter === "admins") {
    where.role = { in: ["ADMIN_SUPPORT", "ADMIN_BILLING", "ADMIN_OPS", "SUPER_ADMIN"] }
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
  await assertAdminRole("ADMIN_SUPPORT")

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
  await assertAdminRole("ADMIN_SUPPORT")

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
  const session = await assertAdminRole("ADMIN_OPS")

  const parsed = banUserSchema.safeParse({
    userId: formData.get("userId"),
    banReason: formData.get("banReason") || undefined,
  })

  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  const { userId, banReason } = parsed.data

  // Self-protection: cannot ban yourself
  if (userId === session.user.id) {
    return { error: "You cannot ban yourself." }
  }

  // Look up target for audit label + role protection
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true },
  })

  // Cannot ban a user with equal or higher admin role
  if (target && isAdminRole(target.role)) {
    const ROLE_LEVEL: Record<string, number> = { ADMIN_SUPPORT: 1, ADMIN_BILLING: 2, ADMIN_OPS: 3, SUPER_ADMIN: 4 }
    if ((ROLE_LEVEL[target.role] ?? 0) >= (ROLE_LEVEL[session.user.role] ?? 0)) {
      return { error: "Cannot ban a user with equal or higher admin privileges." }
    }
  }

  try {
    await auth.api.banUser({
      body: { userId, banReason },
      headers: await headers(),
    })

    await logAdminAction({
      adminId: session.user.id,
      action: "USER_BANNED",
      targetType: "user",
      targetId: userId,
      targetLabel: target?.email ?? undefined,
      reason: banReason,
    })

    return { success: true }
  } catch {
    return { error: "Failed to ban user." }
  }
}

export async function adminUnbanUser(formData: FormData) {
  const session = await assertAdminRole("ADMIN_OPS")

  const parsed = unbanUserSchema.safeParse({
    userId: formData.get("userId"),
  })

  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  const { userId } = parsed.data

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })

  try {
    await auth.api.unbanUser({
      body: { userId },
      headers: await headers(),
    })

    await logAdminAction({
      adminId: session.user.id,
      action: "USER_UNBANNED",
      targetType: "user",
      targetId: userId,
      targetLabel: target?.email ?? undefined,
    })

    return { success: true }
  } catch {
    return { error: "Failed to unban user." }
  }
}

export async function adminSetRole(formData: FormData) {
  const session = await assertAdminRole("SUPER_ADMIN")

  const parsed = setRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  })

  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  const { userId, role } = parsed.data

  // Self-protection: cannot change own role
  if (userId === session.user.id) {
    return { error: "You cannot change your own role." }
  }

  // Single query for target info (used for audit log + guards)
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true },
  })

  // Last super admin protection
  if (role !== "SUPER_ADMIN" && target?.role === "SUPER_ADMIN") {
    const superAdminCount = await db.user.count({
      where: { role: "SUPER_ADMIN" },
    })
    if (superAdminCount <= 1) {
      return { error: "Cannot demote the last Super Admin." }
    }
  }

  try {
    // Use direct DB update — Better Auth's setRole doesn't know all custom admin roles
    await db.user.update({
      where: { id: userId },
      data: { role },
    })

    await logAdminAction({
      adminId: session.user.id,
      action: "USER_ROLE_CHANGED",
      targetType: "user",
      targetId: userId,
      targetLabel: target?.email ?? undefined,
      metadata: { oldRole: target?.role, newRole: role },
    })

    return { success: true }
  } catch {
    return { error: "Failed to update role." }
  }
}

export async function adminRevokeAllSessions(formData: FormData) {
  const session = await assertAdminRole("ADMIN_OPS")

  const parsed = revokeSessionsSchema.safeParse({
    userId: formData.get("userId"),
  })

  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  const { userId } = parsed.data

  // Self-protection: cannot revoke your own sessions
  if (userId === session.user.id) {
    return { error: "You cannot revoke your own sessions." }
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true },
  })

  // Cannot revoke sessions of a user with equal or higher admin role
  if (target && isAdminRole(target.role)) {
    const ROLE_LEVEL: Record<string, number> = { ADMIN_SUPPORT: 1, ADMIN_BILLING: 2, ADMIN_OPS: 3, SUPER_ADMIN: 4 }
    if ((ROLE_LEVEL[target.role] ?? 0) >= (ROLE_LEVEL[session.user.role] ?? 0)) {
      return { error: "Cannot revoke sessions of a user with equal or higher admin privileges." }
    }
  }

  try {
    await auth.api.revokeUserSessions({
      body: { userId },
      headers: await headers(),
    })

    await logAdminAction({
      adminId: session.user.id,
      action: "USER_SESSIONS_REVOKED",
      targetType: "user",
      targetId: userId,
      targetLabel: target?.email ?? undefined,
    })

    return { success: true }
  } catch {
    return { error: "Failed to revoke sessions." }
  }
}

export async function adminGetUserSessions(userId: string): Promise<AdminUserSession[]> {
  await assertAdminRole("ADMIN_SUPPORT")

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

// ─── Impersonation (server-side for audit logging) ──────────

export async function adminImpersonateUser(formData: FormData) {
  const session = await assertAdminRole("ADMIN_SUPPORT")

  const parsed = impersonateSchema.safeParse({
    userId: formData.get("userId"),
  })

  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  const { userId } = parsed.data

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })

  await logAdminAction({
    adminId: session.user.id,
    action: "USER_IMPERSONATED",
    targetType: "user",
    targetId: userId,
    targetLabel: target?.email ?? undefined,
  })

  return { success: true }
}

// Note: adminStopImpersonating is not implementable because during impersonation
// the session belongs to the impersonated user (role: USER), so assertAdminRole
// would fail. Impersonation end is handled by Better Auth client-side.
// The impersonation START is logged, which is the security-critical event.

// ─── Audit Log Query ────────────────────────────────────────

type GetAdminAuditLogsOpts = {
  page: number
  perPage: number
  search: string
  action: string
  targetType: string
}

export async function getAdminAuditLogs(opts: GetAdminAuditLogsOpts): Promise<AdminAuditLogsResult> {
  await assertAdminRole("ADMIN_SUPPORT")

  const { page, perPage, search, action, targetType } = opts

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { targetLabel: { contains: search, mode: "insensitive" } },
      { targetId: { contains: search, mode: "insensitive" } },
      { reason: { contains: search, mode: "insensitive" } },
    ]
  }

  if (action && action !== "all") {
    where.action = action
  }

  if (targetType && targetType !== "all") {
    where.targetType = targetType
  }

  const [logs, total] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      include: {
        admin: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.adminAuditLog.count({ where }),
  ])

  return {
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      targetLabel: l.targetLabel,
      metadata: l.metadata,
      reason: l.reason,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
      admin: l.admin,
    })),
    total,
    pageCount: Math.ceil(total / perPage),
  }
}

// ─── Feature Flags ──────────────────────────────────────────

import { ALL_PASS_TYPES, type PassType } from "@/lib/plans"

const VALID_PASS_TYPES = new Set<string>(ALL_PASS_TYPES)

/** Get the current disabled pass types from PlatformConfig */
export async function getFeatureFlags(): Promise<{ disabledPassTypes: PassType[] }> {
  await assertAdminRole("ADMIN_OPS")

  const config = await db.platformConfig.findUnique({
    where: { id: "singleton" },
    select: { disabledPassTypes: true },
  })

  return {
    disabledPassTypes: (config?.disabledPassTypes ?? ["BUSINESS_CARD"]) as PassType[],
  }
}

const updateFeatureFlagsSchema = z.object({
  disabledPassTypes: z.array(z.string().refine((v) => VALID_PASS_TYPES.has(v), "Invalid pass type")),
})

/** Update the disabled pass types list. Requires ADMIN_OPS or higher. */
export async function updateFeatureFlags(input: z.infer<typeof updateFeatureFlagsSchema>) {
  const session = await assertAdminRole("ADMIN_OPS")
  const parsed = updateFeatureFlagsSchema.parse(input)

  await db.platformConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      disabledPassTypes: parsed.disabledPassTypes,
    },
    update: {
      disabledPassTypes: parsed.disabledPassTypes,
    },
  })

  // Audit log
  await logAdminAction({
    adminId: session.user.id,
    action: "ORG_STATUS_CHANGED",
    targetType: "organization",
    targetId: "platform",
    targetLabel: "Feature Flags",
    metadata: { disabledPassTypes: parsed.disabledPassTypes },
  })

  return { success: true }
}

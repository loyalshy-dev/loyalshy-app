"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import {
  assertAuthenticated,
  getOrganizationForUser,
  assertOrganizationAccess,
} from "@/lib/dal"
import { parseCouponConfig } from "@/lib/pass-config"
import { Prisma } from "@prisma/client"
import { startOfMonth, subMonths } from "date-fns"

// ─── Types ──────────────────────────────────────────────────

export type RewardRow = {
  id: string
  contactName: string
  contactId: string
  description: string
  status: string
  earnedAt: Date
  redeemedAt: Date | null
  expiresAt: Date
  redeemedByName: string | null
  templateName: string
  templateId: string
}

export type RewardListResult = {
  rewards: RewardRow[]
  total: number
  pageCount: number
}

export type RewardStats = {
  totalAvailable: number
  redeemedThisMonth: number
  expiredThisMonth: number
  redemptionRate: number
  avgDaysToRedeem: number | null
}

export type RedeemRewardResult = {
  success: boolean
  error?: string
}

// ─── Helpers ────────────────────────────────────────────────

async function requireOrganization() {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) redirect("/register?step=2")
  return organization
}

// ─── Get Rewards (Paginated, Tabbed, Searchable) ────────────

export type GetRewardsParams = {
  tab?: "available" | "redeemed" | "expired"
  page?: number
  perPage?: number
  search?: string
  sort?: string
  order?: "asc" | "desc"
  dateFrom?: string
  dateTo?: string
  templateId?: string
}

export async function getRewards(
  params: GetRewardsParams
): Promise<RewardListResult> {
  const organization = await requireOrganization()
  const organizationId = organization.id

  const tab = params.tab ?? "available"
  const page = params.page ?? 1
  const perPage = params.perPage ?? 20
  const skip = (page - 1) * perPage
  const search = params.search?.trim() ?? ""
  const sortField = params.sort ?? "earnedAt"
  const sortOrder = params.order ?? "desc"

  // Build where clause
  const where: Record<string, unknown> = { organizationId }

  // Template filter
  if (params.templateId) {
    where.passTemplateId = params.templateId
  }

  // Status filter based on tab
  switch (tab) {
    case "available":
      where.status = "AVAILABLE"
      break
    case "redeemed":
      where.status = "REDEEMED"
      break
    case "expired":
      where.status = "EXPIRED"
      break
  }

  // Search by contact name
  if (search) {
    where.contact = {
      fullName: { contains: search, mode: "insensitive" },
    }
  }

  // Date range filter on earnedAt
  if (params.dateFrom || params.dateTo) {
    const earnedAtFilter: Record<string, Date> = {}
    if (params.dateFrom) earnedAtFilter.gte = new Date(params.dateFrom)
    if (params.dateTo) {
      const to = new Date(params.dateTo)
      to.setHours(23, 59, 59, 999)
      earnedAtFilter.lte = to
    }
    where.earnedAt = earnedAtFilter
  }

  // Map sortable fields
  const allowedSorts: Record<string, string> = {
    earnedAt: "earnedAt",
    redeemedAt: "redeemedAt",
    expiresAt: "expiresAt",
  }
  const orderByField = allowedSorts[sortField] ?? "earnedAt"

  const [rewards, total] = await Promise.all([
    db.reward.findMany({
      where: where as Prisma.RewardWhereInput,
      include: {
        contact: { select: { id: true, fullName: true } },
        passTemplate: { select: { id: true, name: true } },
        passInstance: { select: { id: true, data: true, status: true } },
        redeemedBy: { select: { name: true } },
      },
      orderBy: { [orderByField]: sortOrder },
      skip,
      take: perPage,
    }),
    db.reward.count({ where: where as Prisma.RewardWhereInput }),
  ])

  return {
    rewards: rewards.map((r) => ({
      id: r.id,
      contactName: r.contact.fullName,
      contactId: r.contact.id,
      description: r.passTemplate.name,
      status: r.status,
      earnedAt: r.earnedAt,
      redeemedAt: r.redeemedAt,
      expiresAt: r.expiresAt,
      redeemedByName: r.redeemedBy?.name ?? null,
      templateName: r.passTemplate.name,
      templateId: r.passTemplate.id,
    })),
    total,
    pageCount: Math.ceil(total / perPage),
  }
}

// ─── Get Reward Stats ───────────────────────────────────────

export async function getRewardStats(templateId?: string): Promise<RewardStats> {
  const organization = await requireOrganization()
  const organizationId = organization.id

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))

  // Base where clause
  const baseWhere: Record<string, unknown> = { organizationId }
  if (templateId) {
    baseWhere.passTemplateId = templateId
  }

  const [totalAvailable, redeemedThisMonth, expiredThisMonth, totalRedeemed, totalExpired] =
    await Promise.all([
      db.reward.count({
        where: { ...baseWhere, status: "AVAILABLE" } as Prisma.RewardWhereInput,
      }),
      db.reward.count({
        where: {
          ...baseWhere,
          status: "REDEEMED",
          redeemedAt: { gte: thisMonthStart },
        } as Prisma.RewardWhereInput,
      }),
      db.reward.count({
        where: {
          ...baseWhere,
          status: "EXPIRED",
          expiresAt: { gte: lastMonthStart },
        } as Prisma.RewardWhereInput,
      }),
      db.reward.count({
        where: { ...baseWhere, status: "REDEEMED" } as Prisma.RewardWhereInput,
      }),
      db.reward.count({
        where: { ...baseWhere, status: "EXPIRED" } as Prisma.RewardWhereInput,
      }),
    ])

  const completed = totalRedeemed + totalExpired
  const redemptionRate = completed > 0 ? Math.round((totalRedeemed / completed) * 100) : 0

  const templateFilter = templateId
    ? Prisma.sql`AND "passTemplateId" = ${templateId}`
    : Prisma.empty

  const avgResult = await db.$queryRaw<
    { avg_days: number | null }[]
  >`SELECT AVG(EXTRACT(EPOCH FROM ("redeemedAt" - "earnedAt")) / 86400)::float AS avg_days
    FROM reward
    WHERE "organizationId" = ${organizationId}
      AND status = 'redeemed'
      AND "redeemedAt" IS NOT NULL
      ${templateFilter}`

  const avgDaysToRedeem = avgResult[0]?.avg_days
    ? Math.round(avgResult[0].avg_days * 10) / 10
    : null

  return {
    totalAvailable,
    redeemedThisMonth,
    expiredThisMonth,
    redemptionRate,
    avgDaysToRedeem,
  }
}

// ─── Redeem Reward ──────────────────────────────────────────

export async function redeemReward(
  rewardId: string
): Promise<RedeemRewardResult> {
  const session = await assertAuthenticated()
  const organization = await getOrganizationForUser()

  if (!organization) {
    return { success: false, error: "No organization found" }
  }

  await assertOrganizationAccess(organization.id)

  // Find the reward
  const reward = await db.reward.findFirst({
    where: {
      id: rewardId,
      organizationId: organization.id,
    },
    select: {
      id: true,
      status: true,
      contactId: true,
      passInstanceId: true,
      expiresAt: true,
      revealedAt: true,
      passInstance: {
        select: {
          passTemplate: {
            select: { passType: true, config: true },
          },
        },
      },
    },
  })

  if (!reward) {
    return { success: false, error: "Reward not found" }
  }

  if (reward.status !== "AVAILABLE") {
    return {
      success: false,
      error: `This reward has already been ${reward.status.toLowerCase()}`,
    }
  }

  if (reward.expiresAt < new Date()) {
    await db.reward.update({
      where: { id: rewardId },
      data: { status: "EXPIRED" },
    })
    return { success: false, error: "This reward has expired" }
  }

  // Check if this is a single-use coupon
  const isCoupon = reward.passInstance?.passTemplate?.passType === "COUPON"
  const couponConfig = isCoupon ? parseCouponConfig(reward.passInstance?.passTemplate?.config) : null
  const isSingleUse = couponConfig?.redemptionLimit === "single"

  // Redeem in a transaction
  await db.$transaction(async (tx) => {
    await tx.reward.update({
      where: { id: rewardId },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedById: session.user.id,
        ...(!reward.revealedAt ? { revealedAt: new Date() } : {}),
      },
    })

    // Update pass instance if needed
    if (reward.passInstanceId) {
      const currentInstance = await tx.passInstance.findUnique({
        where: { id: reward.passInstanceId },
        select: { data: true },
      })
      const instanceData = (currentInstance?.data as Record<string, unknown>) ?? {}
      const totalRewardsRedeemed = ((instanceData.totalRewardsRedeemed as number) ?? 0) + 1

      await tx.passInstance.update({
        where: { id: reward.passInstanceId },
        data: {
          data: {
            ...instanceData,
            totalRewardsRedeemed,
          },
          ...(isSingleUse ? { status: "COMPLETED" } : {}),
        },
      })
    }
  })

  // Dispatch wallet pass update
  if (reward.passInstanceId) {
    if (process.env.TRIGGER_SECRET_KEY) {
      import("@trigger.dev/sdk")
        .then(({ tasks }) =>
          tasks.trigger("update-wallet-pass", {
            passInstanceId: reward.passInstanceId,
            updateType: "REWARD_REDEEMED",
          })
        )
        .catch((err: unknown) => console.error("Wallet pass update dispatch failed:", err instanceof Error ? err.message : "Unknown error"))
    } else {
      import("@/lib/wallet/google/update-pass")
        .then(({ notifyGooglePassUpdate }) => notifyGooglePassUpdate(reward.passInstanceId!))
        .catch((err: unknown) => console.error("Direct Google pass update failed:", err instanceof Error ? err.message : "Unknown error"))
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/rewards")
  revalidatePath("/dashboard/customers")

  return { success: true }
}

// ─── Get Reward Detail (for redeem dialog) ──────────────────

export type RewardDetail = {
  id: string
  contactName: string
  description: string
  templateName: string
  earnedAt: Date
  expiresAt: Date
  status: string
}

export async function getRewardDetail(
  rewardId: string
): Promise<RewardDetail | null> {
  const organization = await requireOrganization()

  const reward = await db.reward.findFirst({
    where: {
      id: rewardId,
      organizationId: organization.id,
    },
    include: {
      contact: { select: { fullName: true } },
      passTemplate: { select: { name: true } },
    },
  })

  if (!reward) return null

  return {
    id: reward.id,
    contactName: reward.contact.fullName,
    description: reward.passTemplate.name,
    templateName: reward.passTemplate.name,
    earnedAt: reward.earnedAt,
    expiresAt: reward.expiresAt,
    status: reward.status,
  }
}

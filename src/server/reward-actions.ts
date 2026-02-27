"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import {
  assertAuthenticated,
  getRestaurantForUser,
  assertRestaurantAccess,
} from "@/lib/dal"
import { Prisma } from "@prisma/client"
import { startOfMonth, subMonths } from "date-fns"

// ─── Types ──────────────────────────────────────────────────

export type RewardRow = {
  id: string
  customerName: string
  customerId: string
  description: string
  status: string
  earnedAt: Date
  redeemedAt: Date | null
  expiresAt: Date
  redeemedByName: string | null
  programName: string
  programId: string
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

async function requireRestaurant() {
  await assertAuthenticated()
  const restaurant = await getRestaurantForUser()
  if (!restaurant) redirect("/register?step=2")
  return restaurant
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
  programId?: string
}

export async function getRewards(
  params: GetRewardsParams
): Promise<RewardListResult> {
  const restaurant = await requireRestaurant()
  const restaurantId = restaurant.id

  const tab = params.tab ?? "available"
  const page = params.page ?? 1
  const perPage = params.perPage ?? 20
  const skip = (page - 1) * perPage
  const search = params.search?.trim() ?? ""
  const sortField = params.sort ?? "earnedAt"
  const sortOrder = params.order ?? "desc"

  // Build where clause
  const where: Record<string, unknown> = { restaurantId }

  // Program filter
  if (params.programId) {
    where.loyaltyProgramId = params.programId
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

  // Search by customer name
  if (search) {
    where.customer = {
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
        customer: { select: { id: true, fullName: true } },
        loyaltyProgram: { select: { id: true, name: true, rewardDescription: true } },
        enrollment: { select: { id: true, currentCycleVisits: true, totalVisits: true, totalRewardsRedeemed: true, status: true } },
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
      customerName: r.customer.fullName,
      customerId: r.customer.id,
      description: r.loyaltyProgram.rewardDescription,
      status: r.status,
      earnedAt: r.earnedAt,
      redeemedAt: r.redeemedAt,
      expiresAt: r.expiresAt,
      redeemedByName: r.redeemedBy?.name ?? null,
      programName: r.loyaltyProgram.name,
      programId: r.loyaltyProgram.id,
    })),
    total,
    pageCount: Math.ceil(total / perPage),
  }
}

// ─── Get Reward Stats ───────────────────────────────────────

export async function getRewardStats(programId?: string): Promise<RewardStats> {
  const restaurant = await requireRestaurant()
  const restaurantId = restaurant.id

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))

  // Base where clause — scoped to program when provided
  const baseWhere: Record<string, unknown> = { restaurantId }
  if (programId) {
    baseWhere.loyaltyProgramId = programId
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

  // Redemption rate = redeemed / (redeemed + expired) — excludes still-available
  const completed = totalRedeemed + totalExpired
  const redemptionRate = completed > 0 ? Math.round((totalRedeemed / completed) * 100) : 0

  // Average days from earnedAt to redeemedAt for redeemed rewards
  const programFilter = programId
    ? Prisma.sql`AND "loyaltyProgramId" = ${programId}`
    : Prisma.empty

  const avgResult = await db.$queryRaw<
    { avg_days: number | null }[]
  >`SELECT AVG(EXTRACT(EPOCH FROM ("redeemedAt" - "earnedAt")) / 86400)::float AS avg_days
    FROM reward
    WHERE "restaurantId" = ${restaurantId}
      AND status = 'redeemed'
      AND "redeemedAt" IS NOT NULL
      ${programFilter}`

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
  const restaurant = await getRestaurantForUser()

  if (!restaurant) {
    return { success: false, error: "No restaurant found" }
  }

  // Verify staff has access to this restaurant
  await assertRestaurantAccess(restaurant.id)

  // Find the reward
  const reward = await db.reward.findFirst({
    where: {
      id: rewardId,
      restaurantId: restaurant.id,
    },
    select: {
      id: true,
      status: true,
      customerId: true,
      enrollmentId: true,
      expiresAt: true,
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

  // Check if expired
  if (reward.expiresAt < new Date()) {
    // Auto-expire it
    await db.reward.update({
      where: { id: rewardId },
      data: { status: "EXPIRED" },
    })
    return { success: false, error: "This reward has expired" }
  }

  // Redeem in a transaction
  await db.$transaction(async (tx) => {
    await tx.reward.update({
      where: { id: rewardId },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedById: session.user.id,
      },
    })

    // Update enrollment's totalRewardsRedeemed if enrollment exists
    if (reward.enrollmentId) {
      await tx.enrollment.update({
        where: { id: reward.enrollmentId },
        data: { totalRewardsRedeemed: { increment: 1 } },
      })
    }
  })

  // Dispatch wallet pass update via Trigger.dev (async background job)
  if (reward.enrollmentId) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-wallet-pass", {
          enrollmentId: reward.enrollmentId,
          updateType: "REWARD_REDEEMED",
        })
      )
      .catch((err: unknown) => console.error("Wallet pass update dispatch failed:", err instanceof Error ? err.message : "Unknown error"))
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/rewards")
  revalidatePath("/dashboard/customers")

  return { success: true }
}

// ─── Get Reward Detail (for redeem dialog) ──────────────────

export type RewardDetail = {
  id: string
  customerName: string
  description: string
  programName: string
  earnedAt: Date
  expiresAt: Date
  status: string
}

export async function getRewardDetail(
  rewardId: string
): Promise<RewardDetail | null> {
  const restaurant = await requireRestaurant()

  const reward = await db.reward.findFirst({
    where: {
      id: rewardId,
      restaurantId: restaurant.id,
    },
    include: {
      customer: { select: { fullName: true } },
      loyaltyProgram: { select: { name: true, rewardDescription: true } },
    },
  })

  if (!reward) return null

  return {
    id: reward.id,
    customerName: reward.customer.fullName,
    description: reward.loyaltyProgram.rewardDescription,
    programName: reward.loyaltyProgram.name,
    earnedAt: reward.earnedAt,
    expiresAt: reward.expiresAt,
    status: reward.status,
  }
}

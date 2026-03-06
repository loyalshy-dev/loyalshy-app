"use server"

import { db } from "@/lib/db"
import { assertAuthenticated, getRestaurantForUser } from "@/lib/dal"
import { redirect } from "next/navigation"
import {
  subDays,
  subMonths,
  startOfDay,
  startOfMonth,
  endOfDay,
  format,
  eachDayOfInterval,
} from "date-fns"

// ─── Types ──────────────────────────────────────────────────

export type EnrollmentsByType = {
  STAMP_CARD: number
  COUPON: number
  MEMBERSHIP: number
  POINTS: number
  PREPAID: number
}

export type OverviewStats = {
  totalCustomers: number
  totalCustomersChange: number
  activityThisMonth: number
  activityChange: number
  activeRewards: number
  rewardsRedeemedThisMonth: number
  rewardsRedeemedChange: number
  activeEnrollments: number
  enrollmentsByType: EnrollmentsByType
}

export type VisitsDataPoint = {
  date: string
  visits: number
}

export type BusiestDayData = {
  day: string
  visits: number
}

export type RewardDistributionItem = {
  position: number
  count: number
}

export type ActivityItem = {
  id: string
  type: "visit" | "reward_earned" | "reward_redeemed" | "check_in" | "coupon_redeemed" | "prepaid_use" | "prepaid_recharge" | "points_earned"
  customerName: string
  staffName: string | null
  programName: string | null
  createdAt: Date
  detail: string | null
}

export type TopCustomerItem = {
  id: string
  fullName: string
  totalVisits: number
  lastVisitAt: Date | null
  primaryProgramType: string | null
  engagementLabel: string
}

export type ProgramSummaryItem = {
  id: string
  name: string
  programType: "STAMP_CARD" | "COUPON" | "MEMBERSHIP" | "POINTS" | "PREPAID"
  activeEnrollments: number
  totalVisits: number
  redeemedRewards: number
  availableRewards: number
}

// ─── Helpers ────────────────────────────────────────────────

async function requireRestaurantId(): Promise<string> {
  await assertAuthenticated()
  const restaurant = await getRestaurantForUser()
  if (!restaurant) redirect("/register?step=2")
  return restaurant.id
}

// ─── 1. Overview Stats ──────────────────────────────────────

export async function getOverviewStats(): Promise<OverviewStats> {
  const restaurantId = await requireRestaurantId()

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = startOfDay(thisMonthStart)

  // Run all queries in parallel
  const [
    totalCustomers,
    customersLastMonth,
    visitsThisMonth,
    visitsLastMonth,
    couponRedemptionsThisMonth,
    couponRedemptionsLastMonth,
    activeRewards,
    rewardsRedeemedThisMonth,
    rewardsRedeemedLastMonth,
    enrollmentsByTypeRaw,
  ] = await Promise.all([
    db.customer.count({ where: { restaurantId, deletedAt: null } }),
    db.customer.count({
      where: {
        restaurantId,
        deletedAt: null,
        createdAt: { lt: thisMonthStart },
      },
    }),
    db.visit.count({
      where: {
        restaurantId,
        createdAt: { gte: thisMonthStart },
      },
    }),
    db.visit.count({
      where: {
        restaurantId,
        createdAt: { gte: lastMonthStart, lt: lastMonthEnd },
      },
    }),
    // Coupon redemptions this month
    db.reward.count({
      where: {
        restaurantId,
        status: "REDEEMED",
        redeemedAt: { gte: thisMonthStart },
        loyaltyProgram: { programType: "COUPON" },
      },
    }),
    // Coupon redemptions last month
    db.reward.count({
      where: {
        restaurantId,
        status: "REDEEMED",
        redeemedAt: { gte: lastMonthStart, lt: lastMonthEnd },
        loyaltyProgram: { programType: "COUPON" },
      },
    }),
    db.reward.count({
      where: {
        restaurantId,
        status: "AVAILABLE",
        expiresAt: { gt: now },
      },
    }),
    db.reward.count({
      where: {
        restaurantId,
        status: "REDEEMED",
        redeemedAt: { gte: thisMonthStart },
      },
    }),
    db.reward.count({
      where: {
        restaurantId,
        status: "REDEEMED",
        redeemedAt: { gte: lastMonthStart, lt: lastMonthEnd },
      },
    }),
    // Active enrollments grouped by program type
    db.enrollment.groupBy({
      by: ["loyaltyProgramId"],
      where: {
        status: "ACTIVE",
        loyaltyProgram: { restaurantId },
      },
      _count: { id: true },
    }).then(async (groups) => {
      // Resolve program types for each group
      if (groups.length === 0) return [] as { programType: string; count: number }[]
      const programIds = groups.map((g) => g.loyaltyProgramId)
      const programs = await db.loyaltyProgram.findMany({
        where: { id: { in: programIds } },
        select: { id: true, programType: true },
      })
      const typeMap = new Map(programs.map((p) => [p.id, p.programType]))
      return groups.map((g) => ({
        programType: typeMap.get(g.loyaltyProgramId) ?? "STAMP_CARD",
        count: g._count.id,
      }))
    }),
  ])

  // Activity = visits + coupon redemptions
  const activityThisMonth = visitsThisMonth + couponRedemptionsThisMonth
  const activityLastMonth = visitsLastMonth + couponRedemptionsLastMonth

  // Calculate percentage changes
  const totalCustomersChange =
    customersLastMonth > 0
      ? Math.round(
          ((totalCustomers - customersLastMonth) / customersLastMonth) * 100
        )
      : totalCustomers > 0
        ? 100
        : 0

  const activityChange =
    activityLastMonth > 0
      ? Math.round(
          ((activityThisMonth - activityLastMonth) / activityLastMonth) * 100
        )
      : activityThisMonth > 0
        ? 100
        : 0

  const rewardsRedeemedChange =
    rewardsRedeemedLastMonth > 0
      ? Math.round(
          ((rewardsRedeemedThisMonth - rewardsRedeemedLastMonth) /
            rewardsRedeemedLastMonth) *
            100
        )
      : rewardsRedeemedThisMonth > 0
        ? 100
        : 0

  // Aggregate enrollment counts by type
  const enrollmentsByType: EnrollmentsByType = {
    STAMP_CARD: 0, COUPON: 0, MEMBERSHIP: 0, POINTS: 0, PREPAID: 0,
  }
  let activeEnrollments = 0
  for (const e of enrollmentsByTypeRaw) {
    const key = e.programType as keyof EnrollmentsByType
    if (key in enrollmentsByType) {
      enrollmentsByType[key] += e.count
    }
    activeEnrollments += e.count
  }

  return {
    totalCustomers,
    totalCustomersChange,
    activityThisMonth,
    activityChange,
    activeRewards,
    rewardsRedeemedThisMonth,
    rewardsRedeemedChange,
    activeEnrollments,
    enrollmentsByType,
  }
}

// ─── 2. Visits Over Time ────────────────────────────────────

export async function getVisitsOverTime(
  range: "7d" | "30d" | "90d" | "12m"
): Promise<VisitsDataPoint[]> {
  const restaurantId = await requireRestaurantId()

  const now = new Date()
  let startDate: Date

  switch (range) {
    case "7d":
      startDate = subDays(now, 6)
      break
    case "30d":
      startDate = subDays(now, 29)
      break
    case "90d":
      startDate = subDays(now, 89)
      break
    case "12m":
      startDate = subMonths(now, 12)
      break
  }

  startDate = startOfDay(startDate)

  // Try AnalyticsSnapshot first for historical data
  const snapshots = await db.analyticsSnapshot.findMany({
    where: {
      restaurantId,
      date: { gte: startDate, lte: endOfDay(now) },
    },
    select: { date: true, totalVisits: true },
    orderBy: { date: "asc" },
  })

  const snapshotMap = new Map<string, number>()
  for (const s of snapshots) {
    snapshotMap.set(format(s.date, "yyyy-MM-dd"), s.totalVisits)
  }

  // Live query for visits and coupon redemptions in parallel
  const [visits, couponRedemptions] = await Promise.all([
    db.visit.groupBy({
      by: ["createdAt"],
      where: {
        restaurantId,
        createdAt: { gte: startDate },
      },
      _count: { id: true },
    }),
    db.reward.groupBy({
      by: ["redeemedAt"],
      where: {
        restaurantId,
        status: "REDEEMED",
        redeemedAt: { gte: startDate },
        loyaltyProgram: { programType: "COUPON" },
      },
      _count: { id: true },
    }),
  ])

  // Build daily count from raw visits + coupon redemptions
  const liveMap = new Map<string, number>()
  for (const v of visits) {
    const day = format(v.createdAt, "yyyy-MM-dd")
    liveMap.set(day, (liveMap.get(day) ?? 0) + v._count.id)
  }
  for (const r of couponRedemptions) {
    if (!r.redeemedAt) continue
    const day = format(r.redeemedAt, "yyyy-MM-dd")
    liveMap.set(day, (liveMap.get(day) ?? 0) + r._count.id)
  }

  // Generate complete date range
  const days = eachDayOfInterval({ start: startDate, end: now })

  return days.map((d) => {
    const key = format(d, "yyyy-MM-dd")
    return {
      date: key,
      visits: snapshotMap.get(key) ?? liveMap.get(key) ?? 0,
    }
  })
}

// ─── 3. Busiest Days ────────────────────────────────────────

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export async function getBusiestDays(): Promise<BusiestDayData[]> {
  const restaurantId = await requireRestaurantId()

  const ninetyDaysAgo = subDays(new Date(), 90)

  // Raw SQL for day-of-week aggregation (Prisma doesn't support EXTRACT natively)
  const [visitResult, couponResult] = await Promise.all([
    db.$queryRaw<
      { dow: number; count: bigint }[]
    >`SELECT EXTRACT(DOW FROM "createdAt") AS dow, COUNT(*) AS count
      FROM visit
      WHERE "restaurantId" = ${restaurantId}
        AND "createdAt" >= ${ninetyDaysAgo}
      GROUP BY dow
      ORDER BY dow`,
    db.$queryRaw<
      { dow: number; count: bigint }[]
    >`SELECT EXTRACT(DOW FROM r."redeemedAt") AS dow, COUNT(*) AS count
      FROM reward r
      JOIN loyalty_program lp ON lp.id = r."loyaltyProgramId"
      WHERE r."restaurantId" = ${restaurantId}
        AND r.status = 'redeemed'
        AND r."redeemedAt" >= ${ninetyDaysAgo}
        AND lp."programType" = 'coupon'
      GROUP BY dow
      ORDER BY dow`,
  ])

  // Fill all 7 days, merging visits + coupon redemptions
  const countMap = new Map<number, number>()
  for (const r of visitResult) {
    const dow = Number(r.dow)
    countMap.set(dow, (countMap.get(dow) ?? 0) + Number(r.count))
  }
  for (const r of couponResult) {
    const dow = Number(r.dow)
    countMap.set(dow, (countMap.get(dow) ?? 0) + Number(r.count))
  }

  // Reorder to Mon-Sun
  const ordered = [1, 2, 3, 4, 5, 6, 0]
  return ordered.map((dow) => ({
    day: WEEKDAY_NAMES[dow],
    visits: countMap.get(dow) ?? 0,
  }))
}

// ─── 4. Reward Cycle Distribution ───────────────────────────

export async function getRewardDistribution(
  visitsRequired: number,
  programId?: string
): Promise<RewardDistributionItem[]> {
  const restaurantId = await requireRestaurantId()

  // Query enrollments instead of customers for per-program distribution
  const enrollmentWhere: {
    loyaltyProgram: { restaurantId: string }
    status: "ACTIVE"
    loyaltyProgramId?: string
  } = {
    loyaltyProgram: { restaurantId },
    status: "ACTIVE",
  }

  if (programId) {
    enrollmentWhere.loyaltyProgramId = programId
  }

  const enrollments = await db.enrollment.groupBy({
    by: ["currentCycleVisits"],
    where: enrollmentWhere,
    _count: { id: true },
  })

  // Build distribution map: position 0 to visitsRequired-1
  const distribution: RewardDistributionItem[] = []
  const countMap = new Map<number, number>()
  for (const e of enrollments) {
    countMap.set(e.currentCycleVisits, e._count.id)
  }

  for (let i = 0; i < visitsRequired; i++) {
    distribution.push({
      position: i,
      count: countMap.get(i) ?? 0,
    })
  }

  return distribution
}

// ─── 5. Recent Activity ─────────────────────────────────────

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const restaurantId = await requireRestaurantId()

  // Fetch recent visits and recent reward events in parallel
  const [recentVisits, recentRewards] = await Promise.all([
    db.visit.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        visitNumber: true,
        createdAt: true,
        customer: { select: { fullName: true } },
        registeredBy: { select: { name: true } },
        loyaltyProgram: { select: { name: true, programType: true } },
      },
    }),
    db.reward.findMany({
      where: { restaurantId },
      orderBy: { earnedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        earnedAt: true,
        redeemedAt: true,
        customer: { select: { fullName: true } },
        redeemedBy: { select: { name: true } },
        loyaltyProgram: { select: { name: true, rewardDescription: true, programType: true } },
      },
    }),
  ])

  const items: ActivityItem[] = []

  for (const v of recentVisits) {
    // Classify visit type based on program type
    const pType = v.loyaltyProgram.programType
    const type = pType === "MEMBERSHIP"
      ? "check_in" as const
      : pType === "PREPAID"
        ? "prepaid_use" as const
        : pType === "POINTS"
          ? "points_earned" as const
          : "visit" as const

    const detail = pType === "MEMBERSHIP"
      ? v.loyaltyProgram.name
      : pType === "PREPAID"
        ? v.loyaltyProgram.name
        : pType === "POINTS"
          ? v.loyaltyProgram.name
          : `Visit #${v.visitNumber}`

    items.push({
      id: v.id,
      type,
      customerName: v.customer.fullName,
      staffName: v.registeredBy?.name ?? null,
      programName: v.loyaltyProgram.name,
      createdAt: v.createdAt,
      detail,
    })
  }

  for (const r of recentRewards) {
    if (r.status === "REDEEMED" && r.redeemedAt) {
      // Classify coupon redemptions separately
      const isCoupon = r.loyaltyProgram.programType === "COUPON"
      items.push({
        id: `${r.id}-redeemed`,
        type: isCoupon ? "coupon_redeemed" : "reward_redeemed",
        customerName: r.customer.fullName,
        staffName: r.redeemedBy?.name ?? null,
        programName: r.loyaltyProgram.name,
        createdAt: r.redeemedAt,
        detail: r.loyaltyProgram.rewardDescription,
      })
    }
    // Only show "earned a reward" for non-coupon programs
    // (coupon rewards are auto-created on enrollment, not meaningful as activity)
    if (r.loyaltyProgram.programType !== "COUPON") {
      items.push({
        id: r.id,
        type: "reward_earned",
        customerName: r.customer.fullName,
        staffName: null,
        programName: r.loyaltyProgram.name,
        createdAt: r.earnedAt,
        detail: r.loyaltyProgram.rewardDescription,
      })
    }
  }

  // Sort by date descending, take 10
  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return items.slice(0, 10)
}

// ─── 6. Programs Summary ────────────────────────────────────

export async function getProgramsSummary(): Promise<ProgramSummaryItem[]> {
  const restaurantId = await requireRestaurantId()

  const programs = await db.loyaltyProgram.findMany({
    where: { restaurantId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      programType: true,
      _count: {
        select: {
          enrollments: { where: { status: "ACTIVE" } },
          visits: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  if (programs.length === 0) return []

  // Batch query reward counts per program
  const programIds = programs.map((p) => p.id)
  const [redeemedCounts, availableCounts] = await Promise.all([
    db.reward.groupBy({
      by: ["loyaltyProgramId"],
      where: {
        loyaltyProgramId: { in: programIds },
        status: "REDEEMED",
      },
      _count: { id: true },
    }),
    db.reward.groupBy({
      by: ["loyaltyProgramId"],
      where: {
        loyaltyProgramId: { in: programIds },
        status: "AVAILABLE",
      },
      _count: { id: true },
    }),
  ])

  const redeemedMap = new Map(redeemedCounts.map((r) => [r.loyaltyProgramId, r._count.id]))
  const availableMap = new Map(availableCounts.map((r) => [r.loyaltyProgramId, r._count.id]))

  return programs.map((p) => ({
    id: p.id,
    name: p.name,
    programType: p.programType,
    activeEnrollments: p._count.enrollments,
    totalVisits: p._count.visits,
    redeemedRewards: redeemedMap.get(p.id) ?? 0,
    availableRewards: availableMap.get(p.id) ?? 0,
  }))
}

// ─── 7. Top Customers ───────────────────────────────────────

export async function getTopCustomers(): Promise<TopCustomerItem[]> {
  const restaurantId = await requireRestaurantId()

  const customers = await db.customer.findMany({
    where: { restaurantId, deletedAt: null },
    orderBy: { totalVisits: "desc" },
    take: 5,
    select: {
      id: true,
      fullName: true,
      totalVisits: true,
      lastVisitAt: true,
      enrollments: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          pointsBalance: true,
          remainingUses: true,
          currentCycleVisits: true,
          loyaltyProgram: {
            select: {
              programType: true,
              visitsRequired: true,
              config: true,
            },
          },
        },
      },
    },
  })

  return customers.map((c) => {
    const enrollment = c.enrollments[0]
    const pType = enrollment?.loyaltyProgram.programType ?? null

    let engagementLabel = `${c.totalVisits} visits`
    if (enrollment) {
      switch (pType) {
        case "POINTS":
          engagementLabel = `${enrollment.pointsBalance} pts`
          break
        case "PREPAID": {
          const total = (enrollment.loyaltyProgram.config as { totalUses?: number } | null)?.totalUses ?? 0
          engagementLabel = `${enrollment.remainingUses}/${total} left`
          break
        }
        case "STAMP_CARD":
          engagementLabel = `${enrollment.currentCycleVisits}/${enrollment.loyaltyProgram.visitsRequired} stamps`
          break
        case "MEMBERSHIP":
          engagementLabel = `${c.totalVisits} check-ins`
          break
        default:
          engagementLabel = `${c.totalVisits} visits`
      }
    }

    return {
      id: c.id,
      fullName: c.fullName,
      totalVisits: c.totalVisits,
      lastVisitAt: c.lastVisitAt,
      primaryProgramType: pType,
      engagementLabel,
    }
  })
}

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

export type OverviewStats = {
  totalCustomers: number
  totalCustomersChange: number
  visitsThisMonth: number
  visitsChange: number
  activeRewards: number
  rewardsRedeemedThisMonth: number
  rewardsRedeemedChange: number
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
  type: "visit" | "reward_earned" | "reward_redeemed"
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
    activeRewards,
    rewardsRedeemedThisMonth,
    rewardsRedeemedLastMonth,
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
  ])

  // Calculate percentage changes
  const totalCustomersChange =
    customersLastMonth > 0
      ? Math.round(
          ((totalCustomers - customersLastMonth) / customersLastMonth) * 100
        )
      : totalCustomers > 0
        ? 100
        : 0

  const visitsChange =
    visitsLastMonth > 0
      ? Math.round(
          ((visitsThisMonth - visitsLastMonth) / visitsLastMonth) * 100
        )
      : visitsThisMonth > 0
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

  return {
    totalCustomers,
    totalCustomersChange,
    visitsThisMonth,
    visitsChange,
    activeRewards,
    rewardsRedeemedThisMonth,
    rewardsRedeemedChange,
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

  // Live query for any days not in snapshots (including today)
  const visits = await db.visit.groupBy({
    by: ["createdAt"],
    where: {
      restaurantId,
      createdAt: { gte: startDate },
    },
    _count: { id: true },
  })

  // Build daily count from raw visits
  const liveMap = new Map<string, number>()
  for (const v of visits) {
    const day = format(v.createdAt, "yyyy-MM-dd")
    liveMap.set(day, (liveMap.get(day) ?? 0) + v._count.id)
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
  const result = await db.$queryRaw<
    { dow: number; count: bigint }[]
  >`SELECT EXTRACT(DOW FROM "createdAt") AS dow, COUNT(*) AS count
    FROM visit
    WHERE "restaurantId" = ${restaurantId}
      AND "createdAt" >= ${ninetyDaysAgo}
    GROUP BY dow
    ORDER BY dow`

  // Fill all 7 days
  const countMap = new Map<number, number>()
  for (const r of result) {
    countMap.set(Number(r.dow), Number(r.count))
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
        loyaltyProgram: { select: { name: true } },
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
        loyaltyProgram: { select: { name: true, rewardDescription: true } },
      },
    }),
  ])

  const items: ActivityItem[] = []

  for (const v of recentVisits) {
    items.push({
      id: v.id,
      type: "visit",
      customerName: v.customer.fullName,
      staffName: v.registeredBy?.name ?? null,
      programName: v.loyaltyProgram.name,
      createdAt: v.createdAt,
      detail: `Visit #${v.visitNumber}`,
    })
  }

  for (const r of recentRewards) {
    if (r.status === "REDEEMED" && r.redeemedAt) {
      items.push({
        id: `${r.id}-redeemed`,
        type: "reward_redeemed",
        customerName: r.customer.fullName,
        staffName: r.redeemedBy?.name ?? null,
        programName: r.loyaltyProgram.name,
        createdAt: r.redeemedAt,
        detail: r.loyaltyProgram.rewardDescription,
      })
    }
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

  // Sort by date descending, take 10
  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return items.slice(0, 10)
}

// ─── 6. Top Customers ───────────────────────────────────────

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
    },
  })

  return customers
}

"use server"

import { db } from "@/lib/db"
import { assertAuthenticated, getOrganizationForUser } from "@/lib/dal"
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

export type PassInstancesByType = {
  STAMP_CARD: number
  COUPON: number
  MEMBERSHIP: number
  POINTS: number
  GIFT_CARD: number
  TICKET: number
}

export type OverviewStats = {
  totalContacts: number
  totalContactsChange: number
  activityThisMonth: number
  activityChange: number
  activeRewards: number
  rewardsRedeemedThisMonth: number
  rewardsRedeemedChange: number
  activePassInstances: number
  passInstancesByType: PassInstancesByType
}

export type InteractionsDataPoint = {
  date: string
  interactions: number
}

export type BusiestDayData = {
  day: string
  interactions: number
}

export type RewardDistributionItem = {
  position: number
  count: number
}

export type ActivityItem = {
  id: string
  type: "stamp" | "reward_earned" | "reward_redeemed" | "check_in" | "coupon_redeemed" | "points_earned" | "gift_charge" | "ticket_scan"
  contactName: string
  staffName: string | null
  templateName: string | null
  createdAt: Date
  detail: string | null
}

export type TopContactItem = {
  id: string
  fullName: string
  totalInteractions: number
  lastInteractionAt: Date | null
  primaryPassType: string | null
  engagementLabel: string
}

export type TemplateSummaryItem = {
  id: string
  name: string
  passType: string
  activePassInstances: number
  totalInteractions: number
  redeemedRewards: number
  availableRewards: number
}

// ─── Helpers ────────────────────────────────────────────────

async function requireOrganizationId(): Promise<string> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) redirect("/register?step=2")
  return organization.id
}

// ─── 1. Overview Stats ──────────────────────────────────────

export async function getOverviewStats(): Promise<OverviewStats> {
  const organizationId = await requireOrganizationId()

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = startOfDay(thisMonthStart)

  const [
    totalContacts,
    contactsLastMonth,
    interactionsThisMonth,
    interactionsLastMonth,
    couponRedemptionsThisMonth,
    couponRedemptionsLastMonth,
    activeRewards,
    rewardsRedeemedThisMonth,
    rewardsRedeemedLastMonth,
    passInstancesByTypeRaw,
  ] = await Promise.all([
    db.contact.count({ where: { organizationId, deletedAt: null } }),
    db.contact.count({
      where: {
        organizationId,
        deletedAt: null,
        createdAt: { lt: thisMonthStart },
      },
    }),
    db.interaction.count({
      where: {
        organizationId,
        createdAt: { gte: thisMonthStart },
      },
    }),
    db.interaction.count({
      where: {
        organizationId,
        createdAt: { gte: lastMonthStart, lt: lastMonthEnd },
      },
    }),
    db.reward.count({
      where: {
        organizationId,
        status: "REDEEMED",
        redeemedAt: { gte: thisMonthStart },
        passTemplate: { passType: "COUPON" },
      },
    }),
    db.reward.count({
      where: {
        organizationId,
        status: "REDEEMED",
        redeemedAt: { gte: lastMonthStart, lt: lastMonthEnd },
        passTemplate: { passType: "COUPON" },
      },
    }),
    db.reward.count({
      where: {
        organizationId,
        status: "AVAILABLE",
        expiresAt: { gt: now },
      },
    }),
    db.reward.count({
      where: {
        organizationId,
        status: "REDEEMED",
        redeemedAt: { gte: thisMonthStart },
      },
    }),
    db.reward.count({
      where: {
        organizationId,
        status: "REDEEMED",
        redeemedAt: { gte: lastMonthStart, lt: lastMonthEnd },
      },
    }),
    // Active pass instances grouped by pass type
    db.passInstance.groupBy({
      by: ["passTemplateId"],
      where: {
        status: "ACTIVE",
        passTemplate: { organizationId },
      },
      _count: { id: true },
    }).then(async (groups) => {
      if (groups.length === 0) return [] as { passType: string; count: number }[]
      const templateIds = groups.map((g) => g.passTemplateId)
      const templates = await db.passTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, passType: true },
      })
      const typeMap = new Map(templates.map((t) => [t.id, t.passType]))
      return groups.map((g) => ({
        passType: typeMap.get(g.passTemplateId) ?? "STAMP_CARD",
        count: g._count.id,
      }))
    }),
  ])

  // Activity = interactions + coupon redemptions
  const activityThisMonth = interactionsThisMonth + couponRedemptionsThisMonth
  const activityLastMonth = interactionsLastMonth + couponRedemptionsLastMonth

  const totalContactsChange =
    contactsLastMonth > 0
      ? Math.round(((totalContacts - contactsLastMonth) / contactsLastMonth) * 100)
      : totalContacts > 0 ? 100 : 0

  const activityChange =
    activityLastMonth > 0
      ? Math.round(((activityThisMonth - activityLastMonth) / activityLastMonth) * 100)
      : activityThisMonth > 0 ? 100 : 0

  const rewardsRedeemedChange =
    rewardsRedeemedLastMonth > 0
      ? Math.round(((rewardsRedeemedThisMonth - rewardsRedeemedLastMonth) / rewardsRedeemedLastMonth) * 100)
      : rewardsRedeemedThisMonth > 0 ? 100 : 0

  const passInstancesByType: PassInstancesByType = {
    STAMP_CARD: 0, COUPON: 0, MEMBERSHIP: 0, POINTS: 0,
    GIFT_CARD: 0, TICKET: 0,
  }
  let activePassInstances = 0
  for (const e of passInstancesByTypeRaw) {
    const key = e.passType as keyof PassInstancesByType
    if (key in passInstancesByType) {
      passInstancesByType[key] += e.count
    }
    activePassInstances += e.count
  }

  return {
    totalContacts,
    totalContactsChange,
    activityThisMonth,
    activityChange,
    activeRewards,
    rewardsRedeemedThisMonth,
    rewardsRedeemedChange,
    activePassInstances,
    passInstancesByType,
  }
}

// ─── 2. Interactions Over Time ────────────────────────────────

export async function getInteractionsOverTime(
  range: "7d" | "30d" | "90d" | "12m"
): Promise<InteractionsDataPoint[]> {
  const organizationId = await requireOrganizationId()

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
      organizationId,
      date: { gte: startDate, lte: endOfDay(now) },
    },
    select: { date: true, totalInteractions: true },
    orderBy: { date: "asc" },
  })

  const snapshotMap = new Map<string, number>()
  for (const s of snapshots) {
    snapshotMap.set(format(s.date, "yyyy-MM-dd"), s.totalInteractions)
  }

  // Live query for interactions and coupon redemptions in parallel
  const [interactions, couponRedemptions] = await Promise.all([
    db.interaction.groupBy({
      by: ["createdAt"],
      where: {
        organizationId,
        createdAt: { gte: startDate },
      },
      _count: { id: true },
    }),
    db.reward.groupBy({
      by: ["redeemedAt"],
      where: {
        organizationId,
        status: "REDEEMED",
        redeemedAt: { gte: startDate },
        passTemplate: { passType: "COUPON" },
      },
      _count: { id: true },
    }),
  ])

  const liveMap = new Map<string, number>()
  for (const v of interactions) {
    const day = format(v.createdAt, "yyyy-MM-dd")
    liveMap.set(day, (liveMap.get(day) ?? 0) + v._count.id)
  }
  for (const r of couponRedemptions) {
    if (!r.redeemedAt) continue
    const day = format(r.redeemedAt, "yyyy-MM-dd")
    liveMap.set(day, (liveMap.get(day) ?? 0) + r._count.id)
  }

  const days = eachDayOfInterval({ start: startDate, end: now })

  return days.map((d) => {
    const key = format(d, "yyyy-MM-dd")
    return {
      date: key,
      interactions: snapshotMap.get(key) ?? liveMap.get(key) ?? 0,
    }
  })
}

// ─── 3. Busiest Days ────────────────────────────────────────

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export async function getBusiestDays(): Promise<BusiestDayData[]> {
  const organizationId = await requireOrganizationId()

  const ninetyDaysAgo = subDays(new Date(), 90)

  const [interactionResult, couponResult] = await Promise.all([
    db.$queryRaw<
      { dow: number; count: bigint }[]
    >`SELECT EXTRACT(DOW FROM "createdAt") AS dow, COUNT(*) AS count
      FROM interaction
      WHERE "organizationId" = ${organizationId}
        AND "createdAt" >= ${ninetyDaysAgo}
      GROUP BY dow
      ORDER BY dow`,
    db.$queryRaw<
      { dow: number; count: bigint }[]
    >`SELECT EXTRACT(DOW FROM r."redeemedAt") AS dow, COUNT(*) AS count
      FROM reward r
      JOIN pass_template pt ON pt.id = r."passTemplateId"
      WHERE r."organizationId" = ${organizationId}
        AND r.status = 'redeemed'
        AND r."redeemedAt" >= ${ninetyDaysAgo}
        AND pt."passType" = 'coupon'
      GROUP BY dow
      ORDER BY dow`,
  ])

  const countMap = new Map<number, number>()
  for (const r of interactionResult) {
    const dow = Number(r.dow)
    countMap.set(dow, (countMap.get(dow) ?? 0) + Number(r.count))
  }
  for (const r of couponResult) {
    const dow = Number(r.dow)
    countMap.set(dow, (countMap.get(dow) ?? 0) + Number(r.count))
  }

  const ordered = [1, 2, 3, 4, 5, 6, 0]
  return ordered.map((dow) => ({
    day: WEEKDAY_NAMES[dow],
    interactions: countMap.get(dow) ?? 0,
  }))
}

// ─── 4. Reward Cycle Distribution ───────────────────────────

export async function getRewardDistribution(
  visitsRequired: number,
  templateId?: string
): Promise<RewardDistributionItem[]> {
  const organizationId = await requireOrganizationId()

  // This is specific to STAMP_CARD — reads currentCycleVisits from passInstance.data
  // For now, we query pass instances and extract cycle visits from data JSON
  const instanceWhere: Record<string, unknown> = {
    passTemplate: { organizationId, passType: "STAMP_CARD" },
    status: "ACTIVE",
  }

  if (templateId) {
    instanceWhere.passTemplateId = templateId
  }

  const instances = await db.passInstance.findMany({
    where: instanceWhere as Prisma.PassInstanceWhereInput,
    select: { data: true },
  })

  // Build distribution map
  const countMap = new Map<number, number>()
  for (const inst of instances) {
    const data = (inst.data as Record<string, unknown>) ?? {}
    const cycleVisits = (data.currentCycleVisits as number) ?? 0
    countMap.set(cycleVisits, (countMap.get(cycleVisits) ?? 0) + 1)
  }

  const distribution: RewardDistributionItem[] = []
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
  const organizationId = await requireOrganizationId()

  const [recentInteractions, recentRewards] = await Promise.all([
    db.interaction.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        metadata: true,
        createdAt: true,
        contact: { select: { fullName: true } },
        performedBy: { select: { name: true } },
        passTemplate: { select: { name: true, passType: true } },
      },
    }),
    db.reward.findMany({
      where: { organizationId },
      orderBy: { earnedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        earnedAt: true,
        redeemedAt: true,
        contact: { select: { fullName: true } },
        redeemedBy: { select: { name: true } },
        passTemplate: { select: { name: true, passType: true } },
      },
    }),
  ])

  const items: ActivityItem[] = []

  for (const i of recentInteractions) {
    const pType = i.passTemplate.passType
    const typeMap: Record<string, ActivityItem["type"]> = {
      STAMP_CARD: "stamp",
      COUPON: "stamp",
      MEMBERSHIP: "check_in",
      POINTS: "points_earned",
      GIFT_CARD: "gift_charge",
      TICKET: "ticket_scan",
    }
    const type = typeMap[pType] ?? "stamp"

    const interactionMetadata = (i.metadata as Record<string, unknown>) ?? {}
    const detail = pType === "STAMP_CARD"
      ? `Stamp #${interactionMetadata.visitNumber ?? ""}`
      : i.passTemplate.name

    items.push({
      id: i.id,
      type,
      contactName: i.contact.fullName,
      staffName: i.performedBy?.name ?? null,
      templateName: i.passTemplate.name,
      createdAt: i.createdAt,
      detail,
    })
  }

  for (const r of recentRewards) {
    if (r.status === "REDEEMED" && r.redeemedAt) {
      const isCoupon = r.passTemplate.passType === "COUPON"
      items.push({
        id: `${r.id}-redeemed`,
        type: isCoupon ? "coupon_redeemed" : "reward_redeemed",
        contactName: r.contact.fullName,
        staffName: r.redeemedBy?.name ?? null,
        templateName: r.passTemplate.name,
        createdAt: r.redeemedAt,
        detail: r.passTemplate.name,
      })
    }
    if (r.passTemplate.passType !== "COUPON") {
      items.push({
        id: r.id,
        type: "reward_earned",
        contactName: r.contact.fullName,
        staffName: null,
        templateName: r.passTemplate.name,
        createdAt: r.earnedAt,
        detail: r.passTemplate.name,
      })
    }
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return items.slice(0, 10)
}

// ─── 6. Templates Summary ────────────────────────────────────

export async function getTemplatesSummary(): Promise<TemplateSummaryItem[]> {
  const organizationId = await requireOrganizationId()

  const templates = await db.passTemplate.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      passType: true,
      _count: {
        select: {
          passInstances: { where: { status: "ACTIVE" } },
          interactions: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  if (templates.length === 0) return []

  const templateIds = templates.map((t) => t.id)
  const [redeemedCounts, availableCounts] = await Promise.all([
    db.reward.groupBy({
      by: ["passTemplateId"],
      where: {
        passTemplateId: { in: templateIds },
        status: "REDEEMED",
      },
      _count: { id: true },
    }),
    db.reward.groupBy({
      by: ["passTemplateId"],
      where: {
        passTemplateId: { in: templateIds },
        status: "AVAILABLE",
      },
      _count: { id: true },
    }),
  ])

  const redeemedMap = new Map(redeemedCounts.map((r) => [r.passTemplateId, r._count.id]))
  const availableMap = new Map(availableCounts.map((r) => [r.passTemplateId, r._count.id]))

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    passType: t.passType as TemplateSummaryItem["passType"],
    activePassInstances: t._count.passInstances,
    totalInteractions: t._count.interactions,
    redeemedRewards: redeemedMap.get(t.id) ?? 0,
    availableRewards: availableMap.get(t.id) ?? 0,
  }))
}

// ─── 7. Top Contacts ───────────────────────────────────────

export async function getTopContacts(): Promise<TopContactItem[]> {
  const organizationId = await requireOrganizationId()

  const contacts = await db.contact.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { totalInteractions: "desc" },
    take: 5,
    select: {
      id: true,
      fullName: true,
      totalInteractions: true,
      lastInteractionAt: true,
      passInstances: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          data: true,
          passTemplate: {
            select: {
              passType: true,
              config: true,
            },
          },
        },
      },
    },
  })

  return contacts.map((c) => {
    const instance = c.passInstances[0]
    const pType = instance?.passTemplate.passType ?? null
    const instanceData = (instance?.data as Record<string, unknown>) ?? {}

    let engagementLabel = `${c.totalInteractions} interactions`
    if (instance) {
      switch (pType) {
        case "POINTS":
          engagementLabel = `${instanceData.pointsBalance ?? 0} pts`
          break
        case "STAMP_CARD": {
          const visitsRequired = (instance.passTemplate.config as { stampsRequired?: number } | null)?.stampsRequired ?? 10
          engagementLabel = `${instanceData.currentCycleVisits ?? 0}/${visitsRequired} stamps`
          break
        }
        case "MEMBERSHIP":
          engagementLabel = `${c.totalInteractions} check-ins`
          break
        case "GIFT_CARD": {
          const balanceCents = (instanceData.balanceCents as number) ?? 0
          engagementLabel = `${(balanceCents / 100).toFixed(2)} balance`
          break
        }
        case "TICKET":
          engagementLabel = `${(instanceData.scansUsed as number) ?? 0} scans`
          break
        default:
          engagementLabel = `${c.totalInteractions} interactions`
      }
    }

    return {
      id: c.id,
      fullName: c.fullName,
      totalInteractions: c.totalInteractions,
      lastInteractionAt: c.lastInteractionAt,
      primaryPassType: pType,
      engagementLabel,
    }
  })
}

// Need Prisma import for type casting in getRewardDistribution
import { Prisma } from "@prisma/client"

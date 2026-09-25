import type { Prisma } from "@prisma/client"
import { getPlanLimits, isActiveSubscription, type AnnouncementPeriod, type PlanId } from "@/lib/plans"

// ─── Announcement quota ─────────────────────────────────────
//
// Two independent limits apply to every broadcast:
//  1. Plan quota, per ORGANIZATION (shared across all programs):
//     Free 2 lifetime · Pro 1/wk · Business 2/wk · Scale 5/wk · Enterprise ∞.
//     "Week" is a rolling 7-day window, not a calendar week.
//  2. Delivery cap, per PROGRAM: Google caps TEXT_AND_NOTIFY pushes at ~3 per
//     object per 24h, so more sends than that on one program would silently
//     not notify Google Wallet holders. Only reachable on Scale/Enterprise.

export const ANNOUNCEMENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
export const ANNOUNCEMENT_PROGRAM_MAX_PER_24H = 3
const DAY_MS = 24 * 60 * 60 * 1000

type AnnouncementDb = Pick<Prisma.TransactionClient, "programAnnouncement">

export type AnnouncementQuota = {
  plan: PlanId
  period: AnnouncementPeriod
  /** null = unlimited (Infinity doesn't survive JSON / client props cleanly) */
  limit: number | null
  used: number
  /** null = unlimited */
  remaining: number | null
  /** ISO time the next send frees up — set only when the quota is exhausted on a weekly plan */
  nextAvailableAt: string | null
  /** Subscription is past due / canceled: no sends until billing is fixed */
  inactive: boolean
}

/**
 * Pure quota computation. `weeklySends` must be the org's send timestamps
 * inside the rolling window, oldest first (ignored for lifetime plans).
 */
export function computeAnnouncementQuota(input: {
  plan: PlanId
  subscriptionStatus: string
  lifetimeSends: number
  weeklySends: Date[]
}): AnnouncementQuota {
  const { announcementLimit, announcementPeriod } = getPlanLimits(input.plan)
  const unlimited = announcementLimit === Infinity
  const used =
    announcementPeriod === "lifetime" ? input.lifetimeSends : input.weeklySends.length
  const remaining = unlimited ? null : Math.max(0, announcementLimit - used)

  let nextAvailableAt: string | null = null
  if (remaining === 0 && announcementPeriod === "week") {
    // The send whose expiry brings `used` back under the limit
    const freeing = input.weeklySends[used - announcementLimit]
    if (freeing) {
      nextAvailableAt = new Date(freeing.getTime() + ANNOUNCEMENT_WINDOW_MS).toISOString()
    }
  }

  return {
    plan: input.plan,
    period: announcementPeriod,
    limit: unlimited ? null : announcementLimit,
    used,
    remaining,
    nextAvailableAt,
    inactive: !isActiveSubscription(input.subscriptionStatus),
  }
}

export async function getAnnouncementQuota(
  client: AnnouncementDb,
  organization: { id: string; plan: string; subscriptionStatus: string },
  now: Date = new Date()
): Promise<AnnouncementQuota> {
  const plan = organization.plan as PlanId
  const { announcementPeriod } = getPlanLimits(plan)

  if (announcementPeriod === "lifetime") {
    const lifetimeSends = await client.programAnnouncement.count({
      where: { organizationId: organization.id },
    })
    return computeAnnouncementQuota({
      plan,
      subscriptionStatus: organization.subscriptionStatus,
      lifetimeSends,
      weeklySends: [],
    })
  }

  const rows = await client.programAnnouncement.findMany({
    where: {
      organizationId: organization.id,
      createdAt: { gt: new Date(now.getTime() - ANNOUNCEMENT_WINDOW_MS) },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  return computeAnnouncementQuota({
    plan,
    subscriptionStatus: organization.subscriptionStatus,
    lifetimeSends: 0,
    weeklySends: rows.map((r) => r.createdAt),
  })
}

/** Sends on one program in the last 24h (Google delivery cap). */
export async function countProgramSendsLast24h(
  client: AnnouncementDb,
  passTemplateId: string,
  now: Date = new Date()
): Promise<number> {
  return client.programAnnouncement.count({
    where: { passTemplateId, createdAt: { gt: new Date(now.getTime() - DAY_MS) } },
  })
}

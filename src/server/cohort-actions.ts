"use server"

import { db } from "@/lib/db"
import { assertAdminRole } from "@/lib/dal"

// ─── Cohort retention (partner channel vs organic) ──────────
//
// Rows = signup-month cohorts (org.createdAt, UTC), columns = months since
// signup. An org is "retained" in month N if it logged at least one
// Interaction that calendar month — actual usage, not merely an
// un-cancelled subscription. Segmented by attribution: partner
// (referredById set) vs organic. This is the number that decides whether
// the agency channel gets more fuel.

const MAX_COHORTS = 12
const MAX_MONTHS = 12

export type CohortRow = {
  cohortMonth: string // "2026-08"
  orgCount: number
  paidCount: number // plan != FREE right now
  subscribedCount: number // subscriptionStatus ACTIVE/TRIALING right now
  // retention[n] = % of cohort orgs with ≥1 interaction in signup month + n.
  // null = that month hasn't started yet for this cohort.
  retention: (number | null)[]
}

export type CohortSegments = {
  all: CohortRow[]
  partner: CohortRow[]
  organic: CohortRow[]
  maxMonths: number
}

function monthKey(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`
}

function monthDiff(fromKey: string, toKey: string): number {
  const [fy, fm] = fromKey.split("-").map(Number)
  const [ty, tm] = toKey.split("-").map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

export async function getCohortRetention(): Promise<CohortSegments | { error: string }> {
  await assertAdminRole("ADMIN_SUPPORT")

  const now = new Date()
  const currentKey = monthKey(now.getUTCFullYear(), now.getUTCMonth())

  // Cohort window: the last MAX_COHORTS months
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MAX_COHORTS - 1), 1))

  const orgs = await db.organization.findMany({
    where: { createdAt: { gte: windowStart } },
    select: {
      id: true,
      createdAt: true,
      referredById: true,
      plan: true,
      subscriptionStatus: true,
    },
  })

  // One pass over interactions: distinct (org, calendar month) pairs
  const activity = await db.$queryRaw<{ organizationId: string; month: string }[]>`
    SELECT "organizationId", to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month
    FROM "interaction"
    WHERE "createdAt" >= ${windowStart}
    GROUP BY 1, 2
  `
  const activeSet = new Set(activity.map((a) => `${a.organizationId}|${a.month}`))

  type Bucket = {
    orgIds: string[]
    paid: number
    subscribed: number
  }

  function buildSegment(filter: (o: (typeof orgs)[number]) => boolean): CohortRow[] {
    const buckets = new Map<string, Bucket>()
    for (const org of orgs) {
      if (!filter(org)) continue
      const key = monthKey(org.createdAt.getUTCFullYear(), org.createdAt.getUTCMonth())
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = { orgIds: [], paid: 0, subscribed: 0 }
        buckets.set(key, bucket)
      }
      bucket.orgIds.push(org.id)
      if (org.plan !== "FREE") bucket.paid++
      if (org.subscriptionStatus === "ACTIVE" || org.subscriptionStatus === "TRIALING") {
        bucket.subscribed++
      }
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohort, bucket]) => {
        const elapsed = monthDiff(cohort, currentKey)
        const retention: (number | null)[] = []
        for (let n = 0; n < MAX_MONTHS; n++) {
          if (n > elapsed) {
            retention.push(null)
            continue
          }
          const [cy, cm] = cohort.split("-").map(Number)
          const target = monthKey(cy + Math.floor((cm - 1 + n) / 12), (cm - 1 + n) % 12)
          const active = bucket.orgIds.filter((id) => activeSet.has(`${id}|${target}`)).length
          retention.push(Math.round((active / bucket.orgIds.length) * 100))
        }
        return {
          cohortMonth: cohort,
          orgCount: bucket.orgIds.length,
          paidCount: bucket.paid,
          subscribedCount: bucket.subscribed,
          retention,
        }
      })
  }

  return {
    all: buildSegment(() => true),
    partner: buildSegment((o) => o.referredById !== null),
    organic: buildSegment((o) => o.referredById === null),
    maxMonths: MAX_MONTHS,
  }
}

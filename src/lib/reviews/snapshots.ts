import "server-only"

import { db } from "@/lib/db"
import { orgAllowsReviewPrompts } from "./access"
import { fetchPlaceRating } from "./places"

/** Today's UTC date, as stored in GoogleRatingSnapshot.date (@db.Date). */
function utcToday(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Writes (or refreshes) today's snapshot for one org. False if Google didn't answer. */
export async function snapshotPlaceRating(organizationId: string, placeId: string): Promise<boolean> {
  const rating = await fetchPlaceRating(placeId)
  if (!rating) return false
  const date = utcToday()
  await db.googleRatingSnapshot.upsert({
    where: { organizationId_date: { organizationId, date } },
    create: { organizationId, date, rating: rating.rating, ratingCount: rating.ratingCount },
    update: { rating: rating.rating, ratingCount: rating.ratingCount },
  })
  return true
}

const CONCURRENCY = 5

/**
 * Daily run (Vercel cron → /api/cron/google-ratings): one Places call per
 * org that picked its business and may use review prompts. Orgs
 * keep being tracked while the prompt itself is switched off, so the chart
 * shows what happens before and after.
 */
export async function snapshotAllPlaceRatings(): Promise<{ orgs: number; written: number; failed: number }> {
  const rows = await db.googleReviewSettings.findMany({
    where: { placeId: { not: null } },
    select: {
      organizationId: true,
      placeId: true,
      organization: { select: { plan: true, subscriptionStatus: true } },
    },
  })
  const targets: { organizationId: string; placeId: string }[] = []
  for (const r of rows) {
    if (r.placeId && (await orgAllowsReviewPrompts({ id: r.organizationId, ...r.organization }))) {
      targets.push({ organizationId: r.organizationId, placeId: r.placeId })
    }
  }

  let written = 0
  let failed = 0
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((t) => snapshotPlaceRating(t.organizationId, t.placeId)),
    )
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) written++
      else failed++
    }
  }
  return { orgs: targets.length, written, failed }
}

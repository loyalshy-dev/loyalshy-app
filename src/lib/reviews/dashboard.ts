import "server-only"

import { db } from "@/lib/db"
import { orgAllowsReviewPrompts } from "./access"
import { isPlacesConfigured } from "./places"

const DAY_MS = 24 * 60 * 60 * 1000

export type ReviewsDashboardData = {
  planAllowed: boolean
  placesConfigured: boolean
  settings: {
    enabled: boolean
    placeId: string | null
    placeName: string | null
    /** The pasted link when no placeId was picked. */
    customUrl: string | null
    triggerStamp: number
    message: string
    linkLabel: string
  } | null
  funnel: {
    asked30d: number
    opened30d: number
    askedTotal: number
    openedTotal: number
  }
  /** Oldest first; dates as YYYY-MM-DD. */
  ratings: { date: string; rating: number | null; ratingCount: number }[]
}

export async function getReviewsDashboard(organization: {
  id: string
  plan: string
  subscriptionStatus: string
}): Promise<ReviewsDashboardData> {
  const since30 = new Date(Date.now() - 30 * DAY_MS)
  const since365 = new Date(Date.now() - 365 * DAY_MS)
  const orgId = organization.id

  const [planAllowed, settings, asked30d, opened30d, askedTotal, openedTotal, snapshots] = await Promise.all([
    orgAllowsReviewPrompts(organization),
    db.googleReviewSettings.findUnique({ where: { organizationId: orgId } }),
    db.contact.count({ where: { organizationId: orgId, reviewPromptedAt: { gte: since30 } } }),
    db.contact.count({
      where: { organizationId: orgId, reviewPromptedAt: { gte: since30 }, reviewLinkOpenedAt: { not: null } },
    }),
    db.contact.count({ where: { organizationId: orgId, reviewPromptedAt: { not: null } } }),
    db.contact.count({ where: { organizationId: orgId, reviewLinkOpenedAt: { not: null } } }),
    db.googleRatingSnapshot.findMany({
      where: { organizationId: orgId, date: { gte: since365 } },
      orderBy: { date: "asc" },
      select: { date: true, rating: true, ratingCount: true },
    }),
  ])

  return {
    planAllowed,
    placesConfigured: isPlacesConfigured(),
    settings: settings
      ? {
          enabled: settings.enabled,
          placeId: settings.placeId,
          placeName: settings.placeName,
          customUrl: settings.placeId ? null : settings.reviewUrl,
          triggerStamp: settings.triggerStamp,
          message: settings.message,
          linkLabel: settings.linkLabel,
        }
      : null,
    funnel: { asked30d, opened30d, askedTotal, openedTotal },
    ratings: snapshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      rating: s.rating,
      ratingCount: s.ratingCount,
    })),
  }
}

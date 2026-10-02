import "server-only"

import { db } from "@/lib/db"
import { planAllowsReviewPrompts, type PlanId } from "@/lib/plans"
import { isReviewPromptFresh } from "./timing"
import { buildReviewLinkUrl } from "./token"

export type ActiveReviewSettings = {
  organizationId: string
  organizationName: string
  timezone: string
  reviewUrl: string
  triggerStamp: number
  message: string
  linkLabel: string
}

/**
 * The org's review prompt config when it is live: enabled, has a target,
 * and the plan allows it. Null otherwise — callers treat null as "feature off".
 */
export async function getActiveReviewSettings(organizationId: string): Promise<ActiveReviewSettings | null> {
  const row = await db.googleReviewSettings.findUnique({
    where: { organizationId },
    select: {
      enabled: true,
      reviewUrl: true,
      triggerStamp: true,
      message: true,
      linkLabel: true,
      organization: { select: { name: true, timezone: true, plan: true, subscriptionStatus: true } },
    },
  })
  if (!row || !row.enabled || !row.reviewUrl) return null
  if (!planAllowsReviewPrompts(row.organization.plan as PlanId, row.organization.subscriptionStatus)) return null
  return {
    organizationId,
    organizationName: row.organization.name,
    timezone: row.organization.timezone,
    reviewUrl: row.reviewUrl,
    triggerStamp: row.triggerStamp,
    message: row.message,
    linkLabel: row.linkLabel,
  }
}

/** What a wallet pass shows for the review prompt (both providers). */
export type ReviewPassField = {
  /** Tracked link: loyalshy.com/r/{token} → Google's review form. */
  url: string
  linkLabel: string
  message: string
  /** The contact has been asked (the pass shows the message, not the label). */
  prompted: boolean
  /** Asked within the last 24h: the pass carries the notifying version. */
  fresh: boolean
}

/**
 * Review field for one stamp-card pass, or null when the feature is off.
 * Coupons never carry it — the prompt is triggered by stamps.
 */
export async function loadReviewPassField(args: {
  organizationId: string
  passInstanceId: string
  passType: string | null | undefined
  reviewPromptedAt: Date | null
}): Promise<ReviewPassField | null> {
  if (args.passType && args.passType !== "STAMP_CARD") return null
  // Best-effort: this runs inside every Apple pass fetch and Google PATCH, so
  // a failure here drops the review field instead of failing the pass update.
  let settings: ActiveReviewSettings | null
  try {
    settings = await getActiveReviewSettings(args.organizationId)
  } catch (err) {
    console.error("[review-prompt] settings lookup failed:", err instanceof Error ? err.message : err)
    return null
  }
  if (!settings) return null
  return {
    url: buildReviewLinkUrl(args.passInstanceId),
    linkLabel: settings.linkLabel,
    message: settings.message,
    prompted: args.reviewPromptedAt !== null,
    fresh: isReviewPromptFresh(args.reviewPromptedAt),
  }
}

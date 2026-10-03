import "server-only"

import { db } from "@/lib/db"
import { orgAllowsFeature } from "@/lib/plan-access"
import { isReviewEligiblePass } from "@/lib/reviews/eligibility"
import { isWinbackFresh } from "./timing"

/** What a wallet pass shows for win-back (both providers). */
export type WinbackPassField = {
  /** The message of the send this pass is showing, or null = placeholder. */
  message: string | null
  /** Sent through THIS pass within the last 24h: carry the notifying version. */
  fresh: boolean
  /** Google message id (dedupes the TEXT_AND_NOTIFY banner). */
  sendId: string | null
}

/**
 * Win-back field for one pass, or null when the org doesn't use win-back (or
 * the pass can't carry it: single-use coupons).
 *
 * The pass shows the latest message sent through it SINCE the contact's last
 * visit; their next visit puts it back to the placeholder, silently. That's
 * what lets the next absence notify again even with the same text — iOS only
 * banners a value that changed. Best-effort like the review field: a lookup
 * failure drops the field instead of failing the pass update.
 */
export async function loadWinbackPassField(args: {
  organizationId: string
  passInstanceId: string
  passType: string | null | undefined
  templateConfig: unknown
  lastInteractionAt: Date | null
}): Promise<WinbackPassField | null> {
  if (!isReviewEligiblePass(args.passType, args.templateConfig)) return null
  try {
    const settings = await db.winbackSettings.findUnique({
      where: { organizationId: args.organizationId },
      select: {
        enabled: true,
        organization: { select: { plan: true, subscriptionStatus: true } },
      },
    })
    if (!settings?.enabled) return null
    if (!(await orgAllowsFeature({ id: args.organizationId, ...settings.organization }, "winback"))) return null

    const send = await db.winbackSend.findFirst({
      where: {
        passInstanceId: args.passInstanceId,
        control: false,
        reachable: true,
        ...(args.lastInteractionAt ? { sentAt: { gt: args.lastInteractionAt } } : {}),
      },
      orderBy: { sentAt: "desc" },
      select: { id: true, message: true, sentAt: true },
    })
    if (!send) return { message: null, fresh: false, sendId: null }
    return { message: send.message, fresh: isWinbackFresh(send.sentAt), sendId: send.id }
  } catch (err) {
    console.error("[winback] pass field lookup failed:", err instanceof Error ? err.message : err)
    return null
  }
}

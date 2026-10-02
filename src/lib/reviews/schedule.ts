import "server-only"

import { after } from "next/server"
import { db } from "@/lib/db"
import { getActiveReviewSettings } from "./settings"
import { computeReviewDueAt } from "./timing"

export type SendReviewPromptPayload = {
  contactId: string
  passInstanceId: string
}

/**
 * Called after every successful stamp (staff app + dashboard). Schedules the
 * contact's one-time review prompt once their visit count reaches the org's
 * trigger, delivered ~90 min later inside local daytime hours. The delayed
 * Trigger.dev run calls back into /api/internal/review-prompt, which
 * re-checks everything and sends (see send.ts) — so an undone stamp, a
 * disabled feature or a downgrade in the meantime just means nothing goes out.
 *
 * `>=` (not `==`) on the trigger means customers already past it when the
 * merchant turns the feature on are asked on their next visit.
 */
export function maybeScheduleReviewPrompt(args: {
  organizationId: string
  contactId: string
  passInstanceId: string
  walletProvider: string
  passType: string
  newTotalVisits: number
}) {
  if (args.walletProvider === "NONE" || args.passType !== "STAMP_CARD") return

  after(async () => {
    try {
      const settings = await getActiveReviewSettings(args.organizationId)
      if (!settings || args.newTotalVisits < settings.triggerStamp) return

      const contact = await db.contact.findUnique({
        where: { id: args.contactId },
        select: { reviewPromptedAt: true, deletedAt: true },
      })
      if (!contact || contact.reviewPromptedAt || contact.deletedAt) return

      if (!process.env.TRIGGER_SECRET_KEY) {
        console.info("[review-prompt] Trigger.dev not configured; prompt not scheduled")
        return
      }

      // Test hook: REVIEW_PROMPT_DELAY_SECONDS=60 sends a minute after the
      // stamp, ignoring quiet hours (on-device checks).
      const overrideSeconds = Number(process.env.REVIEW_PROMPT_DELAY_SECONDS)
      const dueAt = Number.isFinite(overrideSeconds) && overrideSeconds > 0
        ? new Date(Date.now() + overrideSeconds * 1000)
        : computeReviewDueAt(new Date(), settings.timezone)

      const { tasks } = await import("@trigger.dev/sdk")
      const payload: SendReviewPromptPayload = {
        contactId: args.contactId,
        passInstanceId: args.passInstanceId,
      }
      // No idempotency key on purpose: a key would also swallow the
      // reschedule after a run that was skipped (stamp undone, then re-stamped).
      // Two pending runs are harmless — send.ts claims the contact atomically.
      await tasks.trigger("send-review-prompt", payload, { delay: dueAt })
    } catch (err) {
      console.error(
        "[review-prompt] scheduling failed:",
        err instanceof Error ? err.message : err,
      )
    }
  })
}

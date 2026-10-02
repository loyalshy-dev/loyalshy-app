import { task } from "@trigger.dev/sdk"
import { notificationsQueue } from "./queues"

type SendReviewPromptPayload = {
  contactId: string
  passInstanceId: string
}

/**
 * Delayed review prompt (scheduled by src/lib/reviews/schedule.ts with
 * `delay: dueAt`). The run only calls back into the webapp, which re-checks
 * and delivers with the real wallet helpers — they are `server-only`
 * modules that don't load in the Trigger.dev runtime.
 *
 * Needs CRON_SECRET (same value as on Vercel) and BETTER_AUTH_URL in the
 * Trigger.dev environment.
 */
export const sendReviewPromptTask = task({
  id: "send-review-prompt",
  queue: notificationsQueue,
  retry: {
    maxAttempts: 4,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 120_000,
  },
  run: async (payload: SendReviewPromptPayload) => {
    const secret = process.env.CRON_SECRET
    if (!secret) throw new Error("CRON_SECRET is not set in the Trigger.dev environment")
    // www→apex: Vercel 308s www to the apex, and fetch drops Authorization
    // on that cross-host hop.
    const base = (process.env.BETTER_AUTH_URL ?? "https://loyalshy.com").replace("://www.", "://")

    const res = await fetch(`${base}/api/internal/review-prompt`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    })
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(`review-prompt callback failed (${res.status})`)
    }
    return body
  },
})

import { schedules } from "@trigger.dev/sdk"
import { notificationsQueue } from "./queues"

/**
 * Hourly win-back run. Only calls back into the webapp, which picks the orgs
 * at their 10:00 local hour and delivers with the real wallet helpers
 * (`server-only` modules don't load in the Trigger.dev runtime).
 *
 * Needs CRON_SECRET (same value as on Vercel) and BETTER_AUTH_URL in the
 * Trigger.dev environment.
 */
export const winbackHourlyTask = schedules.task({
  id: "winback-hourly",
  cron: "2 * * * *",
  queue: notificationsQueue,
  run: async () => {
    const secret = process.env.CRON_SECRET
    if (!secret) throw new Error("CRON_SECRET is not set in the Trigger.dev environment")
    // www→apex: Vercel 308s www to the apex, and fetch drops Authorization
    // on that cross-host hop.
    const base = (process.env.BETTER_AUTH_URL ?? "https://loyalshy.com").replace("://www.", "://")

    const res = await fetch(`${base}/api/internal/winback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(240_000),
    })
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) throw new Error(`winback callback failed (${res.status})`)
    return body
  },
})

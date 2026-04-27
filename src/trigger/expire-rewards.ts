import { schedules, tasks } from "@trigger.dev/sdk"
import { analyticsQueue } from "./queues"
import { createDb } from "./db"
import type { updateWalletPassTask } from "./update-wallet-pass"

// ─── Expire Rewards — Daily CRON at 2:00 AM UTC ────────────

export const expireRewardsTask = schedules.task({
  id: "expire-rewards",
  cron: "0 2 * * *",
  queue: analyticsQueue,
  run: async () => {
    const db = createDb()

    try {
      // Atomic UPDATE … RETURNING: only flip rows that are still AVAILABLE at
      // the moment the row is locked. A concurrent redeem won't be clobbered
      // because its UPDATE sees the same row and only one of the two writers
      // wins. We then trigger wallet updates for exactly the rows we expired.
      const expired = await db.$queryRaw<Array<{ id: string; passInstanceId: string | null }>>`
        UPDATE reward
        SET status = 'expired'::reward_status
        WHERE status = 'available'::reward_status AND "expiresAt" < now()
        RETURNING id, "passInstanceId"
      `

      if (expired.length === 0) {
        return { expired: 0, passInstancesAffected: 0 }
      }

      const passInstanceIdSet = new Set<string>()
      for (const r of expired) {
        if (r.passInstanceId) passInstanceIdSet.add(r.passInstanceId)
      }
      const passInstanceIds = [...passInstanceIdSet]

      if (passInstanceIds.length > 0) {
        await tasks.batchTrigger<typeof updateWalletPassTask>(
          "update-wallet-pass",
          passInstanceIds.map((passInstanceId) => ({
            payload: { passInstanceId, updateType: "REWARD_EXPIRED" as const },
          }))
        )
      }

      return {
        expired: expired.length,
        passInstancesAffected: passInstanceIds.length,
      }
    } finally {
      await db.$disconnect()
    }
  },
})

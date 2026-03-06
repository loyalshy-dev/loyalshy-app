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
      const now = new Date()

      // Find all expired rewards still marked as AVAILABLE
      const expiredRewards = await db.reward.findMany({
        where: {
          status: "AVAILABLE",
          expiresAt: { lt: now },
        },
        select: {
          id: true,
          passInstanceId: true,
        },
      })

      if (expiredRewards.length === 0) {
        return { expired: 0, passInstancesAffected: 0 }
      }

      // Batch update to EXPIRED
      const result = await db.reward.updateMany({
        where: {
          id: { in: expiredRewards.map((r: { id: string }) => r.id) },
        },
        data: { status: "EXPIRED" },
      })

      // Collect unique pass instance IDs for wallet pass updates
      const passInstanceIdSet = new Set<string>()
      for (const r of expiredRewards) {
        if (r.passInstanceId) {
          passInstanceIdSet.add(r.passInstanceId)
        }
      }
      const passInstanceIds = [...passInstanceIdSet]

      // Batch trigger wallet pass updates for affected pass instances
      if (passInstanceIds.length > 0) {
        await tasks.batchTrigger<typeof updateWalletPassTask>(
          "update-wallet-pass",
          passInstanceIds.map((passInstanceId) => ({
            payload: { passInstanceId, updateType: "REWARD_EXPIRED" as const },
          }))
        )
      }

      return {
        expired: result.count,
        passInstancesAffected: passInstanceIds.length,
      }
    } finally {
      await db.$disconnect()
    }
  },
})

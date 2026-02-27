import { task, tasks } from "@trigger.dev/sdk"
import { walletUpdatesQueue } from "./queues"
import { createDb } from "./db"

// ─── Types ──────────────────────────────────────────────────

type UpdateAllPassesPayload = {
  restaurantId: string
  programId?: string
  reason: "DESIGN_CHANGE" | "PROGRAM_CHANGE"
}

// ─── Task ───────────────────────────────────────────────────

export const updateAllPassesTask = task({
  id: "update-all-passes",
  queue: walletUpdatesQueue,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 60_000,
  },
  run: async (payload: UpdateAllPassesPayload) => {
    const db = createDb()

    try {
      // Fetch all enrollments with wallet passes for this restaurant
      // Optionally filtered to a specific program
      const enrollments = await db.enrollment.findMany({
        where: {
          walletPassType: { not: "NONE" },
          status: "ACTIVE",
          loyaltyProgram: {
            restaurantId: payload.restaurantId,
            ...(payload.programId ? { id: payload.programId } : {}),
          },
          customer: {
            deletedAt: null,
          },
        },
        select: { id: true },
      })

      if (enrollments.length === 0) {
        return { triggered: 0, reason: "no_enrollments_with_passes" }
      }

      // Batch trigger update-wallet-pass in groups of 50
      const BATCH_SIZE = 50
      let totalTriggered = 0

      for (let i = 0; i < enrollments.length; i += BATCH_SIZE) {
        const batch = enrollments.slice(i, i + BATCH_SIZE)
        await tasks.batchTrigger(
          "update-wallet-pass",
          batch.map((e) => ({
            payload: {
              enrollmentId: e.id,
              updateType: payload.reason,
            },
          }))
        )
        totalTriggered += batch.length
      }

      return { triggered: totalTriggered, reason: payload.reason }
    } finally {
      await db.$disconnect()
    }
  },
})

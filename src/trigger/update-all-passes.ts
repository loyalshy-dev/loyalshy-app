import { task, tasks } from "@trigger.dev/sdk"
import { walletUpdatesQueue } from "./queues"
import { createDb } from "./db"

// ─── Types ──────────────────────────────────────────────────

type UpdateAllPassesPayload = {
  organizationId: string
  templateId?: string
  reason: "DESIGN_CHANGE" | "TEMPLATE_CHANGE"
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
      // Fetch all pass instances with wallet passes for this organization
      // Optionally filtered to a specific template
      const passInstances = await db.passInstance.findMany({
        where: {
          walletProvider: { not: "NONE" },
          status: "ACTIVE",
          passTemplate: {
            organizationId: payload.organizationId,
            ...(payload.templateId ? { id: payload.templateId } : {}),
          },
          contact: {
            deletedAt: null,
          },
        },
        select: { id: true },
      })

      if (passInstances.length === 0) {
        return { triggered: 0, reason: "no_pass_instances_with_passes" }
      }

      // Batch trigger update-wallet-pass in groups of 50
      const BATCH_SIZE = 50
      let totalTriggered = 0

      for (let i = 0; i < passInstances.length; i += BATCH_SIZE) {
        const batch = passInstances.slice(i, i + BATCH_SIZE)
        await tasks.batchTrigger(
          "update-wallet-pass",
          batch.map((e) => ({
            payload: {
              passInstanceId: e.id,
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

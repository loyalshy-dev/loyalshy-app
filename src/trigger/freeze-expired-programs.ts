import { schedules, tasks } from "@trigger.dev/sdk"
import { analyticsQueue } from "./queues"
import { createDb } from "./db"
import type { updateWalletPassTask } from "./update-wallet-pass"

// ─── Archive Expired Templates — Daily CRON at 1:30 AM UTC ───

export const archiveExpiredTemplatesTask = schedules.task({
  id: "archive-expired-templates",
  cron: "30 1 * * *",
  queue: analyticsQueue,
  run: async () => {
    const db = createDb()

    try {
      const now = new Date()

      // Find templates that are ACTIVE but have passed their end date
      const expiredTemplates = await db.passTemplate.findMany({
        where: {
          status: "ACTIVE",
          endsAt: { lt: now, not: null },
        },
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      })

      if (expiredTemplates.length === 0) {
        return { templatesArchived: 0, passInstancesFrozen: 0, walletUpdatesTriggered: 0 }
      }

      let totalPassInstancesFrozen = 0
      let totalWalletUpdatesTriggered = 0

      for (const template of expiredTemplates) {
        // Archive the template
        await db.passTemplate.update({
          where: { id: template.id },
          data: { status: "ARCHIVED" },
        })

        // Suspend all ACTIVE pass instances for this template
        const suspendedResult = await db.passInstance.updateMany({
          where: {
            passTemplateId: template.id,
            status: "ACTIVE",
          },
          data: {
            status: "SUSPENDED",
            suspendedAt: now,
          },
        })

        totalPassInstancesFrozen += suspendedResult.count

        // Find suspended pass instances that have wallet passes so we can update them
        const passInstancesWithPasses = await db.passInstance.findMany({
          where: {
            passTemplateId: template.id,
            status: "SUSPENDED",
            walletProvider: { not: "NONE" },
          },
          select: { id: true },
        })

        // Batch trigger wallet pass updates for suspended pass instances
        if (passInstancesWithPasses.length > 0) {
          const BATCH_SIZE = 50
          for (let i = 0; i < passInstancesWithPasses.length; i += BATCH_SIZE) {
            const batch = passInstancesWithPasses.slice(i, i + BATCH_SIZE)
            await tasks.batchTrigger<typeof updateWalletPassTask>(
              "update-wallet-pass",
              batch.map((e) => ({
                payload: {
                  passInstanceId: e.id,
                  updateType: "PASS_INSTANCE_SUSPENDED" as const,
                },
              }))
            )
          }
          totalWalletUpdatesTriggered += passInstancesWithPasses.length
        }
      }

      return {
        templatesArchived: expiredTemplates.length,
        passInstancesFrozen: totalPassInstancesFrozen,
        walletUpdatesTriggered: totalWalletUpdatesTriggered,
      }
    } finally {
      await db.$disconnect()
    }
  },
})

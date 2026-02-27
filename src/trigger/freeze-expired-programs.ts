import { schedules, tasks } from "@trigger.dev/sdk"
import { analyticsQueue } from "./queues"
import { createDb } from "./db"
import type { updateWalletPassTask } from "./update-wallet-pass"

// ─── Freeze Expired Programs — Daily CRON at 1:30 AM UTC ───

export const freezeExpiredProgramsTask = schedules.task({
  id: "freeze-expired-programs",
  cron: "30 1 * * *",
  queue: analyticsQueue,
  run: async () => {
    const db = createDb()

    try {
      const now = new Date()

      // Find programs that are ACTIVE but have passed their end date
      const expiredPrograms = await db.loyaltyProgram.findMany({
        where: {
          status: "ACTIVE",
          endsAt: { lt: now, not: null },
        },
        select: {
          id: true,
          name: true,
          restaurantId: true,
        },
      })

      if (expiredPrograms.length === 0) {
        return { programsArchived: 0, enrollmentsFrozen: 0, walletUpdatesTriggered: 0 }
      }

      let totalEnrollmentsFrozen = 0
      let totalWalletUpdatesTriggered = 0

      for (const program of expiredPrograms) {
        // Archive the program
        await db.loyaltyProgram.update({
          where: { id: program.id },
          data: { status: "ARCHIVED" },
        })

        // Freeze all ACTIVE enrollments for this program
        const frozenResult = await db.enrollment.updateMany({
          where: {
            loyaltyProgramId: program.id,
            status: "ACTIVE",
          },
          data: {
            status: "FROZEN",
            frozenAt: now,
          },
        })

        totalEnrollmentsFrozen += frozenResult.count

        // Find frozen enrollments that have wallet passes so we can update them
        const enrollmentsWithPasses = await db.enrollment.findMany({
          where: {
            loyaltyProgramId: program.id,
            status: "FROZEN",
            walletPassType: { not: "NONE" },
          },
          select: { id: true },
        })

        // Batch trigger wallet pass updates for frozen enrollments
        if (enrollmentsWithPasses.length > 0) {
          const BATCH_SIZE = 50
          for (let i = 0; i < enrollmentsWithPasses.length; i += BATCH_SIZE) {
            const batch = enrollmentsWithPasses.slice(i, i + BATCH_SIZE)
            await tasks.batchTrigger<typeof updateWalletPassTask>(
              "update-wallet-pass",
              batch.map((e) => ({
                payload: {
                  enrollmentId: e.id,
                  updateType: "ENROLLMENT_FROZEN" as const,
                },
              }))
            )
          }
          totalWalletUpdatesTriggered += enrollmentsWithPasses.length
        }
      }

      return {
        programsArchived: expiredPrograms.length,
        enrollmentsFrozen: totalEnrollmentsFrozen,
        walletUpdatesTriggered: totalWalletUpdatesTriggered,
      }
    } finally {
      await db.$disconnect()
    }
  },
})

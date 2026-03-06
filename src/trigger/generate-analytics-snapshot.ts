import { schedules } from "@trigger.dev/sdk"
import { analyticsQueue } from "./queues"
import { createDb } from "./db"

// ─── Generate Analytics Snapshot — Daily CRON at 3:00 AM UTC ─

export const generateAnalyticsSnapshotTask = schedules.task({
  id: "generate-analytics-snapshot",
  cron: "0 3 * * *",
  queue: analyticsQueue,
  run: async () => {
    const db = createDb()

    try {
      // Compute yesterday's date (the day we're snapshotting)
      const now = new Date()
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)

      const dayEnd = new Date(yesterday)
      dayEnd.setHours(23, 59, 59, 999)

      // Get all organizations
      const organizations = await db.organization.findMany({
        select: { id: true },
      })

      let snapshotsCreated = 0

      for (const org of organizations) {
        const organizationId = org.id

        // Compute daily aggregates
        const [totalContacts, newContacts, totalInteractions, rewardsEarned, rewardsRedeemed] =
          await Promise.all([
            db.contact.count({
              where: {
                organizationId,
                createdAt: { lte: dayEnd },
              },
            }),
            db.contact.count({
              where: {
                organizationId,
                createdAt: { gte: yesterday, lte: dayEnd },
              },
            }),
            db.interaction.count({
              where: {
                organizationId,
                createdAt: { gte: yesterday, lte: dayEnd },
              },
            }),
            db.reward.count({
              where: {
                organizationId,
                earnedAt: { gte: yesterday, lte: dayEnd },
              },
            }),
            db.reward.count({
              where: {
                organizationId,
                status: "REDEEMED",
                redeemedAt: { gte: yesterday, lte: dayEnd },
              },
            }),
          ])

        // Upsert to handle re-runs gracefully
        await db.analyticsSnapshot.upsert({
          where: {
            organizationId_date: {
              organizationId,
              date: yesterday,
            },
          },
          create: {
            organizationId,
            date: yesterday,
            totalContacts,
            newContacts,
            totalInteractions,
            rewardsEarned,
            rewardsRedeemed,
          },
          update: {
            totalContacts,
            newContacts,
            totalInteractions,
            rewardsEarned,
            rewardsRedeemed,
          },
        })

        snapshotsCreated++
      }

      return {
        date: yesterday.toISOString().split("T")[0],
        organizationsProcessed: organizations.length,
        snapshotsCreated,
      }
    } finally {
      await db.$disconnect()
    }
  },
})

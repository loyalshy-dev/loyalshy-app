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

      // Get all active restaurants
      const restaurants = await db.restaurant.findMany({
        select: { id: true },
      })

      let snapshotsCreated = 0

      for (const restaurant of restaurants) {
        const restaurantId = restaurant.id

        // Compute daily aggregates
        const [totalCustomers, newCustomers, totalVisits, rewardsEarned, rewardsRedeemed] =
          await Promise.all([
            db.customer.count({
              where: {
                restaurantId,
                createdAt: { lte: dayEnd },
              },
            }),
            db.customer.count({
              where: {
                restaurantId,
                createdAt: { gte: yesterday, lte: dayEnd },
              },
            }),
            db.visit.count({
              where: {
                restaurantId,
                createdAt: { gte: yesterday, lte: dayEnd },
              },
            }),
            db.reward.count({
              where: {
                restaurantId,
                earnedAt: { gte: yesterday, lte: dayEnd },
              },
            }),
            db.reward.count({
              where: {
                restaurantId,
                status: "REDEEMED",
                redeemedAt: { gte: yesterday, lte: dayEnd },
              },
            }),
          ])

        // Upsert to handle re-runs gracefully
        await db.analyticsSnapshot.upsert({
          where: {
            restaurantId_date: {
              restaurantId,
              date: yesterday,
            },
          },
          create: {
            restaurantId,
            date: yesterday,
            totalCustomers,
            newCustomers,
            totalVisits,
            rewardsEarned,
            rewardsRedeemed,
          },
          update: {
            totalCustomers,
            newCustomers,
            totalVisits,
            rewardsEarned,
            rewardsRedeemed,
          },
        })

        snapshotsCreated++
      }

      return {
        date: yesterday.toISOString().split("T")[0],
        restaurantsProcessed: restaurants.length,
        snapshotsCreated,
      }
    } finally {
      await db.$disconnect()
    }
  },
})

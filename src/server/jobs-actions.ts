"use server"

import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { assertRestaurantRole, getRestaurantForUser } from "@/lib/dal"

// ─── Types ──────────────────────────────────────────────────

export type JobLogEntry = {
  id: string
  customerName: string
  action: string
  details: Record<string, unknown>
  createdAt: Date
}

export type JobLogsResult = {
  logs: JobLogEntry[]
  total: number
}

// ─── Get Recent Job Logs ────────────────────────────────────

export async function getRecentJobLogs(page = 1, perPage = 25): Promise<JobLogsResult> {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) redirect("/register?step=2")

  await assertRestaurantRole(restaurant.id, "owner")

  const skip = (page - 1) * perPage

  const [logs, total] = await Promise.all([
    db.walletPassLog.findMany({
      where: {
        enrollment: {
          customer: { restaurantId: restaurant.id },
        },
      },
      include: {
        enrollment: {
          select: {
            customer: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    db.walletPassLog.count({
      where: {
        enrollment: {
          customer: { restaurantId: restaurant.id },
        },
      },
    }),
  ])

  return {
    logs: logs.map((log) => ({
      id: log.id,
      customerName: log.enrollment?.customer.fullName ?? "Unknown",
      action: log.action,
      details: log.details as Record<string, unknown>,
      createdAt: log.createdAt,
    })),
    total,
  }
}

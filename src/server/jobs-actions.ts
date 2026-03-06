"use server"

import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"

// ─── Types ──────────────────────────────────────────────────

export type JobLogEntry = {
  id: string
  contactName: string
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
  const organization = await getOrganizationForUser()
  if (!organization) redirect("/register?step=2")

  await assertOrganizationRole(organization.id, "owner")

  const skip = (page - 1) * perPage

  const [logs, total] = await Promise.all([
    db.walletPassLog.findMany({
      where: {
        passInstance: {
          contact: { organizationId: organization.id },
        },
      },
      include: {
        passInstance: {
          select: {
            contact: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    db.walletPassLog.count({
      where: {
        passInstance: {
          contact: { organizationId: organization.id },
        },
      },
    }),
  ])

  return {
    logs: logs.map((log) => ({
      id: log.id,
      contactName: log.passInstance?.contact.fullName ?? "Unknown",
      action: log.action,
      details: log.details as Record<string, unknown>,
      createdAt: log.createdAt,
    })),
    total,
  }
}

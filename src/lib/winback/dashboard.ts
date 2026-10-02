import "server-only"

import { db } from "@/lib/db"
import { orgAllowsFeature } from "@/lib/plan-access"
import { WINBACK_DAYS_DEFAULT, type WinbackDays } from "./config"

const DAY_MS = 24 * 60 * 60 * 1000

export type WinbackDashboardData = {
  planAllowed: boolean
  settings: {
    enabled: boolean
    inactiveDays: WinbackDays
    message: string
    holdout: boolean
    includeExisting: boolean
    startedAt: string | null
  } | null
  /** Last 30 days of runs (PR 2 adds the came-back comparison). */
  last30: { sent: number; control: number; unreachable: number }
}

function asDays(value: number): WinbackDays {
  return value === 14 || value === 30 || value === 60 || value === 90 ? value : WINBACK_DAYS_DEFAULT
}

export async function getWinbackDashboard(organization: {
  id: string
  plan: string
  subscriptionStatus: string
}): Promise<WinbackDashboardData> {
  const since = new Date(Date.now() - 30 * DAY_MS)
  const scope = { organizationId: organization.id, sentAt: { gte: since } }
  const [planAllowed, settings, sent, control, unreachable] = await Promise.all([
    orgAllowsFeature(organization, "winback"),
    db.winbackSettings.findUnique({ where: { organizationId: organization.id } }),
    db.winbackSend.count({ where: { ...scope, control: false, reachable: true } }),
    db.winbackSend.count({ where: { ...scope, control: true } }),
    db.winbackSend.count({ where: { ...scope, reachable: false } }),
  ])
  return {
    planAllowed,
    settings: settings
      ? {
          enabled: settings.enabled,
          inactiveDays: asDays(settings.inactiveDays),
          message: settings.message,
          holdout: settings.holdout,
          includeExisting: settings.includeExisting,
          startedAt: settings.startedAt?.toISOString() ?? null,
        }
      : null,
    last30: { sent, control, unreachable },
  }
}

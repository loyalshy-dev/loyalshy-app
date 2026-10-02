import "server-only"

import { db } from "@/lib/db"
import { orgAllowsFeature } from "@/lib/plan-access"
import { WINBACK_DAYS_DEFAULT, type WinbackDays } from "./config"
import type { WinbackResults } from "./results-math"
import { getWinbackResults, type WinbackPeriod } from "./results"

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
  results: WinbackResults
}

function asDays(value: number): WinbackDays {
  return value === 14 || value === 30 || value === 60 || value === 90 ? value : WINBACK_DAYS_DEFAULT
}

export async function getWinbackDashboard(
  organization: { id: string; plan: string; subscriptionStatus: string },
  period: WinbackPeriod,
): Promise<WinbackDashboardData> {
  const [planAllowed, settings, results] = await Promise.all([
    orgAllowsFeature(organization, "winback"),
    db.winbackSettings.findUnique({ where: { organizationId: organization.id } }),
    getWinbackResults(organization.id, period),
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
    results,
  }
}

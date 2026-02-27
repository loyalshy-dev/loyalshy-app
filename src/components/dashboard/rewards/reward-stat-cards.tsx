"use client"

import { Gift, CheckCircle2, XCircle, Clock } from "lucide-react"
import type { RewardStats } from "@/server/reward-actions"

type RewardStatCardsProps = {
  stats: RewardStats
}

const statConfig = [
  {
    key: "totalAvailable" as const,
    label: "Available",
    icon: Gift,
    iconClassName: "text-success",
    bgClassName: "bg-success/10",
  },
  {
    key: "redeemedThisMonth" as const,
    label: "Redeemed This Month",
    icon: CheckCircle2,
    iconClassName: "text-brand",
    bgClassName: "bg-brand/10",
  },
  {
    key: "redemptionRate" as const,
    label: "Redemption Rate",
    icon: Clock,
    iconClassName: "text-chart-4",
    bgClassName: "bg-chart-4/10",
    suffix: "%",
  },
  {
    key: "avgDaysToRedeem" as const,
    label: "Avg. Days to Redeem",
    icon: XCircle,
    iconClassName: "text-muted-foreground",
    bgClassName: "bg-muted",
    fallback: "—",
  },
]

export function RewardStatCards({ stats }: RewardStatCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statConfig.map((cfg) => {
        const Icon = cfg.icon
        const raw = stats[cfg.key]
        const value =
          raw === null || raw === undefined
            ? cfg.fallback ?? "—"
            : `${raw}${cfg.suffix ?? ""}`

        return (
          <div
            key={cfg.key}
            className="rounded-lg border border-border bg-card p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground">{cfg.label}</p>
              <div
                className={`flex size-8 items-center justify-center rounded-lg ${cfg.bgClassName}`}
              >
                <Icon className={`size-4 ${cfg.iconClassName}`} />
              </div>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        )
      })}
    </div>
  )
}

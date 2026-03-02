"use client"

import { Users, Activity, Gift, Trophy, TrendingUp, TrendingDown } from "lucide-react"
import { useAnimatedCounter } from "@/hooks/use-animated-counter"

type StatCardProps = {
  label: string
  value: number
  change?: number
  icon: React.ReactNode
  suffix?: string
}

function StatCard({ label, value, change, icon, suffix }: StatCardProps) {
  const animatedValue = useAnimatedCounter(value)

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {animatedValue.toLocaleString()}
          {suffix}
        </span>
        {change !== undefined && change !== 0 && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium pb-0.5 ${
              change > 0
                ? "text-success"
                : "text-destructive"
            }`}
          >
            {change > 0 ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {change > 0 ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
    </div>
  )
}

type StatCardsProps = {
  totalCustomers: number
  totalCustomersChange: number
  activityThisMonth: number
  activityChange: number
  activeRewards: number
  rewardsRedeemedThisMonth: number
  rewardsRedeemedChange: number
}

export function StatCards({
  totalCustomers,
  totalCustomersChange,
  activityThisMonth,
  activityChange,
  activeRewards,
  rewardsRedeemedThisMonth,
  rewardsRedeemedChange,
}: StatCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Customers"
        value={totalCustomers}
        change={totalCustomersChange}
        icon={<Users className="size-4" />}
      />
      <StatCard
        label="Activity This Month"
        value={activityThisMonth}
        change={activityChange}
        icon={<Activity className="size-4" />}
      />
      <StatCard
        label="Active Rewards"
        value={activeRewards}
        icon={<Gift className="size-4" />}
      />
      <StatCard
        label="Redeemed This Month"
        value={rewardsRedeemedThisMonth}
        change={rewardsRedeemedChange}
        icon={<Trophy className="size-4" />}
      />
    </div>
  )
}

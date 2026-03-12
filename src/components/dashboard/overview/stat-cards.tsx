"use client"

import { Users, Activity, Gift, Trophy, TrendingUp, TrendingDown } from "lucide-react"
import { useAnimatedCounter } from "@/hooks/use-animated-counter"
import type { PassInstancesByType } from "@/server/analytics"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import { Card } from "@/components/ui/card"

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
    <Card className="p-5 space-y-3">
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
    </Card>
  )
}

const ALL_PASS_TYPES = Object.keys(PASS_TYPE_META) as PassType[]

function PassInstanceBreakdown({ passInstancesByType }: { passInstancesByType: PassInstancesByType }) {
  const activeTypes = ALL_PASS_TYPES.filter((key) => passInstancesByType[key] > 0)

  if (activeTypes.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {activeTypes.map((key) => {
        const meta = PASS_TYPE_META[key]
        const Icon = meta.icon
        const count = passInstancesByType[key]
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <Icon className="size-2.5" />
            {count} {meta.shortLabel}
          </span>
        )
      })}
    </div>
  )
}

type StatCardsProps = {
  totalContacts: number
  totalContactsChange: number
  activityThisMonth: number
  activityChange: number
  activeRewards: number
  rewardsRedeemedThisMonth: number
  rewardsRedeemedChange: number
  activePassInstances: number
  passInstancesByType: PassInstancesByType
}

export function StatCards({
  totalContacts,
  totalContactsChange,
  activityThisMonth,
  activityChange,
  activeRewards,
  rewardsRedeemedThisMonth,
  rewardsRedeemedChange,
  activePassInstances,
  passInstancesByType,
}: StatCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Contacts"
        value={totalContacts}
        change={totalContactsChange}
        icon={<Users className="size-4" />}
      />
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-muted-foreground">
            Active Pass Instances
          </span>
          <span className="text-muted-foreground/60">
            <Activity className="size-4" />
          </span>
        </div>
        <div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {activePassInstances.toLocaleString()}
          </span>
          <PassInstanceBreakdown passInstancesByType={passInstancesByType} />
        </div>
      </Card>
      <StatCard
        label="Activity This Month"
        value={activityThisMonth}
        change={activityChange}
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

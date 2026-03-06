"use client"

import { Users, Activity, Gift, Trophy, TrendingUp, TrendingDown, Stamp, Ticket, Crown, Coins, CreditCard } from "lucide-react"
import { useAnimatedCounter } from "@/hooks/use-animated-counter"
import type { EnrollmentsByType } from "@/server/analytics"

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

const TYPE_PILLS: { key: keyof EnrollmentsByType; icon: typeof Stamp; label: string }[] = [
  { key: "STAMP_CARD", icon: Stamp, label: "Stamp" },
  { key: "COUPON", icon: Ticket, label: "Coupon" },
  { key: "MEMBERSHIP", icon: Crown, label: "Member" },
  { key: "POINTS", icon: Coins, label: "Points" },
  { key: "PREPAID", icon: CreditCard, label: "Prepaid" },
]

function EnrollmentBreakdown({ enrollmentsByType, total }: { enrollmentsByType: EnrollmentsByType; total: number }) {
  const activeTypes = TYPE_PILLS.filter((t) => enrollmentsByType[t.key] > 0)

  if (activeTypes.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {activeTypes.map((t) => {
        const Icon = t.icon
        const count = enrollmentsByType[t.key]
        return (
          <span
            key={t.key}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <Icon className="size-2.5" />
            {count} {t.label}
          </span>
        )
      })}
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
  activeEnrollments: number
  enrollmentsByType: EnrollmentsByType
}

export function StatCards({
  totalCustomers,
  totalCustomersChange,
  activityThisMonth,
  activityChange,
  activeRewards,
  rewardsRedeemedThisMonth,
  rewardsRedeemedChange,
  activeEnrollments,
  enrollmentsByType,
}: StatCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Customers"
        value={totalCustomers}
        change={totalCustomersChange}
        icon={<Users className="size-4" />}
      />
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-muted-foreground">
            Active Enrollments
          </span>
          <span className="text-muted-foreground/60">
            <Activity className="size-4" />
          </span>
        </div>
        <div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {activeEnrollments.toLocaleString()}
          </span>
          <EnrollmentBreakdown enrollmentsByType={enrollmentsByType} total={activeEnrollments} />
        </div>
      </div>
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

"use client"

import {
  Users,
  Building2,
  UserCheck,
  Euro,
  UserPlus,
  Store,
  CreditCard,
  Wallet,
  MousePointerClick,
  Gift,
} from "lucide-react"
import { useAnimatedCounter } from "@/hooks/use-animated-counter"
import { Card } from "@/components/ui/card"

type StatCardProps = {
  label: string
  value: number
  icon: React.ReactNode
  prefix?: string
}

function StatCard({ label, value, icon, prefix }: StatCardProps) {
  const animatedValue = useAnimatedCounter(value)

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {prefix}
        {animatedValue.toLocaleString()}
      </span>
    </Card>
  )
}

type AdminStatCardsProps = {
  totalUsers: number
  totalOrganizations: number
  totalContacts: number
  totalPassInstances: number
  totalInteractions: number
  totalRewards: number
  estimatedMrr: number
  newUsersThisMonth: number
  newOrganizationsThisMonth: number
  activeSubscriptions: number
}

export function AdminStatCards({
  totalUsers,
  totalOrganizations,
  totalContacts,
  totalPassInstances,
  totalInteractions,
  totalRewards,
  estimatedMrr,
  newUsersThisMonth,
  newOrganizationsThisMonth,
  activeSubscriptions,
}: AdminStatCardsProps) {
  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Est. MRR"
          value={estimatedMrr}
          prefix="€"
          icon={<Euro className="size-4" />}
        />
        <StatCard
          label="Organizations"
          value={totalOrganizations}
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label="Total Users"
          value={totalUsers}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Active Subscriptions"
          value={activeSubscriptions}
          icon={<CreditCard className="size-4" />}
        />
      </div>

      {/* Product metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Contacts"
          value={totalContacts}
          icon={<UserCheck className="size-4" />}
        />
        <StatCard
          label="Passes Issued"
          value={totalPassInstances}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Interactions"
          value={totalInteractions}
          icon={<MousePointerClick className="size-4" />}
        />
        <StatCard
          label="Rewards"
          value={totalRewards}
          icon={<Gift className="size-4" />}
        />
      </div>

      {/* Growth this month */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="New Users This Month"
          value={newUsersThisMonth}
          icon={<UserPlus className="size-4" />}
        />
        <StatCard
          label="New Organizations This Month"
          value={newOrganizationsThisMonth}
          icon={<Store className="size-4" />}
        />
      </div>
    </div>
  )
}

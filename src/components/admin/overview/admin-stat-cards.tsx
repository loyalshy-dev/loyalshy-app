"use client"

import {
  Users,
  Building2,
  UserCheck,
  DollarSign,
  UserPlus,
  Store,
  CreditCard,
} from "lucide-react"
import { useAnimatedCounter } from "@/hooks/use-animated-counter"

type StatCardProps = {
  label: string
  value: number
  icon: React.ReactNode
  prefix?: string
}

function StatCard({ label, value, icon, prefix }: StatCardProps) {
  const animatedValue = useAnimatedCounter(value)

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
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
    </div>
  )
}

type AdminStatCardsProps = {
  totalUsers: number
  totalOrganizations: number
  totalContacts: number
  estimatedMrr: number
  newUsersThisMonth: number
  newOrganizationsThisMonth: number
  activeSubscriptions: number
}

export function AdminStatCards({
  totalUsers,
  totalOrganizations,
  totalContacts,
  estimatedMrr,
  newUsersThisMonth,
  newOrganizationsThisMonth,
  activeSubscriptions,
}: AdminStatCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={totalUsers}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Organizations"
          value={totalOrganizations}
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label="Contacts"
          value={totalContacts}
          icon={<UserCheck className="size-4" />}
        />
        <StatCard
          label="Est. MRR"
          value={estimatedMrr}
          prefix="$"
          icon={<DollarSign className="size-4" />}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
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
        <StatCard
          label="Active Subscriptions"
          value={activeSubscriptions}
          icon={<CreditCard className="size-4" />}
        />
      </div>
    </div>
  )
}

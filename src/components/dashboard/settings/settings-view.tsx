"use client"

import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Building2, Users, CreditCard, Activity } from "lucide-react"
import { GeneralSettingsForm } from "./general-settings-form"
import { TeamManagement } from "./team-management"
import { BillingSettings } from "./billing-settings"
import type { BillingData } from "@/server/billing-actions"

type Tab = "general" | "team" | "billing"

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", label: "General", icon: Building2 },
  { id: "team", label: "Team", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
]

type Restaurant = {
  id: string
  name: string
  slug: string
  logo: string | null
  brandColor: string | null
  secondaryColor: string | null
  address: string | null
  phone: string | null
  website: string | null
  timezone: string
  plan: string
  subscriptionStatus: string
}

type Member = {
  id: string
  userId: string
  role: string
  createdAt: Date
  user: {
    id: string
    name: string
    email: string
    image: string | null
    createdAt: Date
  }
}

type PendingInvitation = {
  id: string
  email: string
  role: string
  createdAt: Date
  expiresAt: Date
}

type SettingsViewProps = {
  restaurant: Restaurant
  members: Member[]
  pendingInvitations: PendingInvitation[]
  activeTab: string
  billingData: BillingData | null
}

export function SettingsView({
  restaurant,
  members,
  pendingInvitations,
  activeTab,
  billingData,
}: SettingsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Support legacy tabs by falling back to "general"
  const resolvedTab = activeTab === "loyalty" || activeTab === "card-design" || activeTab === "programs" ? "general" : activeTab
  const currentTab = (tabs.find((t) => t.id === resolvedTab)?.id ?? "general") as Tab

  function setTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "general") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    const query = params.toString()
    router.push(`/dashboard/settings${query ? `?${query}` : ""}`)
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = currentTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium
                border-b-2 transition-colors -mb-px whitespace-nowrap
                ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
        {/* Jobs — separate page, styled as a tab link */}
        <Link
          href="/dashboard/settings/jobs"
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-border transition-colors -mb-px whitespace-nowrap"
        >
          <Activity className="h-4 w-4" />
          Jobs
        </Link>
      </div>

      {/* Tab Content */}
      {currentTab === "general" && (
        <GeneralSettingsForm restaurant={restaurant} />
      )}
      {currentTab === "team" && (
        <TeamManagement
          restaurant={restaurant}
          members={members}
          pendingInvitations={pendingInvitations}
        />
      )}
      {currentTab === "billing" && billingData && (
        <BillingSettings data={billingData} />
      )}
    </div>
  )
}

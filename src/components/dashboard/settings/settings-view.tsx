"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Building2, Users, CreditCard, Key } from "lucide-react"
import { GeneralSettingsForm } from "./general-settings-form"
import { TeamManagement } from "./team-management"
import { ConnectDevice } from "./connect-device"
import { BillingSettings } from "./billing-settings"
import { ApiKeysSection } from "./api-keys-section"
import { WebhookSection } from "./webhook-section"
import type { BillingData } from "@/server/billing-actions"
import { PLANS } from "@/lib/plans"
import type { PlanId } from "@/lib/plans"
import { Card } from "@/components/ui/card"

type Tab = "general" | "team" | "billing" | "api"

type Organization = {
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
  settings: Record<string, unknown>
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
  organization: Organization
  members: Member[]
  pendingInvitations: PendingInvitation[]
  activeTab: string
  billingData: BillingData | null
  currentUserId: string
}

export function SettingsView({
  organization,
  members,
  pendingInvitations,
  activeTab,
  billingData,
  currentUserId,
}: SettingsViewProps) {
  const t = useTranslations("dashboard.settings")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startNavTransition] = useTransition()
  const [pendingTab, setPendingTab] = useState<Tab | null>(null)

  const baseTabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "general", label: t("general"), icon: Building2 },
    { id: "team", label: t("team"), icon: Users },
    { id: "billing", label: t("billing"), icon: CreditCard },
  ]

  // Build tabs list — include API tab if plan allows API access
  const plan = PLANS[organization.plan as PlanId]
  const tabs = plan?.apiAccess
    ? [...baseTabs, { id: "api" as Tab, label: t("api"), icon: Key }]
    : baseTabs

  // Support legacy tabs by falling back to "general"
  const resolvedTab = activeTab === "loyalty" || activeTab === "card-design" || activeTab === "programs" ? "general" : activeTab
  const currentTab = (tabs.find((tab) => tab.id === resolvedTab)?.id ?? "general") as Tab

  function setTab(tab: Tab) {
    setPendingTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "general") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    const query = params.toString()
    startNavTransition(() => {
      router.push(`/dashboard/settings${query ? `?${query}` : ""}`)
      setPendingTab(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = (pendingTab ?? currentTab) === tab.id
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
      </div>

      {/* Tab Content */}
      {currentTab === "general" && (
        <GeneralSettingsForm organization={organization} />
      )}
      {currentTab === "team" && (
        <div className="space-y-6">
          <TeamManagement
            organization={organization}
            members={members}
            pendingInvitations={pendingInvitations}
            currentUserId={currentUserId}
          />
          <ConnectDevice organizationName={organization.name} />
        </div>
      )}
      {currentTab === "billing" && (
        billingData ? (
          <BillingSettings data={billingData} />
        ) : (
          <Card className="p-8 text-center">
            <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-medium">Unable to load billing data</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              There was a problem loading your billing information. Please try refreshing the page.
            </p>
          </Card>
        )
      )}
      {currentTab === "api" && (
        <div className="space-y-8">
          <ApiKeysSection />
          <hr className="border-border" />
          <WebhookSection />
        </div>
      )}
    </div>
  )
}

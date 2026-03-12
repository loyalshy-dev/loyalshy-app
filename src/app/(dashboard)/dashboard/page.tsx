import { Suspense } from "react"
import { connection } from "next/server"
import { assertAuthenticated, getOrganizationForUser } from "@/lib/dal"
import { getOnboardingChecklist } from "@/server/onboarding-registration-actions"
import {
  getOverviewStats,
  getInteractionsOverTime,
  getBusiestDays,
  getRecentActivity,
  getTopContacts,
  getTemplatesSummary,
} from "@/server/analytics"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { StatCards } from "@/components/dashboard/overview/stat-cards"
import { InteractionsChart } from "@/components/dashboard/overview/visits-chart"
import { BusiestDaysChart } from "@/components/dashboard/overview/busiest-days-chart"
import { RecentActivity } from "@/components/dashboard/overview/recent-activity"
import { TopContacts } from "@/components/dashboard/overview/top-customers"
import { ProgramsSummary } from "@/components/dashboard/overview/programs-summary"
import {
  StatCardsSkeleton,
  VisitsChartSkeleton,
  SecondaryChartSkeleton,
  ActivitySkeleton,
  TopCustomersSkeleton,
} from "@/components/dashboard/overview/skeletons"

export default async function OverviewPage() {
  await connection()
  await assertAuthenticated()

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <OnboardingChecklistSection />
      </Suspense>

      <Suspense fallback={<StatCardsSkeleton />}>
        <StatsSection />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<VisitsChartSkeleton />}>
          <div className="lg:col-span-2">
            <ChartsSection />
          </div>
        </Suspense>
        <Suspense fallback={<SecondaryChartSkeleton />}>
          <BusiestDaysSection />
        </Suspense>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<ActivitySkeleton />}>
          <RecentActivitySection />
        </Suspense>
        <Suspense fallback={<TopCustomersSkeleton />}>
          <TopContactsSection />
        </Suspense>
        <Suspense fallback={<SecondaryChartSkeleton />}>
          <ProgramsSummarySection />
        </Suspense>
      </div>
    </div>
  )
}

async function StatsSection() {
  const stats = await getOverviewStats()
  return <StatCards {...stats} />
}

async function ChartsSection() {
  const data = await getInteractionsOverTime("30d")
  return <InteractionsChart initialData={data} initialRange="30d" />
}

async function BusiestDaysSection() {
  const data = await getBusiestDays()
  return <BusiestDaysChart data={data} />
}

async function RecentActivitySection() {
  const items = await getRecentActivity()
  return <RecentActivity items={items} />
}

async function TopContactsSection() {
  const contacts = await getTopContacts()
  return <TopContacts contacts={contacts} />
}

async function ProgramsSummarySection() {
  const programs = await getTemplatesSummary()
  return <ProgramsSummary programs={programs} />
}

async function OnboardingChecklistSection() {
  const organization = await getOrganizationForUser()
  if (!organization) return null

  const data = await getOnboardingChecklist(organization.id)
  if (data.isDismissed) return null

  return <OnboardingChecklist organizationId={organization.id} data={data} />
}
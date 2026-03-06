import { Suspense } from "react"
import { connection } from "next/server"
import { assertAuthenticated, getOrganizationForUser } from "@/lib/dal"
import {
  getOverviewStats,
  getInteractionsOverTime,
  getBusiestDays,
  getTemplatesSummary,
  getRecentActivity,
  getTopContacts,
} from "@/server/analytics"
import { getOnboardingChecklist } from "@/server/onboarding-registration-actions"
import { StatCards } from "@/components/dashboard/overview/stat-cards"
import { InteractionsChart } from "@/components/dashboard/overview/visits-chart"
import { BusiestDaysChart } from "@/components/dashboard/overview/busiest-days-chart"
import { ProgramsSummary } from "@/components/dashboard/overview/programs-summary"
import { RecentActivity } from "@/components/dashboard/overview/recent-activity"
import { TopContacts } from "@/components/dashboard/overview/top-customers"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your organization at a glance.
        </p>
      </div>

      <Suspense fallback={null}>
        <OnboardingChecklistSection />
      </Suspense>

      <Suspense fallback={<StatCardsSkeleton />}>
        <StatCardsSection />
      </Suspense>

      <Suspense fallback={<VisitsChartSkeleton />}>
        <InteractionsChartSection />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<SecondaryChartSkeleton />}>
          <BusiestDaysSection />
        </Suspense>
        <Suspense fallback={<SecondaryChartSkeleton />}>
          <TemplatesSummarySection />
        </Suspense>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Suspense fallback={<ActivitySkeleton />}>
            <RecentActivitySection />
          </Suspense>
        </div>
        <div className="lg:col-span-2">
          <Suspense fallback={<TopCustomersSkeleton />}>
            <TopContactsSection />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

// --- Async Server Components (streamed with Suspense) -------

async function StatCardsSection() {
  const stats = await getOverviewStats()
  return <StatCards {...stats} />
}

async function InteractionsChartSection() {
  const data = await getInteractionsOverTime("30d")
  return <InteractionsChart initialData={data} initialRange="30d" />
}

async function BusiestDaysSection() {
  const data = await getBusiestDays()
  return <BusiestDaysChart data={data} />
}

async function TemplatesSummarySection() {
  const templates = await getTemplatesSummary()
  return <ProgramsSummary programs={templates} />
}

async function RecentActivitySection() {
  const items = await getRecentActivity()
  return <RecentActivity items={items} />
}

async function TopContactsSection() {
  const contacts = await getTopContacts()
  return <TopContacts contacts={contacts} />
}

async function OnboardingChecklistSection() {
  const organization = await getOrganizationForUser()
  if (!organization) return null

  const data = await getOnboardingChecklist(organization.id)
  if (data.isDismissed) return null

  return <OnboardingChecklist organizationId={organization.id} data={data} />
}

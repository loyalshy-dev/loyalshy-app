import { Suspense } from "react"
import { connection } from "next/server"
import { assertAuthenticated, getRestaurantForUser } from "@/lib/dal"
import {
  getOverviewStats,
  getVisitsOverTime,
  getBusiestDays,
  getRewardDistribution,
  getRecentActivity,
  getTopCustomers,
} from "@/server/analytics"
import { getOnboardingChecklist } from "@/server/onboarding-registration-actions"
import { StatCards } from "@/components/dashboard/overview/stat-cards"
import { VisitsChart } from "@/components/dashboard/overview/visits-chart"
import { BusiestDaysChart } from "@/components/dashboard/overview/busiest-days-chart"
import { RewardDistributionChart } from "@/components/dashboard/overview/reward-distribution-chart"
import { RecentActivity } from "@/components/dashboard/overview/recent-activity"
import { TopCustomers } from "@/components/dashboard/overview/top-customers"
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
          Your restaurant at a glance.
        </p>
      </div>

      <Suspense fallback={null}>
        <OnboardingChecklistSection />
      </Suspense>

      <Suspense fallback={<StatCardsSkeleton />}>
        <StatCardsSection />
      </Suspense>

      <Suspense fallback={<VisitsChartSkeleton />}>
        <VisitsChartSection />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<SecondaryChartSkeleton />}>
          <BusiestDaysSection />
        </Suspense>
        <Suspense fallback={<SecondaryChartSkeleton />}>
          <RewardDistributionSection />
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
            <TopCustomersSection />
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

async function VisitsChartSection() {
  const data = await getVisitsOverTime("30d")
  return <VisitsChart initialData={data} initialRange="30d" />
}

async function BusiestDaysSection() {
  const data = await getBusiestDays()
  return <BusiestDaysChart data={data} />
}

async function RewardDistributionSection() {
  const restaurant = await getRestaurantForUser()

  // Multi-program: use the first active program for the distribution chart.
  // In future, this could aggregate across programs or allow switching.
  const firstProgram = restaurant?.loyaltyPrograms?.[0]
  const visitsRequired = firstProgram?.visitsRequired ?? 10
  const programName = firstProgram?.name ?? "Loyalty Program"

  const data = await getRewardDistribution(visitsRequired)
  return (
    <RewardDistributionChart
      data={data}
      visitsRequired={visitsRequired}
      programName={programName}
    />
  )
}

async function RecentActivitySection() {
  const items = await getRecentActivity()
  return <RecentActivity items={items} />
}

async function TopCustomersSection() {
  const customers = await getTopCustomers()
  return <TopCustomers customers={customers} />
}

async function OnboardingChecklistSection() {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) return null

  const data = await getOnboardingChecklist(restaurant.id)
  if (data.isDismissed) return null

  return <OnboardingChecklist restaurantId={restaurant.id} data={data} />
}

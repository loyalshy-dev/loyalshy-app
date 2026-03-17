import { connection } from "next/server"
import { assertAdminRole } from "@/lib/dal"
import { getAdminPlatformStats } from "@/server/admin-actions"
import { AdminStatCards } from "@/components/admin/overview/admin-stat-cards"
import { SubscriptionBreakdown } from "@/components/admin/overview/subscription-breakdown"
import { PlanBreakdown } from "@/components/admin/overview/plan-breakdown"
import { PassTypeBreakdown } from "@/components/admin/overview/pass-type-breakdown"
import { RecentSignups } from "@/components/admin/overview/recent-signups"

export default async function AdminOverviewPage() {
  await connection()
  await assertAdminRole("ADMIN_SUPPORT")

  const stats = await getAdminPlatformStats()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Platform Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global metrics across all organizations and users.
        </p>
      </div>

      <AdminStatCards
        totalUsers={stats.totalUsers}
        totalOrganizations={stats.totalOrganizations}
        totalContacts={stats.totalContacts}
        totalPassInstances={stats.totalPassInstances}
        totalInteractions={stats.totalInteractions}
        totalRewards={stats.totalRewards}
        estimatedMrr={stats.estimatedMrr}
        newUsersThisMonth={stats.newUsersThisMonth}
        newOrganizationsThisMonth={stats.newOrganizationsThisMonth}
        activeSubscriptions={stats.activeSubscriptions}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SubscriptionBreakdown data={stats.subscriptionBreakdown} />
        <PlanBreakdown data={stats.planBreakdown} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PassTypeBreakdown data={stats.passTypeBreakdown} />
        <RecentSignups users={stats.recentSignups} />
      </div>
    </div>
  )
}

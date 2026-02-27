import { connection } from "next/server"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantRole } from "@/lib/dal"
import { getSettingsData } from "@/server/settings-actions"
import { getBillingData } from "@/server/billing-actions"
import { redirect } from "next/navigation"
import { SettingsView } from "@/components/dashboard/settings/settings-view"

export default async function SettingsPage(props: {
  searchParams: Promise<{ tab?: string; checkout?: string }>
}) {
  await connection()
  const searchParams = await props.searchParams
  await assertAuthenticated()

  const restaurant = await getRestaurantForUser()
  if (!restaurant) {
    redirect("/dashboard")
  }

  await assertRestaurantRole(restaurant.id, "owner")

  const activeTab = searchParams.tab ?? "general"

  // Fetch settings data and billing data in parallel
  const [data, billingResult] = await Promise.all([
    getSettingsData(),
    activeTab === "billing" ? getBillingData() : Promise.resolve(null),
  ])

  if ("error" in data) {
    redirect("/dashboard")
  }

  const billingData = billingResult && !("error" in billingResult) ? billingResult : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your restaurant and loyalty program settings.
        </p>
      </div>

      <SettingsView
        restaurant={data.restaurant}
        members={data.members}
        pendingInvitations={data.pendingInvitations}
        activeTab={activeTab}
        billingData={billingData}
      />
    </div>
  )
}

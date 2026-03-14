import { connection } from "next/server"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { getSettingsData } from "@/server/org-settings-actions"
import { getBillingData } from "@/server/billing-actions"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { SettingsView } from "@/components/dashboard/settings/settings-view"

export default async function SettingsPage(props: {
  searchParams: Promise<{ tab?: string; checkout?: string }>
}) {
  await connection()
  const [searchParams, t, session] = await Promise.all([
    props.searchParams,
    getTranslations("dashboard.settings"),
    assertAuthenticated(),
  ])

  const organization = await getOrganizationForUser()
  if (!organization) {
    redirect("/dashboard")
  }

  await assertOrganizationRole(organization.id, "owner")

  const activeTab = searchParams.tab ?? "general"

  // Fetch settings data and billing data in parallel
  const [data, billingResult] = await Promise.all([
    getSettingsData(),
    getBillingData(),
  ])

  if ("error" in data) {
    redirect("/dashboard")
  }

  const billingData = billingResult && !("error" in billingResult) ? billingResult : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      <SettingsView
        organization={data.organization}
        members={data.members}
        pendingInvitations={data.pendingInvitations}
        activeTab={activeTab}
        billingData={billingData}
        currentUserId={session.user.id}
      />
    </div>
  )
}

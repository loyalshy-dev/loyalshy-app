import { connection } from "next/server"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { assertAuthenticated, assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"
import { getProximityDashboard } from "@/lib/proximity/dashboard"
import { ProximityView } from "@/components/dashboard/proximity/proximity-view"

export default async function ProximityPage() {
  await connection()
  const [t] = await Promise.all([getTranslations("dashboard.proximity"), assertAuthenticated()])

  const organization = await getOrganizationForUser()
  if (!organization) redirect("/dashboard")
  await assertOrganizationRole(organization.id, "admin")

  const data = await getProximityDashboard(organization.id)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      <ProximityView data={data} organizationName={organization.name} />
    </div>
  )
}

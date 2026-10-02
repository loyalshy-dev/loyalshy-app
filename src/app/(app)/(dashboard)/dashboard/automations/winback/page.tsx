import { connection } from "next/server"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { assertAuthenticated, assertOrganizationRole, getOrganizationForUser, getOrgMember } from "@/lib/dal"
import { getWinbackDashboard } from "@/lib/winback/dashboard"
import { WinbackView } from "@/components/dashboard/winback/winback-view"

export default async function WinbackPage() {
  await connection()
  const [t] = await Promise.all([getTranslations("dashboard.winback"), assertAuthenticated()])

  const organization = await getOrganizationForUser()
  if (!organization) redirect("/dashboard")
  await assertOrganizationRole(organization.id, "admin")

  const [member, data] = await Promise.all([
    getOrgMember(organization.id),
    getWinbackDashboard(organization),
  ])

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      <WinbackView
        data={data}
        organizationName={organization.name}
        canManageBilling={member?.role === "owner"}
      />
    </div>
  )
}

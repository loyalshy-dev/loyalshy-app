import { connection } from "next/server"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { assertAuthenticated, assertOrganizationRole, getOrganizationForUser, getOrgMember } from "@/lib/dal"
import { getReviewsDashboard } from "@/lib/reviews/dashboard"
import { ReviewsView } from "@/components/dashboard/reviews/reviews-view"

export default async function ReviewsPage() {
  await connection()
  const [t] = await Promise.all([getTranslations("dashboard.reviews"), assertAuthenticated()])

  const organization = await getOrganizationForUser()
  if (!organization) redirect("/dashboard")
  // Owner + admin ("Program manager") — partners set this up for clients.
  await assertOrganizationRole(organization.id, "admin")

  const [member, data] = await Promise.all([
    getOrgMember(organization.id),
    getReviewsDashboard(organization),
  ])

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      <ReviewsView
        data={data}
        organizationName={organization.name}
        canManageBilling={member?.role === "owner"}
      />
    </div>
  )
}

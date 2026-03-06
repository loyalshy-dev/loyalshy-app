import { connection } from "next/server"
import { redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser } from "@/lib/dal"
import { db } from "@/lib/db"
import { getTemplatesList } from "@/server/template-actions"
import { TemplatesListView as ProgramsListView } from "@/components/dashboard/programs/programs-list-view"

export default async function ProgramsPage() {
  await connection()
  const session = await assertAuthenticated()

  const organization = await getOrganizationForUser()
  if (!organization) {
    redirect("/dashboard")
  }

  const programs = await getTemplatesList()

  // Compute isOwner
  let isOwner = false
  if (session.user.role === "SUPER_ADMIN") {
    isOwner = true
  } else {
    const member = await db.member.findFirst({
      where: { organizationId: organization.id, userId: session.user.id },
      select: { role: true },
    })
    isOwner = member?.role === "owner"
  }

  return (
    <ProgramsListView
      programs={programs}
      organizationId={organization.id}
      organizationName={organization.name}
      isOwner={isOwner}
    />
  )
}

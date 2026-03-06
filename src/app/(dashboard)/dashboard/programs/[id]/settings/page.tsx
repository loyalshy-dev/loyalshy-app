import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { getTemplateForSettings } from "@/server/template-actions"
import { ProgramEditor } from "@/components/dashboard/programs/program-editor"

export default async function ProgramSettingsPage(props: {
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id: programId } = await props.params
  await assertAuthenticated()

  const organization = await getOrganizationForUser()
  if (!organization) {
    redirect("/dashboard")
  }

  await assertOrganizationRole(organization.id, "owner")

  const program = await getTemplateForSettings(programId)
  if (!program) {
    notFound()
  }

  return (
    <ProgramEditor
      program={program}
      organization={{
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        brandColor: organization.brandColor,
        secondaryColor: organization.secondaryColor,
      }}
    />
  )
}

import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { ProgramSettings } from "@/components/dashboard/programs/program-settings"

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

  const program = await db.passTemplate.findFirst({
    where: { id: programId, organizationId: organization.id },
    select: {
      id: true,
      name: true,
      passType: true,
      joinMode: true,
      status: true,
    },
  })

  if (!program) {
    notFound()
  }

  return (
    <ProgramSettings
      program={program}
      organizationId={organization.id}
    />
  )
}

import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { QrCodeDisplay } from "@/components/dashboard/settings/qr-code-display"

export default async function ProgramDistributionPage(props: {
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
      config: true,
      passDesign: {
        select: {
          cardType: true,
          primaryColor: true,
          secondaryColor: true,
          textColor: true,
          showStrip: true,
          patternStyle: true,
          progressStyle: true,
          labelFormat: true,
          customProgressLabel: true,
          stripImageUrl: true,
          editorConfig: true,
        },
      },
    },
  })

  if (!program) {
    notFound()
  }

  return (
    <QrCodeDisplay
      organization={{
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        logoApple: organization.logoApple ?? null,
        brandColor: organization.brandColor,
      }}
      templates={[
        {
          id: program.id,
          name: program.name,
          passType: program.passType,
          templateConfig: program.config,
          rewardDescription: (program.config as Record<string, unknown> | null)?.rewardDescription as string ?? "",
          visitsRequired: (program.config as Record<string, unknown> | null)?.stampsRequired as number ?? 10,
          cardDesign: program.passDesign ?? null,
        },
      ]}
    />
  )
}

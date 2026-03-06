import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { PassDesignPreview } from "@/components/dashboard/settings/card-design-preview"

export default async function ProgramDesignPage(props: {
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
    include: { passDesign: true },
  })

  if (!program) {
    notFound()
  }

  return (
    <PassDesignPreview
      templateId={programId}
      templateName={program.name}
      passType={program.passType}
      templateConfig={program.config}
      organizationName={organization.name}
      organizationLogo={organization.logo}
      organizationLogoApple={organization.logoApple}
      organizationLogoGoogle={organization.logoGoogle}
      visitsRequired={((program.config as Record<string, unknown> | null)?.stampsRequired as number) ?? 10}
      rewardDescription={((program.config as Record<string, unknown> | null)?.rewardDescription as string) ?? "Free reward"}
      cardDesign={
        program.passDesign
          ? {
              cardType: program.passDesign.cardType as string,
              showStrip: program.passDesign.showStrip as boolean,
              primaryColor: program.passDesign.primaryColor,
              secondaryColor: program.passDesign.secondaryColor,
              textColor: program.passDesign.textColor,
              patternStyle: program.passDesign.patternStyle as string,
              progressStyle: program.passDesign.progressStyle as string,
              labelFormat: program.passDesign.labelFormat as string,
              customProgressLabel: program.passDesign.customProgressLabel ?? null,
              stripImageUrl: program.passDesign.stripImageUrl ?? null,
              editorConfig: program.passDesign.editorConfig,
            }
          : null
      }
    />
  )
}

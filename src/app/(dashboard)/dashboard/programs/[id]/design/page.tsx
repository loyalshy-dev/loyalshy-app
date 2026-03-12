import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { parseStampGridConfig, parseStripFilters } from "@/lib/wallet/card-design"
import { StudioLayout } from "@/components/studio/studio-layout"

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

  const walletPassCount = await db.passInstance.count({
    where: {
      passTemplateId: programId,
      walletProvider: { not: "NONE" },
    },
  })

  // Serialize pass design for client
  const passDesign = program.passDesign
  const stripFilters = passDesign
    ? parseStripFilters(passDesign.editorConfig)
    : parseStripFilters(null)

  const isLegacyStampGrid = passDesign?.patternStyle === "STAMP_GRID"
  const useStampGrid = stripFilters.useStampGrid || isLegacyStampGrid
  const realPatternStyle = isLegacyStampGrid ? "NONE" : (passDesign?.patternStyle ?? "NONE")

  const walletData = passDesign
    ? {
        showStrip: passDesign.showStrip as boolean,
        primaryColor: passDesign.primaryColor ?? "#1a1a2e",
        secondaryColor: passDesign.secondaryColor ?? "#ffffff",
        textColor: passDesign.textColor ?? "#ffffff",
        patternStyle: realPatternStyle as string,
        progressStyle: passDesign.progressStyle as string,
        fontFamily: passDesign.fontFamily as string,
        labelFormat: passDesign.labelFormat as string,
        customProgressLabel: passDesign.customProgressLabel ?? "",
        palettePreset: passDesign.palettePreset ?? null,
        templateId: passDesign.templateId ?? null,
        stripImageUrl: passDesign.stripImageUrl ?? null,
        stripImageApple: passDesign.stripImageApple ?? null,
        stripImageGoogle: passDesign.stripImageGoogle ?? null,
        stripOpacity: stripFilters.stripOpacity,
        stripGrayscale: stripFilters.stripGrayscale,
        stripColor1: stripFilters.stripColor1,
        stripColor2: stripFilters.stripColor2,
        stripFill: stripFilters.stripFill,
        patternColor: stripFilters.patternColor,
        stripImagePosition: stripFilters.stripImagePosition,
        stripImageZoom: stripFilters.stripImageZoom,
        labelColor: stripFilters.labelColor,
        stampFilledColor: stripFilters.stampFilledColor,
        logoAppleZoom: stripFilters.logoAppleZoom,
        logoGoogleZoom: stripFilters.logoGoogleZoom,
        headerFields: stripFilters.headerFields,
        secondaryFields: stripFilters.secondaryFields,
        fields: stripFilters.fields,
        fieldLabels: stripFilters.fieldLabels,
        useStampGrid,
        generatedStripApple: passDesign.generatedStripApple ?? null,
        generatedStripGoogle: passDesign.generatedStripGoogle ?? null,
        businessHours: passDesign.businessHours ?? "",
        mapAddress: passDesign.mapAddress ?? "",
        mapLatitude: passDesign.mapLatitude ?? null,
        mapLongitude: passDesign.mapLongitude ?? null,
        locationMessage: stripFilters.locationMessage ?? "",
        socialLinks: (passDesign.socialLinks as Record<string, string>) ?? {},
        customMessage: passDesign.customMessage ?? "",
        cardType: passDesign.cardType as string,
        stampGridConfig: parseStampGridConfig(passDesign.editorConfig),
        holderPhotoUrl: ((passDesign.editorConfig as Record<string, unknown> | null)?.holderPhotoUrl as string) ?? null,
      }
    : null

  const programConfig = program.config as Record<string, unknown> | null

  return (
    <StudioLayout
      templateId={programId}
      templateName={program.name}
      passType={program.passType}
      templateConfig={program.config}
      templateStartsAt={program.startsAt.toISOString()}
      templateEndsAt={program.endsAt?.toISOString() ?? ""}
      organizationName={organization.name}
      organizationLogo={organization.logo}
      organizationLogoApple={organization.logoApple}
      organizationLogoGoogle={organization.logoGoogle}
      organizationId={organization.id}
      visitsRequired={(programConfig?.stampsRequired as number) ?? 10}
      rewardDescription={(programConfig?.rewardDescription as string) ?? ""}
      walletData={walletData}
      walletPassCount={walletPassCount}
      embedded
    />
  )
}

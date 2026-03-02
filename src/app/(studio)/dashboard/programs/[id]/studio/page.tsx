import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { parseStampGridConfig, parseStripFilters } from "@/lib/wallet/card-design"
import { StudioLayout } from "@/components/studio/studio-layout"

export default async function StudioPage(props: {
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id: programId } = await props.params
  await assertAuthenticated()

  const restaurant = await getRestaurantForUser()
  if (!restaurant) {
    redirect("/dashboard")
  }

  await assertRestaurantRole(restaurant.id, "owner")

  const program = await db.loyaltyProgram.findFirst({
    where: { id: programId, restaurantId: restaurant.id },
    include: { cardDesign: true },
  })

  if (!program) {
    notFound()
  }

  const walletPassCount = await db.enrollment.count({
    where: {
      loyaltyProgramId: programId,
      walletPassType: { not: "NONE" },
    },
  })

  // Serialize card design for client
  const cardDesign = program.cardDesign
  const stripFilters = cardDesign ? parseStripFilters(cardDesign.editorConfig) : { stripOpacity: 1, stripGrayscale: false, useStampGrid: false, stripColor1: null, stripColor2: null, stripFill: "gradient" as const, patternColor: null, stripImagePosition: { x: 0.5, y: 0.5 }, stripImageZoom: 1 }
  // Backward compat: old data has patternStyle="STAMP_GRID" in DB column
  const isLegacyStampGrid = cardDesign?.patternStyle === "STAMP_GRID"
  const useStampGrid = stripFilters.useStampGrid || isLegacyStampGrid
  // Restore real pattern style — legacy "STAMP_GRID" becomes "NONE"
  const realPatternStyle = isLegacyStampGrid ? "NONE" : (cardDesign?.patternStyle ?? "NONE")
  const walletData = cardDesign
    ? {
        shape: cardDesign.shape as string,
        primaryColor: cardDesign.primaryColor ?? "#1a1a2e",
        secondaryColor: cardDesign.secondaryColor ?? "#ffffff",
        textColor: cardDesign.textColor ?? "#ffffff",
        patternStyle: realPatternStyle as string,
        progressStyle: cardDesign.progressStyle as string,
        fontFamily: cardDesign.fontFamily as string,
        labelFormat: cardDesign.labelFormat as string,
        customProgressLabel: cardDesign.customProgressLabel ?? "",
        palettePreset: cardDesign.palettePreset ?? null,
        templateId: cardDesign.templateId ?? null,
        stripImageUrl: cardDesign.stripImageUrl ?? null,
        stripImageApple: cardDesign.stripImageApple ?? null,
        stripImageGoogle: cardDesign.stripImageGoogle ?? null,
        stripOpacity: stripFilters.stripOpacity,
        stripGrayscale: stripFilters.stripGrayscale,
        stripColor1: stripFilters.stripColor1,
        stripColor2: stripFilters.stripColor2,
        stripFill: stripFilters.stripFill,
        patternColor: stripFilters.patternColor,
        stripImagePosition: stripFilters.stripImagePosition,
        stripImageZoom: stripFilters.stripImageZoom,
        useStampGrid,
        generatedStripApple: cardDesign.generatedStripApple ?? null,
        generatedStripGoogle: cardDesign.generatedStripGoogle ?? null,
        businessHours: cardDesign.businessHours ?? "",
        mapAddress: cardDesign.mapAddress ?? "",
        mapLatitude: cardDesign.mapLatitude ?? null,
        mapLongitude: cardDesign.mapLongitude ?? null,
        socialLinks: (cardDesign.socialLinks as Record<string, string>) ?? {},
        customMessage: cardDesign.customMessage ?? "",
        cardType: cardDesign.cardType as string,
        stampGridConfig: parseStampGridConfig(cardDesign.editorConfig),
      }
    : null

  return (
    <StudioLayout
      programId={programId}
      programName={program.name}
      programType={program.programType}
      programConfig={program.config}
      restaurantName={restaurant.name}
      restaurantLogo={restaurant.logo}
      restaurantLogoApple={restaurant.logoApple}
      restaurantLogoGoogle={restaurant.logoGoogle}
      restaurantId={restaurant.id}
      visitsRequired={program.visitsRequired}
      rewardDescription={program.rewardDescription}
      walletData={walletData}
      walletPassCount={walletPassCount}
    />
  )
}

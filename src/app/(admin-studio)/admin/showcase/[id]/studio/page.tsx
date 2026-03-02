import { connection } from "next/server"
import { notFound } from "next/navigation"
import { assertSuperAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { ShowcaseStudioLayout } from "@/components/admin/showcase/showcase-studio-layout"

export default async function ShowcaseStudioPage(props: {
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id } = await props.params
  await assertSuperAdmin()

  const card = await db.showcaseCard.findUnique({ where: { id } })
  if (!card) notFound()

  const designData = (card.designData ?? {}) as Record<string, unknown>
  const metadata = (card.metadata ?? {}) as Record<string, unknown>
  const editorConfig = (designData.editorConfig ?? {}) as Record<string, unknown>

  // Build walletData shape matching what StudioLayout expects
  const walletData = {
    showStrip: (designData.showStrip as boolean) ?? true,
    primaryColor: (designData.primaryColor as string) ?? "#1a1a2e",
    secondaryColor: (designData.secondaryColor as string) ?? "#ffffff",
    textColor: (designData.textColor as string) ?? "#ffffff",
    patternStyle: (designData.patternStyle as string) ?? "NONE",
    progressStyle: (designData.progressStyle as string) ?? "NUMBERS",
    fontFamily: (designData.fontFamily as string) ?? "SANS",
    labelFormat: (designData.labelFormat as string) ?? "UPPERCASE",
    customProgressLabel: (designData.customProgressLabel as string) ?? "",
    palettePreset: (designData.palettePreset as string) ?? null,
    templateId: (designData.templateId as string) ?? null,
    stripImageUrl: (designData.stripImageUrl as string) ?? null,
    stripImageApple: (designData.stripImageApple as string) ?? null,
    stripImageGoogle: (designData.stripImageGoogle as string) ?? null,
    stripOpacity: (editorConfig.stripOpacity as number) ?? 1,
    stripGrayscale: (editorConfig.stripGrayscale as boolean) ?? false,
    stripColor1: (editorConfig.stripColor1 as string) ?? null,
    stripColor2: (editorConfig.stripColor2 as string) ?? null,
    stripFill: (editorConfig.stripFill as string) ?? "gradient",
    patternColor: (editorConfig.patternColor as string) ?? null,
    stripImagePosition: (editorConfig.stripImagePosition as { x: number; y: number }) ?? { x: 0.5, y: 0.5 },
    stripImageZoom: (editorConfig.stripImageZoom as number) ?? 1,
    useStampGrid: (editorConfig.useStampGrid as boolean) ?? false,
    stampGridConfig: (editorConfig.stampGridConfig as Record<string, unknown>) ?? undefined,
    generatedStripApple: (designData.generatedStripApple as string) ?? null,
    generatedStripGoogle: (designData.generatedStripGoogle as string) ?? null,
    cardType: (designData.cardType as string) ?? "STAMP",
  }

  return (
    <ShowcaseStudioLayout
      showcaseCardId={id}
      restaurantName={(metadata.restaurantName as string) ?? "Restaurant"}
      visitsRequired={(metadata.totalVisits as number) ?? 10}
      rewardDescription={(metadata.rewardDescription as string) ?? "Free reward"}
      walletData={walletData}
    />
  )
}

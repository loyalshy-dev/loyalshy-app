import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseStampGridConfig, parseStripFilters } from "@/lib/wallet/card-design"
import {
  generateStampGridImage,
  GOOGLE_HERO_WIDTH,
  GOOGLE_HERO_HEIGHT,
} from "@/lib/wallet/strip-image"

/**
 * Dynamic stamp grid strip image endpoint.
 * Returns a PNG image of the stamp grid for a given pass instance.
 * Used by Google Wallet hero images — no auth needed (opaque UUIDv7 URL).
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ passInstanceId: string }> }
) {
  const { passInstanceId } = await props.params

  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    select: {
      data: true,
      passTemplate: {
        select: {
          config: true,
          passDesign: {
            select: {
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              patternStyle: true,
              editorConfig: true,
              stripImageGoogle: true,
            },
          },
        },
      },
      rewards: {
        where: { status: "AVAILABLE" },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!passInstance) {
    return new NextResponse(null, { status: 404 })
  }

  const passDesign = passInstance.passTemplate.passDesign
  const stripFilters = parseStripFilters(passDesign?.editorConfig)
  const isStampGrid = stripFilters.useStampGrid || passDesign?.patternStyle === "STAMP_GRID"
  if (!passDesign || !isStampGrid) {
    return new NextResponse(null, { status: 404 })
  }

  // Extract data from the PassInstance.data JSON
  const instanceData = (passInstance.data ?? {}) as Record<string, unknown>
  const currentCycleVisits = (instanceData.currentCycleVisits as number) ?? 0

  // Extract config values from PassTemplate.config JSON
  const templateConfig = (passInstance.passTemplate.config ?? {}) as Record<string, unknown>
  const visitsRequired = (templateConfig.stampsRequired as number) ?? 10

  const config = parseStampGridConfig(passDesign.editorConfig)
  const hasReward = passInstance.rewards.length > 0

  // Use strip-specific colors (fall back to card colors)
  const stripPrimary = stripFilters.stripColor1 ?? passDesign.primaryColor ?? "#1a1a2e"
  const stripSecondary = stripFilters.stripColor2 ?? passDesign.secondaryColor ?? "#ffffff"

  const buffer = await generateStampGridImage({
    currentVisits: currentCycleVisits,
    totalVisits: visitsRequired,
    hasReward,
    config,
    primaryColor: stripPrimary,
    secondaryColor: stripSecondary,
    textColor: passDesign.textColor ?? "#ffffff",
    width: GOOGLE_HERO_WIDTH,
    height: GOOGLE_HERO_HEIGHT,
    stripImageUrl: passDesign.stripImageGoogle,
    stripOpacity: stripFilters.stripOpacity,
    stripGrayscale: stripFilters.stripGrayscale,
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
    },
  })
}

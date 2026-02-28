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
 * Returns a PNG image of the stamp grid for a given enrollment.
 * Used by Google Wallet hero images — no auth needed (opaque UUIDv7 URL).
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await props.params

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      currentCycleVisits: true,
      loyaltyProgram: {
        select: {
          visitsRequired: true,
          cardDesign: {
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

  if (!enrollment) {
    return new NextResponse(null, { status: 404 })
  }

  const cardDesign = enrollment.loyaltyProgram.cardDesign
  const stripFilters = parseStripFilters(cardDesign?.editorConfig)
  const isStampGrid = stripFilters.useStampGrid || cardDesign?.patternStyle === "STAMP_GRID"
  if (!cardDesign || !isStampGrid) {
    return new NextResponse(null, { status: 404 })
  }

  const config = parseStampGridConfig(cardDesign.editorConfig)
  const hasReward = enrollment.rewards.length > 0

  // Use strip-specific colors (fall back to card colors)
  const stripPrimary = stripFilters.stripColor1 ?? cardDesign.primaryColor ?? "#1a1a2e"
  const stripSecondary = stripFilters.stripColor2 ?? cardDesign.secondaryColor ?? "#ffffff"

  const buffer = await generateStampGridImage({
    currentVisits: enrollment.currentCycleVisits,
    totalVisits: enrollment.loyaltyProgram.visitsRequired,
    hasReward,
    config,
    primaryColor: stripPrimary,
    secondaryColor: stripSecondary,
    textColor: cardDesign.textColor ?? "#ffffff",
    width: GOOGLE_HERO_WIDTH,
    height: GOOGLE_HERO_HEIGHT,
    stripImageUrl: cardDesign.stripImageGoogle,
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

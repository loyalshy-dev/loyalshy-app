import { parseStripFilters, parseStampGridConfig } from "@/lib/wallet/card-design"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"
import type { PublicProgramInfo } from "@/types/enrollment"

/**
 * Build a WalletPassDesign from a PublicProgramInfo's cardDesign.
 * Extracts duplicated logic that was previously inline in onboarding-form.tsx.
 */
export function buildWalletPassDesign(
  cardDesign: PublicProgramInfo["cardDesign"]
): WalletPassDesign {
  const sf = cardDesign
    ? parseStripFilters(cardDesign.editorConfig)
    : {
        useStampGrid: false,
        stripColor1: null,
        stripColor2: null,
        stripFill: "gradient" as const,
        patternColor: null,
        stripImagePosition: { x: 0.5, y: 0.5 },
        stripImageZoom: 1,
      }
  const useStampGrid =
    sf.useStampGrid || cardDesign?.patternStyle === "STAMP_GRID"

  return {
    cardType: (cardDesign?.cardType ?? "STAMP") as WalletPassDesign["cardType"],
    showStrip: cardDesign?.showStrip ?? true,
    primaryColor: cardDesign?.primaryColor ?? "#1a1a2e",
    secondaryColor: cardDesign?.secondaryColor ?? "#ffffff",
    textColor: cardDesign?.textColor ?? "#ffffff",
    progressStyle: (cardDesign?.progressStyle ??
      "NUMBERS") as WalletPassDesign["progressStyle"],
    labelFormat: (cardDesign?.labelFormat ??
      "UPPERCASE") as WalletPassDesign["labelFormat"],
    customProgressLabel: cardDesign?.customProgressLabel ?? null,
    stripImageUrl: cardDesign?.stripImageUrl ?? null,
    patternStyle: (cardDesign?.patternStyle === "STAMP_GRID"
      ? "NONE"
      : (cardDesign?.patternStyle ?? "NONE")) as WalletPassDesign["patternStyle"],
    useStampGrid,
    stripColor1: sf.stripColor1 ?? null,
    stripColor2: sf.stripColor2 ?? null,
    stripFill: sf.stripFill ?? "gradient",
    patternColor: sf.patternColor ?? null,
    stripImagePosition: sf.stripImagePosition,
    stripImageZoom: sf.stripImageZoom,
    stampGridConfig: useStampGrid
      ? parseStampGridConfig(cardDesign!.editorConfig)
      : undefined,
  }
}

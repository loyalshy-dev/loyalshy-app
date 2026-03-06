import { parseStripFilters, parseStampGridConfig } from "@/lib/wallet/card-design"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"
import type { PublicTemplateInfo } from "@/types/pass-instance"

/**
 * Build a WalletPassDesign from a PublicTemplateInfo's passDesign.
 * Extracts duplicated logic that was previously inline in onboarding-form.tsx.
 */
export function buildWalletPassDesign(
  passDesign: PublicTemplateInfo["passDesign"]
): WalletPassDesign {
  const sf = passDesign
    ? parseStripFilters(passDesign.editorConfig)
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
    sf.useStampGrid || passDesign?.patternStyle === "STAMP_GRID"

  return {
    cardType: (passDesign?.cardType ?? "STAMP") as WalletPassDesign["cardType"],
    showStrip: passDesign?.showStrip ?? true,
    primaryColor: passDesign?.primaryColor ?? "#1a1a2e",
    secondaryColor: passDesign?.secondaryColor ?? "#ffffff",
    textColor: passDesign?.textColor ?? "#ffffff",
    progressStyle: (passDesign?.progressStyle ??
      "NUMBERS") as WalletPassDesign["progressStyle"],
    labelFormat: (passDesign?.labelFormat ??
      "UPPERCASE") as WalletPassDesign["labelFormat"],
    customProgressLabel: passDesign?.customProgressLabel ?? null,
    stripImageUrl: passDesign?.stripImageUrl ?? null,
    patternStyle: (passDesign?.patternStyle === "STAMP_GRID"
      ? "NONE"
      : (passDesign?.patternStyle ?? "NONE")) as WalletPassDesign["patternStyle"],
    useStampGrid,
    stripColor1: sf.stripColor1 ?? null,
    stripColor2: sf.stripColor2 ?? null,
    stripFill: sf.stripFill ?? "gradient",
    patternColor: sf.patternColor ?? null,
    stripImagePosition: sf.stripImagePosition,
    stripImageZoom: sf.stripImageZoom,
    stampGridConfig: useStampGrid
      ? parseStampGridConfig(passDesign!.editorConfig)
      : undefined,
  }
}

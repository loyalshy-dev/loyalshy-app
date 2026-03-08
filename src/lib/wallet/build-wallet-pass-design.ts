import { parseStripFilters, parseStampGridConfig } from "@/lib/wallet/card-design"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"

/**
 * Minimal pass design shape accepted by this builder.
 * All dashboard types (TemplateListItem, PublicTemplateInfo, PassInstanceDetail, etc.)
 * satisfy this interface — no need for per-surface inline design construction.
 */
type PassDesignInput = {
  cardType?: string | null
  showStrip?: boolean
  primaryColor?: string | null
  secondaryColor?: string | null
  textColor?: string | null
  patternStyle?: string | null
  progressStyle?: string | null
  fontFamily?: string | null
  labelFormat?: string | null
  customProgressLabel?: string | null
  stripImageUrl?: string | null
  editorConfig?: unknown
} | null

/**
 * Build a WalletPassDesign from any pass design record.
 * Single source of truth — used by studio, dashboard, distribution, and public pages.
 */
export function buildWalletPassDesign(
  passDesign: PassDesignInput
): WalletPassDesign {
  const sf = passDesign
    ? parseStripFilters(passDesign.editorConfig)
    : parseStripFilters(null)

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
    stripOpacity: sf.stripOpacity,
    stripGrayscale: sf.stripGrayscale,
    stripColor1: sf.stripColor1 ?? null,
    stripColor2: sf.stripColor2 ?? null,
    stripFill: sf.stripFill ?? "gradient",
    patternColor: sf.patternColor ?? null,
    stripImagePosition: sf.stripImagePosition,
    stripImageZoom: sf.stripImageZoom,
    logoAppleZoom: sf.logoAppleZoom,
    logoGoogleZoom: sf.logoGoogleZoom,
    stampGridConfig: useStampGrid && passDesign
      ? parseStampGridConfig(passDesign.editorConfig)
      : undefined,
    stampFilledColor: sf.stampFilledColor ?? null,
    labelColor: sf.labelColor ?? null,
    headerFields: sf.headerFields ?? null,
    secondaryFields: sf.secondaryFields ?? null,
  }
}

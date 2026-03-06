import { CARD_TEMPLATES, type CardTemplate, type BusinessCategory } from "./card-templates"
import type { ExtractedPalette } from "@/lib/color-extraction"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"
import { computeTextColor } from "./card-design"
import type { StampGridConfig } from "./card-design"

// ─── Category → Stamp Icon Mapping ──────────────────────────

const CATEGORY_STAMP_ICONS: Record<BusinessCategory, string> = {
  cafe: "coffee",
  "fine-dining": "utensils-crossed",
  casual: "pizza",
  bar: "wine",
  bakery: "cookie",
  general: "heart",
}

const CATEGORY_REWARD_ICONS: Record<BusinessCategory, string> = {
  cafe: "reward-star",
  "fine-dining": "crown",
  casual: "gift",
  bar: "trophy",
  bakery: "gift",
  general: "gift",
}

// ─── Types ──────────────────────────────────────────────────

export type TemplateMatch = {
  template: CardTemplate
  score: number
}

// ─── Color Distance (CIE76 inline, client-safe) ────────────

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rr = r / 255
  let gg = g / 255
  let bb = b / 255
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92
  let x = (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) / 0.95047
  let y = rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750
  let z = (rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  x = f(x)
  y = f(y)
  z = f(z)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "")
  return [
    parseInt(cleaned.substring(0, 2), 16),
    parseInt(cleaned.substring(2, 4), 16),
    parseInt(cleaned.substring(4, 6), 16),
  ]
}

function deltaE(hex1: string, hex2: string): number {
  const lab1 = rgbToLab(...hexToRgb(hex1))
  const lab2 = rgbToLab(...hexToRgb(hex2))
  return Math.sqrt(
    (lab1[0] - lab2[0]) ** 2 +
    (lab1[1] - lab2[1]) ** 2 +
    (lab1[2] - lab2[2]) ** 2
  )
}

// ─── Dark/Neutral Palette IDs ───────────────────────────────

const DARK_NEUTRAL_PRESETS = new Set(["slate", "charcoal", "midnight"])
const DARK_NEUTRAL_TEMPLATES = new Set([
  "general-slate", "cafe-minimal", "fine-noir", "points-sleek-track", "points-zen-flow",
])

// ─── Template Matching ──────────────────────────────────────

/**
 * Score and rank templates against a palette + category.
 * Client-safe — no server imports.
 */
export function matchTemplates(
  palette: ExtractedPalette | null,
  category: BusinessCategory | null,
  limit: number = 4
): TemplateMatch[] {
  const scored: TemplateMatch[] = CARD_TEMPLATES.map((template) => {
    let score = 0

    // Category bonus: +40 if template matches user's category (or "general")
    if (category) {
      if (template.category === category) {
        score += 40
      } else if (template.category === "general") {
        score += 20
      }
    }

    // Color distance scoring
    if (palette && palette.colors.length > 0) {
      const paletteHexes = palette.colors.slice(0, 5).map((c) => c.hex)

      // Find min distance from template primary to any palette color
      const primaryDistances = paletteHexes.map((ph) =>
        deltaE(template.design.primaryColor, ph)
      )
      const minPrimaryDist = Math.min(...primaryDistances)

      // Find min distance from template secondary to any palette color
      const secondaryDistances = paletteHexes.map((ph) =>
        deltaE(template.design.secondaryColor, ph)
      )
      const minSecondaryDist = Math.min(...secondaryDistances)

      // Average distance, lower is better
      const avgDist = (minPrimaryDist + minSecondaryDist) / 2

      // Normalize: 0 distance = 60 points, 100+ distance = 0 points
      const colorScore = Math.max(0, 60 - (avgDist / 100) * 60)
      score += colorScore

      // Monochrome bonus for dark/neutral templates
      if (palette.isMonochrome) {
        if (
          DARK_NEUTRAL_PRESETS.has(template.design.palettePreset ?? "") ||
          DARK_NEUTRAL_TEMPLATES.has(template.id)
        ) {
          score += 20
        }
      }
    } else {
      // No palette (vibe-only): flat color score for all
      score += 30
    }

    return { template, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit)
}

// ─── Apply Palette to Template ──────────────────────────────

/**
 * Create a WalletPassDesign by merging template structure with palette colors.
 * If no palette, keeps template's original colors.
 * If category is provided and the template uses a stamp grid, overrides the
 * stamp icon to match the user's chosen business vibe.
 */
export function applyPaletteToTemplate(
  template: CardTemplate,
  palette: ExtractedPalette | null,
  category?: BusinessCategory | null
): WalletPassDesign {
  const d = template.design

  const primaryColor = palette?.primarySuggestion ?? d.primaryColor
  const secondaryColor = palette?.secondarySuggestion ?? d.secondaryColor
  // Recompute text color against the final primary to ensure WCAG contrast
  const textColor = palette ? computeTextColor(primaryColor) : d.textColor

  // Override stamp icons to match user's vibe when brand-matching
  let stampGridConfig: StampGridConfig | undefined = d.stampGridConfig
  if (d.useStampGrid && d.stampGridConfig && category) {
    stampGridConfig = {
      ...d.stampGridConfig,
      stampIcon: CATEGORY_STAMP_ICONS[category],
      rewardIcon: CATEGORY_REWARD_ICONS[category],
    }
  }

  return {
    cardType: d.cardType,
    showStrip: d.showStrip,
    primaryColor,
    secondaryColor,
    textColor,
    progressStyle: d.progressStyle,
    labelFormat: d.labelFormat,
    customProgressLabel: null,
    stripImageUrl: null,
    patternStyle: d.patternStyle,
    stripColor1: d.stripColor1 ?? null,
    stripColor2: d.stripColor2 ?? null,
    stripFill: d.stripFill ?? "gradient",
    patternColor: d.patternColor ?? null,
    useStampGrid: d.useStampGrid,
    stampGridConfig,
  }
}


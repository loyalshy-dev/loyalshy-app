import crypto from "crypto"

// ─── Types ──────────────────────────────────────────────────

export type CardShape = "CLEAN" | "SHOWCASE" | "INFO_RICH"
export type PatternStyle = "NONE" | "DOTS" | "WAVES" | "GEOMETRIC" | "CHEVRON" | "CROSSHATCH" | "DIAMONDS" | "CONFETTI" | "SOLID_PRIMARY" | "SOLID_SECONDARY"
export type ProgressStyle = "NUMBERS" | "CIRCLES" | "SQUARES" | "STARS" | "STAMPS" | "PERCENTAGE" | "REMAINING"
export type FontFamily = "SANS" | "SERIF" | "ROUNDED" | "MONO"
export type LabelFormat = "UPPERCASE" | "TITLE_CASE" | "LOWERCASE"

export type SocialLinks = {
  instagram?: string
  facebook?: string
  tiktok?: string
  x?: string
}

export type CardDesignData = {
  shape: CardShape
  primaryColor: string
  secondaryColor: string
  textColor: string
  stripImageUrl: string | null
  stripImageApple: string | null
  stripImageGoogle: string | null
  patternStyle: PatternStyle
  progressStyle: ProgressStyle
  fontFamily: FontFamily
  labelFormat: LabelFormat
  customProgressLabel: string | null
  generatedStripApple: string | null
  generatedStripGoogle: string | null
  palettePreset: string | null
  templateId: string | null
  businessHours: string | null
  mapAddress: string | null
  socialLinks: SocialLinks
  customMessage: string | null
  designHash: string
}

export type CardDesignRow = {
  shape: string
  primaryColor: string | null
  secondaryColor: string | null
  textColor: string | null
  stripImageUrl: string | null
  stripImageApple: string | null
  stripImageGoogle: string | null
  patternStyle: string
  progressStyle: string
  fontFamily: string
  labelFormat: string
  customProgressLabel: string | null
  generatedStripApple: string | null
  generatedStripGoogle: string | null
  palettePreset: string | null
  templateId: string | null
  businessHours: string | null
  mapAddress: string | null
  socialLinks: unknown
  customMessage: string | null
  designHash: string
}

// ─── Palette Presets ────────────────────────────────────────

export type PalettePreset = {
  id: string
  name: string
  primary: string
  secondary: string
  text: string
}

export const PALETTE_PRESETS: PalettePreset[] = [
  { id: "midnight", name: "Midnight", primary: "#1a1a2e", secondary: "#4a4a8a", text: "#ffffff" },
  { id: "forest", name: "Forest", primary: "#1b4332", secondary: "#52b788", text: "#ffffff" },
  { id: "coral", name: "Coral", primary: "#e63946", secondary: "#f1a7a0", text: "#ffffff" },
  { id: "ocean", name: "Ocean", primary: "#023e8a", secondary: "#48cae4", text: "#ffffff" },
  { id: "espresso", name: "Espresso", primary: "#3e2723", secondary: "#a1887f", text: "#ffffff" },
  { id: "lavender", name: "Lavender", primary: "#4a148c", secondary: "#ce93d8", text: "#ffffff" },
  { id: "slate", name: "Slate", primary: "#334155", secondary: "#94a3b8", text: "#ffffff" },
  { id: "sunset", name: "Sunset", primary: "#c2185b", secondary: "#f48fb1", text: "#ffffff" },
  { id: "mint", name: "Mint", primary: "#004d40", secondary: "#80cbc4", text: "#ffffff" },
  { id: "charcoal", name: "Charcoal", primary: "#212121", secondary: "#757575", text: "#ffffff" },
]

// ─── Color Utilities ────────────────────────────────────────

/** Compute WCAG relative luminance from hex color */
function relativeLuminance(hex: string): number {
  const cleaned = hex.replace("#", "")
  const r = parseInt(cleaned.substring(0, 2), 16) / 255
  const g = parseInt(cleaned.substring(2, 4), 16) / 255
  const b = parseInt(cleaned.substring(4, 6), 16) / 255

  const sR = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
  const sG = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
  const sB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)

  return 0.2126 * sR + 0.7152 * sG + 0.0722 * sB
}

/** Returns #ffffff or #1a1a1a based on WCAG contrast with the background */
export function computeTextColor(hexBg: string): string {
  const lum = relativeLuminance(hexBg)
  return lum > 0.179 ? "#1a1a1a" : "#ffffff"
}

// ─── Progress & Label Formatters ────────────────────────────

/**
 * Format progress display for wallet passes and web.
 * Unicode characters are supported in Apple/Google Wallet text fields.
 */
export function formatProgressValue(
  current: number,
  total: number,
  style: ProgressStyle,
  hasReward: boolean,
  rewardLabel?: string
): string {
  if (hasReward) return rewardLabel ?? "Reward Available!"

  switch (style) {
    case "CIRCLES":
      return "●".repeat(current) + "○".repeat(Math.max(0, total - current))
    case "SQUARES":
      return "■".repeat(current) + "□".repeat(Math.max(0, total - current))
    case "STARS":
      return "★".repeat(current) + "☆".repeat(Math.max(0, total - current))
    case "STAMPS":
      return "◉".repeat(current) + "◎".repeat(Math.max(0, total - current))
    case "PERCENTAGE":
      return `${total > 0 ? Math.round((current / total) * 100) : 0}%`
    case "REMAINING": {
      const remaining = Math.max(0, total - current)
      return remaining === 1
        ? "1 more visit to go!"
        : `${remaining} more visits to go!`
    }
    case "NUMBERS":
    default:
      return `${current} / ${total} Visits`
  }
}

/** Format a label string according to the chosen label format */
export function formatLabel(label: string, format: LabelFormat): string {
  switch (format) {
    case "LOWERCASE":
      return label.toLowerCase()
    case "TITLE_CASE":
      return label
        .toLowerCase()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    case "UPPERCASE":
    default:
      return label.toUpperCase()
  }
}

// ─── Design Hash ────────────────────────────────────────────

/** Compute a SHA-256 hash of design-relevant fields, truncated to 16 chars */
export function computeDesignHash(design: {
  shape: string
  primaryColor: string | null
  secondaryColor: string | null
  textColor: string | null
  stripImageApple: string | null
  stripImageGoogle: string | null
  patternStyle: string
  progressStyle?: string
  fontFamily?: string
  labelFormat?: string
  customProgressLabel?: string | null
  generatedStripApple: string | null
  generatedStripGoogle: string | null
  businessHours: string | null
  mapAddress: string | null
  socialLinks: unknown
  customMessage: string | null
}): string {
  const payload = JSON.stringify({
    s: design.shape,
    p: design.primaryColor,
    sc: design.secondaryColor,
    t: design.textColor,
    si: design.stripImageApple,
    sig: design.stripImageGoogle,
    ps: design.patternStyle,
    prs: design.progressStyle ?? "NUMBERS",
    ff: design.fontFamily ?? "SANS",
    lf: design.labelFormat ?? "UPPERCASE",
    cpl: design.customProgressLabel ?? null,
    ga: design.generatedStripApple,
    gg: design.generatedStripGoogle,
    bh: design.businessHours,
    ma: design.mapAddress,
    sl: design.socialLinks,
    cm: design.customMessage,
  })
  return crypto.createHash("sha256").update(payload).digest("hex").substring(0, 16)
}

// ─── Resolve Design ─────────────────────────────────────────

/**
 * Merges a DB CardDesign row + restaurant fallbacks into a resolved CardDesignData.
 * The caller passes program-level cardDesign and restaurant-level color fallbacks.
 */
export function resolveCardDesign(
  cardDesign: CardDesignRow | null,
  restaurant: { brandColor: string | null; secondaryColor: string | null }
): CardDesignData {
  const primary = cardDesign?.primaryColor ?? restaurant.brandColor ?? "#1a1a2e"
  const secondary = cardDesign?.secondaryColor ?? restaurant.secondaryColor ?? "#ffffff"
  const text = cardDesign?.textColor ?? computeTextColor(primary)

  return {
    shape: (cardDesign?.shape as CardShape) ?? "CLEAN",
    primaryColor: primary,
    secondaryColor: secondary,
    textColor: text,
    stripImageUrl: cardDesign?.stripImageUrl ?? null,
    stripImageApple: cardDesign?.stripImageApple ?? null,
    stripImageGoogle: cardDesign?.stripImageGoogle ?? null,
    patternStyle: (cardDesign?.patternStyle as PatternStyle) ?? "NONE",
    progressStyle: (cardDesign?.progressStyle as ProgressStyle) ?? "NUMBERS",
    fontFamily: (cardDesign?.fontFamily as FontFamily) ?? "SANS",
    labelFormat: (cardDesign?.labelFormat as LabelFormat) ?? "UPPERCASE",
    customProgressLabel: cardDesign?.customProgressLabel ?? null,
    generatedStripApple: cardDesign?.generatedStripApple ?? null,
    generatedStripGoogle: cardDesign?.generatedStripGoogle ?? null,
    palettePreset: cardDesign?.palettePreset ?? null,
    templateId: cardDesign?.templateId ?? null,
    businessHours: cardDesign?.businessHours ?? null,
    mapAddress: cardDesign?.mapAddress ?? null,
    socialLinks: parseSocialLinks(cardDesign?.socialLinks),
    customMessage: cardDesign?.customMessage ?? null,
    designHash: cardDesign?.designHash ?? "",
  }
}

function parseSocialLinks(raw: unknown): SocialLinks {
  if (!raw || typeof raw !== "object") return {}
  const obj = raw as Record<string, unknown>
  return {
    instagram: typeof obj.instagram === "string" ? obj.instagram : undefined,
    facebook: typeof obj.facebook === "string" ? obj.facebook : undefined,
    tiktok: typeof obj.tiktok === "string" ? obj.tiktok : undefined,
    x: typeof obj.x === "string" ? obj.x : undefined,
  }
}

// ─── Field Layouts ──────────────────────────────────────────

export type PassFieldLayout = {
  apple: {
    header: string[]
    primary: string[]
    secondary: string[]
    auxiliary: string[]
    useStrip: boolean
  }
  google: {
    rows: number
    showHeroImage: boolean
    fields: string[]
  }
}

/**
 * Returns the field layout for a given card shape.
 * Determines which fields appear where on Apple/Google passes.
 *
 * CLEAN: No strip. Primary = progress. Secondary = reward + visits. Auxiliary = member since + name.
 * SHOWCASE: Strip dominates. Primary = progress (overlaid). Secondary = reward only. Fewer fields visible.
 * INFO_RICH: Optional strip. More fields. Header = restaurant + member #. Primary = progress. Secondary = reward + visits + member since. Auxiliary = name.
 */
export function getFieldLayout(shape: CardShape): PassFieldLayout {
  switch (shape) {
    case "SHOWCASE":
      return {
        apple: {
          header: ["restaurant"],
          primary: ["progress"],
          secondary: ["nextReward"],
          auxiliary: ["customerName"],
          useStrip: true,
        },
        google: {
          rows: 1,
          showHeroImage: true,
          fields: ["progress", "nextReward", "customerName"],
        },
      }
    case "INFO_RICH":
      return {
        apple: {
          header: ["restaurant", "memberNumber"],
          primary: ["progress"],
          secondary: ["nextReward", "totalVisits", "memberSince"],
          auxiliary: ["customerName"],
          useStrip: true,
        },
        google: {
          rows: 3,
          showHeroImage: true,
          fields: ["progress", "totalVisits", "nextReward", "memberSince", "customerName"],
        },
      }
    case "CLEAN":
    default:
      return {
        apple: {
          header: ["restaurant"],
          primary: ["progress"],
          secondary: ["nextReward", "totalVisits"],
          auxiliary: ["memberSince", "customerName"],
          useStrip: false,
        },
        google: {
          rows: 2,
          showHeroImage: false,
          fields: ["progress", "totalVisits", "nextReward", "memberSince", "customerName"],
        },
      }
  }
}

import crypto from "crypto"

// ─── Types ──────────────────────────────────────────────────

export type CardType = "STAMP" | "POINTS" | "TIER" | "COUPON" | "PREPAID" | "GIFT_CARD" | "TICKET" | "ACCESS" | "TRANSIT" | "BUSINESS_ID" | "GENERIC"
export type PatternStyle = "NONE" | "DOTS" | "WAVES" | "GEOMETRIC" | "CHEVRON" | "CROSSHATCH" | "DIAMONDS" | "CONFETTI" | "SOLID_PRIMARY" | "SOLID_SECONDARY" | "STAMP_GRID"
export type ProgressStyle = "NUMBERS" | "CIRCLES" | "SQUARES" | "STARS" | "STAMPS" | "PERCENTAGE" | "REMAINING"
export type FontFamily = "SANS" | "SERIF" | "ROUNDED" | "MONO"
export type LabelFormat = "UPPERCASE" | "TITLE_CASE" | "LOWERCASE"

export type SocialLinks = {
  instagram?: string
  facebook?: string
  tiktok?: string
  x?: string
}

// ─── Stamp Grid Config ─────────────────────────────────────

export type StampGridConfig = {
  stampIcon: string      // Lucide icon ID (e.g. "coffee", "pizza")
  customStampIconUrl: string | null  // uploaded custom icon for filled stamps
  rewardIcon: string     // Lucide icon ID for the reward slot
  customRewardIconUrl: string | null // uploaded custom icon for the reward slot
  customEmptyIconUrl: string | null  // uploaded custom icon for empty/unstamped slots
  useUniformIcon: boolean // use same icon for all slots (filled, empty, reward)
  stampShape: "circle" | "rounded-square" | "square"
  filledStyle: "icon" | "icon-with-border" | "solid"
  stampIconScale: number // 0.4–0.9, controls icon size within stamp slot (default 0.6)
  useStripBackground: boolean  // overlay grid on strip image instead of gradient
  emptyNumberColor: string | null // color for empty slot numbers (null = use textColor)
  emptyNumberScale: number // 0.2–0.6, controls number size within empty slot (default 0.35)
}

export const DEFAULT_STAMP_GRID_CONFIG: StampGridConfig = {
  stampIcon: "coffee",
  customStampIconUrl: null,
  rewardIcon: "gift",
  customRewardIconUrl: null,
  customEmptyIconUrl: null,
  useUniformIcon: false,
  stampShape: "circle",
  filledStyle: "icon",
  stampIconScale: 0.6,
  useStripBackground: false,
  emptyNumberColor: null,
  emptyNumberScale: 0.35,
}

/** Maps legacy raster filenames to Lucide icon IDs for backward compatibility */
const LEGACY_ICON_MAP: Record<string, string> = {
  "cafe.jpg": "coffee",
  "beer.jpg": "beer",
  "burger.jpg": "beef",
  "pizza.jpg": "pizza",
  "pizza.png": "pizza",
  "drink.jpg": "cup-soda",
  "chili.avif": "flame",
}

/** Parse strip image filter settings from editorConfig JSON */
export type StripFilters = {
  stripOpacity: number
  stripGrayscale: boolean
  useStampGrid: boolean
  stripColor1: string | null
  stripColor2: string | null
  stripFill: "flat" | "gradient"
  patternColor: string | null
  stripImagePosition: { x: number; y: number }
  stripImageZoom: number
  labelColor: string | null
  stampFilledColor: string | null  // stamp icon fill color (null = use stripColor2 ?? secondaryColor)
  headerFields: string[] | null   // custom header fields (null = use default)
  secondaryFields: string[] | null // custom secondary/detail fields (null = use default)
}

/** Available fields for STAMP/POINTS card type field customization */
export const STAMP_CARD_AVAILABLE_FIELDS = [
  { id: "organization", label: "Organization" },
  { id: "memberNumber", label: "Member #" },
  { id: "registeredAt", label: "Registered" },
  { id: "nextReward", label: "Next Reward" },
  { id: "totalVisits", label: "Total Visits" },
  { id: "memberSince", label: "Since" },
  { id: "customerName", label: "Name" },
] as const

export const DEFAULT_HEADER_FIELDS = ["memberNumber", "organization"]
export const DEFAULT_SECONDARY_FIELDS = ["nextReward", "totalVisits", "memberSince", "customerName"]

export function parseStripFilters(editorConfig: unknown): StripFilters {
  if (!editorConfig || typeof editorConfig !== "object") return { stripOpacity: 1, stripGrayscale: false, useStampGrid: false, stripColor1: null, stripColor2: null, stripFill: "gradient", patternColor: null, stripImagePosition: { x: 0.5, y: 0.5 }, stripImageZoom: 1, labelColor: null, stampFilledColor: null, headerFields: null, secondaryFields: null }
  const obj = editorConfig as Record<string, unknown>
  const rawPos = obj.stripImagePosition
  let posX = 0.5
  let posY = 0.5
  if (rawPos && typeof rawPos === "object") {
    const p = rawPos as Record<string, unknown>
    if (typeof p.x === "number") posX = Math.max(0, Math.min(1, p.x))
    if (typeof p.y === "number") posY = Math.max(0, Math.min(1, p.y))
  }
  const rawZoom = obj.stripImageZoom
  const zoom = typeof rawZoom === "number" ? Math.max(1, Math.min(3, rawZoom)) : 1
  return {
    stripOpacity: typeof obj.stripOpacity === "number" ? Math.max(0, Math.min(1, obj.stripOpacity)) : 1,
    stripGrayscale: typeof obj.stripGrayscale === "boolean" ? obj.stripGrayscale : false,
    useStampGrid: typeof obj.useStampGrid === "boolean" ? obj.useStampGrid : false,
    stripColor1: typeof obj.stripColor1 === "string" ? obj.stripColor1 : null,
    stripColor2: typeof obj.stripColor2 === "string" ? obj.stripColor2 : null,
    stripFill: obj.stripFill === "flat" ? "flat" : "gradient",
    patternColor: typeof obj.patternColor === "string" ? obj.patternColor : null,
    stripImagePosition: { x: posX, y: posY },
    stripImageZoom: zoom,
    labelColor: typeof obj.labelColor === "string" ? obj.labelColor : null,
    stampFilledColor: typeof obj.stampFilledColor === "string" ? obj.stampFilledColor : null,
    headerFields: Array.isArray(obj.headerFields) ? obj.headerFields.filter((f: unknown) => typeof f === "string") as string[] : null,
    secondaryFields: Array.isArray(obj.secondaryFields) ? obj.secondaryFields.filter((f: unknown) => typeof f === "string") as string[] : null,
  }
}

/** Parse StampGridConfig from editorConfig JSON, returning defaults for missing fields */
export function parseStampGridConfig(editorConfig: unknown): StampGridConfig {
  if (!editorConfig || typeof editorConfig !== "object") return { ...DEFAULT_STAMP_GRID_CONFIG }
  const obj = editorConfig as Record<string, unknown>
  const cfg = (obj.stampGridConfig ?? obj) as Record<string, unknown>

  const rawIcon = typeof cfg.stampIcon === "string" ? cfg.stampIcon : DEFAULT_STAMP_GRID_CONFIG.stampIcon
  const stampIcon = LEGACY_ICON_MAP[rawIcon] ?? rawIcon

  // Legacy emoji rewardIcon values (single/double char) → fall back to default icon ID
  const rawReward = typeof cfg.rewardIcon === "string" ? cfg.rewardIcon : DEFAULT_STAMP_GRID_CONFIG.rewardIcon
  const rewardIcon = rawReward.length <= 2 ? DEFAULT_STAMP_GRID_CONFIG.rewardIcon : rawReward

  return {
    stampIcon,
    customStampIconUrl: typeof cfg.customStampIconUrl === "string" ? cfg.customStampIconUrl : null,
    rewardIcon,
    customRewardIconUrl: typeof cfg.customRewardIconUrl === "string" ? cfg.customRewardIconUrl : null,
    customEmptyIconUrl: typeof cfg.customEmptyIconUrl === "string" ? cfg.customEmptyIconUrl : null,
    useUniformIcon: typeof cfg.useUniformIcon === "boolean" ? cfg.useUniformIcon : false,
    stampShape: (cfg.stampShape === "circle" || cfg.stampShape === "rounded-square" || cfg.stampShape === "square")
      ? cfg.stampShape
      : DEFAULT_STAMP_GRID_CONFIG.stampShape,
    filledStyle: (cfg.filledStyle === "icon" || cfg.filledStyle === "icon-with-border" || cfg.filledStyle === "solid")
      ? cfg.filledStyle
      : DEFAULT_STAMP_GRID_CONFIG.filledStyle,
    stampIconScale: typeof cfg.stampIconScale === "number"
      ? Math.max(0.4, Math.min(0.9, cfg.stampIconScale))
      : DEFAULT_STAMP_GRID_CONFIG.stampIconScale,
    useStripBackground: typeof cfg.useStripBackground === "boolean" ? cfg.useStripBackground : false,
    emptyNumberColor: typeof cfg.emptyNumberColor === "string" ? cfg.emptyNumberColor : null,
    emptyNumberScale: typeof cfg.emptyNumberScale === "number"
      ? Math.max(0.2, Math.min(0.6, cfg.emptyNumberScale))
      : DEFAULT_STAMP_GRID_CONFIG.emptyNumberScale,
  }
}

// ─── Card Design Data ──────────────────────────────────────

export type CardDesignData = {
  cardType: CardType
  showStrip: boolean
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
  mapLatitude: number | null
  mapLongitude: number | null
  socialLinks: SocialLinks
  customMessage: string | null
  designHash: string
  editorConfig: unknown
}

export type CardDesignRow = {
  cardType: string
  showStrip: boolean
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
  mapLatitude: number | null
  mapLongitude: number | null
  socialLinks: unknown
  customMessage: string | null
  designHash: string
  editorConfig: unknown
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

  const sR = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
  const sG = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
  const sB = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)

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

  // Symbol styles use a fixed 10-segment bar for consistent wallet pass rendering
  const SEGMENTS = 10
  const filled = total > 0 ? Math.round((current / total) * SEGMENTS) : 0
  const empty = SEGMENTS - filled

  switch (style) {
    case "CIRCLES":
      return "●".repeat(filled) + "○".repeat(empty)
    case "SQUARES":
      return "■".repeat(filled) + "□".repeat(empty)
    case "STARS":
      return "★".repeat(filled) + "☆".repeat(empty)
    case "STAMPS":
      return "◉".repeat(filled) + "◎".repeat(empty)
    case "PERCENTAGE":
      return `${total > 0 ? Math.round((current / total) * 100) : 0}%`
    case "REMAINING": {
      const remaining = Math.max(0, total - current)
      return remaining === 1 ? "1 visit left" : `${remaining} visits left`
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
  cardType?: string
  showStrip: boolean
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
  mapLatitude?: number | null
  mapLongitude?: number | null
  socialLinks: unknown
  customMessage: string | null
  editorConfig?: unknown
}): string {
  const payload = JSON.stringify({
    ct: design.cardType ?? "STAMP",
    ss: design.showStrip,
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
    mlat: design.mapLatitude ?? null,
    mlng: design.mapLongitude ?? null,
    sl: design.socialLinks,
    cm: design.customMessage,
    ec: design.editorConfig ?? null,
  })
  return crypto.createHash("sha256").update(payload).digest("hex").substring(0, 16)
}

// ─── Resolve Design ─────────────────────────────────────────

/**
 * Merges a DB PassDesign row + organization fallbacks into a resolved CardDesignData.
 * The caller passes template-level passDesign and organization-level color fallbacks.
 */
export function resolveCardDesign(
  cardDesign: CardDesignRow | null,
  organization: { brandColor: string | null; secondaryColor: string | null }
): CardDesignData {
  const primary = cardDesign?.primaryColor ?? organization.brandColor ?? "#1a1a2e"
  const secondary = cardDesign?.secondaryColor ?? organization.secondaryColor ?? "#ffffff"
  const text = cardDesign?.textColor ?? computeTextColor(primary)

  return {
    cardType: (cardDesign?.cardType as CardType) ?? "STAMP",
    showStrip: cardDesign?.showStrip ?? true,
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
    mapLatitude: cardDesign?.mapLatitude ?? null,
    mapLongitude: cardDesign?.mapLongitude ?? null,
    socialLinks: parseSocialLinks(cardDesign?.socialLinks),
    customMessage: cardDesign?.customMessage ?? null,
    designHash: cardDesign?.designHash ?? "",
    editorConfig: cardDesign?.editorConfig ?? {},
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
  }
  google: {
    rows: number
    fields: string[]
  }
}

/**
 * Returns the field layout for a given card type.
 * One fixed layout per card type (INFO_RICH base — shows all data).
 * Strip visibility is controlled separately via `showStrip` on CardDesign.
 *
 * STAMP/POINTS: header=organization+memberNumber, primary=progress, secondary=nextReward+totalVisits+memberSince, auxiliary=contactName
 * COUPON: header=organization, primary=discount, secondary=validUntil+couponCode+contactName
 * TIER: header=organization, primary=tierName, secondary=benefits+memberSince+contactName
 * PREPAID: header=organization, primary=remaining, secondary=prepaidValidUntil+totalUsed+contactName
 * GENERIC: header=organization, primary=title, secondary=description+contactName
 */
export function getFieldLayout(cardType?: CardType): PassFieldLayout {
  if (cardType === "COUPON") {
    return {
      apple: {
        header: ["organization"],
        primary: ["discount"],
        secondary: ["validUntil", "couponCode", "customerName"],
        auxiliary: [],
      },
      google: {
        rows: 1,
        fields: ["discount", "validUntil", "couponCode", "customerName"],
      },
    }
  }

  if (cardType === "TIER") {
    return {
      apple: {
        header: ["organization"],
        primary: ["tierName"],
        secondary: ["benefits", "memberSince", "customerName"],
        auxiliary: [],
      },
      google: {
        rows: 1,
        fields: ["tierName", "benefits", "memberSince", "customerName"],
      },
    }
  }

  if (cardType === "PREPAID") {
    return {
      apple: {
        header: ["organization"],
        primary: ["remaining"],
        secondary: ["prepaidValidUntil", "totalUsed", "customerName"],
        auxiliary: [],
      },
      google: {
        rows: 1,
        fields: ["remaining", "prepaidValidUntil", "totalUsed", "customerName"],
      },
    }
  }

  if (cardType === "GIFT_CARD") {
    return {
      apple: {
        header: ["organization"],
        primary: ["giftBalance"],
        secondary: ["giftInitial", "customerName"],
        auxiliary: [],
      },
      google: {
        rows: 1,
        fields: ["giftBalance", "giftInitial", "customerName"],
      },
    }
  }

  if (cardType === "TICKET") {
    return {
      apple: {
        header: ["scanStatus"],
        primary: ["eventName"],
        secondary: ["eventDate", "eventVenue", "customerName"],
        auxiliary: [],
      },
      google: {
        rows: 1,
        fields: ["eventDate", "eventVenue", "scanStatus", "customerName"],
      },
    }
  }

  if (cardType === "ACCESS") {
    return {
      apple: {
        header: ["accessGranted"],
        primary: ["accessLabel"],
        secondary: ["customerName", "memberSince"],
        auxiliary: [],
      },
      google: {
        rows: 1,
        fields: ["accessLabel", "accessGranted", "customerName", "memberSince"],
      },
    }
  }

  if (cardType === "TRANSIT") {
    return {
      apple: {
        header: ["boardingStatus"],
        primary: ["origin"],
        secondary: ["destination", "transitType"],
        auxiliary: ["customerName"],
      },
      google: {
        rows: 1,
        fields: ["origin", "destination", "transitType", "boardingStatus", "customerName"],
      },
    }
  }

  if (cardType === "BUSINESS_ID") {
    return {
      apple: {
        header: ["verifications"],
        primary: ["idLabel"],
        secondary: ["organization", "memberSince"],
        auxiliary: [],
      },
      google: {
        rows: 1,
        fields: ["idLabel", "verifications", "organization", "memberSince"],
      },
    }
  }

  if (cardType === "GENERIC") {
    return {
      apple: {
        header: ["organization"],
        primary: ["title"],
        secondary: ["description", "contactName"],
        auxiliary: [],
      },
      google: {
        rows: 1,
        fields: ["title", "description", "contactName"],
      },
    }
  }

  // STAMP / POINTS (default)
  return {
    apple: {
      header: ["organization", "memberNumber"],
      primary: ["progress"],
      secondary: ["nextReward", "totalVisits", "memberSince"],
      auxiliary: ["contactName"],
    },
    google: {
      rows: 1,
      fields: ["progress", "totalVisits", "nextReward", "memberSince", "contactName"],
    },
  }
}

import type { CardShape, PatternStyle, ProgressStyle, FontFamily, LabelFormat } from "./card-design"

// ─── Types ──────────────────────────────────────────────────

export type RestaurantCategory = "cafe" | "fine-dining" | "casual" | "bar" | "bakery" | "general"

export type TemplateStripDesign =
  | { type: "gradient"; stops: Array<{ color: string; position: number }>; angle: number }
  | { type: "pattern"; patternStyle: PatternStyle; color: string; opacity: number }
  | { type: "image"; assetPath: string }
  | { type: "none" }

export type CardTemplate = {
  id: string
  name: string
  description: string
  category: RestaurantCategory
  tags: string[]
  design: {
    shape: CardShape
    primaryColor: string
    secondaryColor: string
    textColor: string
    patternStyle: PatternStyle
    progressStyle: ProgressStyle
    fontFamily: FontFamily
    labelFormat: LabelFormat
    palettePreset: string | null
  }
  stripDesign: TemplateStripDesign
}

// ─── Categories ─────────────────────────────────────────────

export const TEMPLATE_CATEGORIES: { id: RestaurantCategory | "all"; name: string }[] = [
  { id: "all", name: "All" },
  { id: "cafe", name: "Cafe" },
  { id: "fine-dining", name: "Fine Dining" },
  { id: "casual", name: "Casual" },
  { id: "bar", name: "Bar" },
  { id: "bakery", name: "Bakery" },
  { id: "general", name: "General" },
]

// ─── Templates ──────────────────────────────────────────────

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: "cafe-warm-brew",
    name: "Warm Brew",
    description: "Earthy tones with a warm gradient — perfect for coffee shops",
    category: "cafe",
    tags: ["coffee", "warm", "cozy"],
    design: {
      shape: "SHOWCASE",
      primaryColor: "#3e2723",
      secondaryColor: "#a1887f",
      textColor: "#ffffff",
      patternStyle: "NONE",
      progressStyle: "STAMPS",
      fontFamily: "ROUNDED",
      labelFormat: "TITLE_CASE",
      palettePreset: "espresso",
    },
    stripDesign: {
      type: "gradient",
      stops: [
        { color: "#3e2723", position: 0 },
        { color: "#5d4037", position: 40 },
        { color: "#a1887f", position: 100 },
      ],
      angle: 135,
    },
  },
  {
    id: "cafe-minimal",
    name: "Clean Roast",
    description: "Minimal and modern — let the brand speak for itself",
    category: "cafe",
    tags: ["minimal", "modern", "clean"],
    design: {
      shape: "CLEAN",
      primaryColor: "#1a1a1a",
      secondaryColor: "#e0e0e0",
      textColor: "#ffffff",
      patternStyle: "NONE",
      progressStyle: "NUMBERS",
      fontFamily: "SANS",
      labelFormat: "UPPERCASE",
      palettePreset: "charcoal",
    },
    stripDesign: { type: "none" },
  },
  {
    id: "fine-noir",
    name: "Noir",
    description: "Dark and luxurious — for premium dining experiences",
    category: "fine-dining",
    tags: ["dark", "luxury", "premium"],
    design: {
      shape: "SHOWCASE",
      primaryColor: "#0a0a0a",
      secondaryColor: "#4a4a4a",
      textColor: "#f5f5f5",
      patternStyle: "NONE",
      progressStyle: "NUMBERS",
      fontFamily: "SERIF",
      labelFormat: "UPPERCASE",
      palettePreset: null,
    },
    stripDesign: {
      type: "image",
      assetPath: "/templates/fine-noir",
    },
  },
  {
    id: "fine-gold",
    name: "Gold Reserve",
    description: "Sophisticated black and gold for an exclusive feel",
    category: "fine-dining",
    tags: ["gold", "sophisticated", "exclusive"],
    design: {
      shape: "INFO_RICH",
      primaryColor: "#1a1a2e",
      secondaryColor: "#c9a96e",
      textColor: "#f5f0e8",
      patternStyle: "GEOMETRIC",
      progressStyle: "NUMBERS",
      fontFamily: "SERIF",
      labelFormat: "UPPERCASE",
      palettePreset: null,
    },
    stripDesign: {
      type: "gradient",
      stops: [
        { color: "#0d0d1a", position: 0 },
        { color: "#1a1a2e", position: 50 },
        { color: "#c9a96e", position: 100 },
      ],
      angle: 135,
    },
  },
  {
    id: "casual-bright",
    name: "Sunny Side",
    description: "Bright and fun — bring energy to every visit",
    category: "casual",
    tags: ["bright", "fun", "energetic"],
    design: {
      shape: "SHOWCASE",
      primaryColor: "#f57c00",
      secondaryColor: "#fff176",
      textColor: "#ffffff",
      patternStyle: "DOTS",
      progressStyle: "STAMPS",
      fontFamily: "ROUNDED",
      labelFormat: "TITLE_CASE",
      palettePreset: null,
    },
    stripDesign: {
      type: "gradient",
      stops: [
        { color: "#f9a825", position: 0 },
        { color: "#f57c00", position: 50 },
        { color: "#e65100", position: 100 },
      ],
      angle: 120,
    },
  },
  {
    id: "casual-fresh",
    name: "Fresh & Easy",
    description: "Light and airy — a clean look that works everywhere",
    category: "casual",
    tags: ["light", "airy", "fresh"],
    design: {
      shape: "CLEAN",
      primaryColor: "#ffffff",
      secondaryColor: "#4caf50",
      textColor: "#1a1a1a",
      patternStyle: "NONE",
      progressStyle: "CIRCLES",
      fontFamily: "SANS",
      labelFormat: "TITLE_CASE",
      palettePreset: null,
    },
    stripDesign: { type: "none" },
  },
  {
    id: "bar-neon",
    name: "Neon Nights",
    description: "Moody vibes with neon accents — made for nightlife",
    category: "bar",
    tags: ["moody", "neon", "nightlife"],
    design: {
      shape: "SHOWCASE",
      primaryColor: "#0d0d0d",
      secondaryColor: "#e040fb",
      textColor: "#ffffff",
      patternStyle: "NONE",
      progressStyle: "CIRCLES",
      fontFamily: "SANS",
      labelFormat: "UPPERCASE",
      palettePreset: null,
    },
    stripDesign: {
      type: "image",
      assetPath: "/templates/bar-neon",
    },
  },
  {
    id: "bar-craft",
    name: "Craft House",
    description: "Industrial and warm — for craft beer bars and gastropubs",
    category: "bar",
    tags: ["industrial", "craft", "amber"],
    design: {
      shape: "INFO_RICH",
      primaryColor: "#263238",
      secondaryColor: "#ffb300",
      textColor: "#ffffff",
      patternStyle: "GEOMETRIC",
      progressStyle: "SQUARES",
      fontFamily: "MONO",
      labelFormat: "UPPERCASE",
      palettePreset: null,
    },
    stripDesign: {
      type: "pattern",
      patternStyle: "GEOMETRIC",
      color: "#ffb300",
      opacity: 0.12,
    },
  },
  {
    id: "bakery-sweet",
    name: "Sweet Pastels",
    description: "Soft and welcoming — ideal for bakeries and patisseries",
    category: "bakery",
    tags: ["soft", "pastel", "welcoming"],
    design: {
      shape: "SHOWCASE",
      primaryColor: "#f8bbd0",
      secondaryColor: "#fff8e1",
      textColor: "#4e342e",
      patternStyle: "DOTS",
      progressStyle: "STARS",
      fontFamily: "ROUNDED",
      labelFormat: "TITLE_CASE",
      palettePreset: null,
    },
    stripDesign: {
      type: "gradient",
      stops: [
        { color: "#f8bbd0", position: 0 },
        { color: "#f48fb1", position: 40 },
        { color: "#fff8e1", position: 100 },
      ],
      angle: 135,
    },
  },
  {
    id: "general-slate",
    name: "Slate Modern",
    description: "Neutral and professional — works for any restaurant",
    category: "general",
    tags: ["neutral", "professional", "universal"],
    design: {
      shape: "CLEAN",
      primaryColor: "#334155",
      secondaryColor: "#94a3b8",
      textColor: "#ffffff",
      patternStyle: "NONE",
      progressStyle: "NUMBERS",
      fontFamily: "SANS",
      labelFormat: "UPPERCASE",
      palettePreset: "slate",
    },
    stripDesign: { type: "none" },
  },
]

/** Find a template by ID */
export function getTemplateById(id: string): CardTemplate | undefined {
  return CARD_TEMPLATES.find((t) => t.id === id)
}

/**
 * Convert a template's stripDesign to a CSS background value
 * for use in the client-side preview (no server-side image generation needed).
 */
export function templateStripToCss(stripDesign: TemplateStripDesign): string | null {
  switch (stripDesign.type) {
    case "gradient": {
      const stops = stripDesign.stops
        .map((s) => `${s.color} ${s.position}%`)
        .join(", ")
      return `linear-gradient(${stripDesign.angle}deg, ${stops})`
    }
    case "image":
      return `url(${stripDesign.assetPath}-apple.jpg) center/cover`
    case "pattern":
    case "none":
      return null
  }
}

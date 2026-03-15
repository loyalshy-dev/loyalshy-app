import { describe, it, expect } from "vitest"
import { matchTemplates, applyPaletteToTemplate } from "./template-matcher"
import type { ExtractedPalette } from "@/lib/color-extraction"
import { CARD_TEMPLATES } from "./card-templates"

// ─── Mock Palettes ──────────────────────────────────────────

const CAFE_PALETTE: ExtractedPalette = {
  colors: [
    { hex: "#3e2723", rgb: [62, 39, 35], percentage: 40 },
    { hex: "#a1887f", rgb: [161, 136, 127], percentage: 30 },
    { hex: "#d7ccc8", rgb: [215, 204, 200], percentage: 20 },
    { hex: "#5d4037", rgb: [93, 64, 55], percentage: 8 },
    { hex: "#efebe9", rgb: [239, 235, 233], percentage: 2 },
  ],
  primarySuggestion: "#3e2723",
  secondarySuggestion: "#a1887f",
  textColor: "#ffffff",
  labelColor: "#b3bcc9",
  logoBgColor: null,
  variations: [],
  isMonochrome: false,
}

const MONOCHROME_PALETTE: ExtractedPalette = {
  colors: [
    { hex: "#333333", rgb: [51, 51, 51], percentage: 60 },
    { hex: "#666666", rgb: [102, 102, 102], percentage: 25 },
    { hex: "#999999", rgb: [153, 153, 153], percentage: 15 },
  ],
  primarySuggestion: "#333333",
  secondarySuggestion: "#999999",
  textColor: "#ffffff",
  labelColor: "#b3b3b3",
  logoBgColor: null,
  variations: [],
  isMonochrome: true,
}

const NEON_PALETTE: ExtractedPalette = {
  colors: [
    { hex: "#0d0d0d", rgb: [13, 13, 13], percentage: 50 },
    { hex: "#e040fb", rgb: [224, 64, 251], percentage: 30 },
    { hex: "#7c4dff", rgb: [124, 77, 255], percentage: 20 },
  ],
  primarySuggestion: "#7c4dff",
  secondarySuggestion: "#e040fb",
  textColor: "#ffffff",
  labelColor: "#b3b0ff",
  logoBgColor: null,
  variations: [],
  isMonochrome: false,
}

// ─── Tests ──────────────────────────────────────────────────

describe("matchTemplates", () => {
  it("returns the requested number of matches", () => {
    const matches = matchTemplates(CAFE_PALETTE, "cafe", 4)
    expect(matches).toHaveLength(4)
  })

  it("returns fewer if limit exceeds total templates", () => {
    const matches = matchTemplates(null, null, 9999)
    expect(matches.length).toBeLessThanOrEqual(CARD_TEMPLATES.length)
  })

  it("ranks cafe templates higher when category is cafe", () => {
    const matches = matchTemplates(null, "cafe", 10)
    const cafeTemplates = matches.filter((m) => m.template.category === "cafe")
    // At least one cafe template should be in the top results
    expect(cafeTemplates.length).toBeGreaterThan(0)
    // The top-ranked templates should include cafe ones
    const topIds = matches.slice(0, 5).map((m) => m.template.category)
    expect(topIds).toContain("cafe")
  })

  it("ranks bar templates higher when category is bar", () => {
    const matches = matchTemplates(null, "bar", 10)
    const topCategories = matches.slice(0, 3).map((m) => m.template.category)
    expect(topCategories).toContain("bar")
  })

  it("gives color score when palette is provided", () => {
    const withPalette = matchTemplates(CAFE_PALETTE, null, 4)
    const withoutPalette = matchTemplates(null, null, 4)
    // With palette should have different scoring than without
    expect(withPalette[0].score).not.toBe(withoutPalette[0].score)
  })

  it("gives flat 30 color score when no palette", () => {
    const matches = matchTemplates(null, null, CARD_TEMPLATES.length)
    // All should have score = 30 (no category bonus, flat 30 color score)
    for (const m of matches) {
      expect(m.score).toBe(30)
    }
  })

  it("boosts dark templates for monochrome palette", () => {
    const matches = matchTemplates(MONOCHROME_PALETTE, null, CARD_TEMPLATES.length)
    const slateMatch = matches.find((m) => m.template.id === "general-slate")
    const coralMatch = matches.find((m) => m.template.id === "casual-bright")
    expect(slateMatch).toBeDefined()
    expect(coralMatch).toBeDefined()
    // Slate should score higher than bright templates for monochrome input
    expect(slateMatch!.score).toBeGreaterThan(coralMatch!.score)
  })

  it("combines category and color scoring", () => {
    const matches = matchTemplates(CAFE_PALETTE, "cafe", 4)
    // Top result should be a cafe template with good color match
    expect(matches[0].score).toBeGreaterThan(40) // at least category bonus
  })

  it("scores high for near-matching colors", () => {
    // The cafe palette has colors very close to cafe-warm-brew template
    const matches = matchTemplates(CAFE_PALETTE, "cafe", CARD_TEMPLATES.length)
    const warmBrew = matches.find((m) => m.template.id === "cafe-warm-brew")
    expect(warmBrew).toBeDefined()
    // Should have a high combined score (category + color)
    expect(warmBrew!.score).toBeGreaterThan(70)
  })
})

describe("applyPaletteToTemplate", () => {
  it("applies palette colors to template", () => {
    const template = CARD_TEMPLATES[0] // cafe-warm-brew
    const result = applyPaletteToTemplate(template, CAFE_PALETTE)

    expect(result.primaryColor).toBe(CAFE_PALETTE.primarySuggestion)
    expect(result.secondaryColor).toBe(CAFE_PALETTE.secondarySuggestion)
    expect(result.textColor).toBe(CAFE_PALETTE.textColor)
    // Structural properties come from template
    expect(result.showStrip).toBe(template.design.showStrip)
    expect(result.patternStyle).toBe(template.design.patternStyle)
    expect(result.progressStyle).toBe(template.design.progressStyle)
    expect(result.labelFormat).toBe(template.design.labelFormat)
  })

  it("keeps template colors when no palette", () => {
    const template = CARD_TEMPLATES[0]
    const result = applyPaletteToTemplate(template, null)

    expect(result.primaryColor).toBe(template.design.primaryColor)
    expect(result.secondaryColor).toBe(template.design.secondaryColor)
    expect(result.textColor).toBe(template.design.textColor)
  })

  it("produces a valid WalletPassDesign", () => {
    const template = CARD_TEMPLATES[0]
    const result = applyPaletteToTemplate(template, NEON_PALETTE)

    // Should have all required WalletPassDesign fields
    expect(result.showStrip).toBeDefined()
    expect(result.primaryColor).toMatch(/^#/)
    expect(result.secondaryColor).toMatch(/^#/)
    expect(result.textColor).toMatch(/^#/)
    expect(result.progressStyle).toBeDefined()
    expect(result.labelFormat).toBeDefined()
    expect(result.patternStyle).toBeDefined()
  })

  it("preserves stampGridConfig from template", () => {
    const stampTemplate = CARD_TEMPLATES.find((t) => t.id === "stamp-grid-coffee")!
    const result = applyPaletteToTemplate(stampTemplate, CAFE_PALETTE)

    expect(result.useStampGrid).toBe(true)
    expect(result.stampGridConfig).toBeDefined()
    expect(result.stampGridConfig?.stampIcon).toBe("coffee")
  })
})

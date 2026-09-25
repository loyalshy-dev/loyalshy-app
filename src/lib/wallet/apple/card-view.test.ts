import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))

import sharp from "sharp"
import { toAppleCardView, renderAppleCardStrip } from "./card-view"
import type { PassGenerationInput } from "./generate-pass"
import type { CardDesignData } from "../card-design"

const design: CardDesignData = {
  cardType: "STAMP",
  showStrip: true,
  primaryColor: "#1f1410",
  secondaryColor: "#ff6b47",
  textColor: "#ffffff",
  stripImageUrl: null,
  stripImageApple: null,
  stripImageGoogle: null,
  patternStyle: "NONE",
  progressStyle: "NUMBERS",
  labelFormat: "UPPERCASE",
  customProgressLabel: null,
  generatedStripApple: null,
  generatedStripGoogle: null,
  palettePreset: null,
  templateId: null,
  businessHours: null,
  mapAddress: null,
  mapLatitude: null,
  mapLongitude: null,
  socialLinks: {},
  customMessage: null,
  designHash: "abc",
  editorConfig: { useStampGrid: true },
  logoUrl: null,
  logoAppleUrl: null,
  logoGoogleUrl: null,
}

function input(overrides: Partial<PassGenerationInput> = {}): PassGenerationInput {
  return {
    serialNumber: "s",
    authenticationToken: "t",
    customerName: "Ana García",
    customerEmail: null,
    currentCycleVisits: 3,
    visitsRequired: 8,
    totalVisits: 11,
    memberSince: new Date("2026-03-01T10:00:00Z"),
    hasAvailableReward: false,
    organizationName: "Café Luna",
    organizationLogo: "https://cdn.example/logo.png",
    organizationLogoApple: null,
    organizationLogoGoogle: null,
    brandColor: null,
    secondaryColor: null,
    rewardDescription: "Free coffee",
    rewardExpiryDays: 30,
    termsAndConditions: null,
    organizationPhone: null,
    organizationWebsite: null,
    memberNumber: 42,
    programName: "Coffee Club",
    cardDesign: design,
    programType: "STAMP_CARD",
    ...overrides,
  }
}

describe("toAppleCardView", () => {
  it("uses the pass's PassKit colors and front-field layout", () => {
    const view = toAppleCardView(input())
    expect(view.backgroundColor).toBe("rgb(31, 20, 16)")
    expect(view.foregroundColor).toBe("rgb(255, 255, 255)")
    expect(view.hasStrip).toBe(true)
    expect(view.logoUrl).toBe("https://cdn.example/logo.png")
    // Stamp cards never put progress in primary — the strip carries it.
    expect(view.primaryFields).toEqual([])
    const all = [...view.headerFields, ...view.secondaryFields, ...view.auxiliaryFields]
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((f) => f.label === f.label.toUpperCase())).toBe(true)
  })

  it("changes stripVersion when the stamp count changes", () => {
    const a = toAppleCardView(input({ currentCycleVisits: 3 })).stripVersion
    const b = toAppleCardView(input({ currentCycleVisits: 4 })).stripVersion
    expect(a).not.toBe(b)
  })

  it("marks a used single-use coupon as voided", () => {
    const view = toAppleCardView(
      input({
        programType: "COUPON",
        programConfig: { discountType: "percentage", discountValue: 20, redemptionLimit: "single" },
        isRedeemed: true,
        cardDesign: { ...design, cardType: "COUPON" },
      }),
    )
    expect(view.voided).toBe(true)
  })
})

describe("renderAppleCardStrip", () => {
  it("renders the stamp grid as an Apple-sized PNG", async () => {
    const strip = await renderAppleCardStrip(input())
    expect(strip && "png" in strip).toBe(true)
    if (strip && "png" in strip) {
      const meta = await sharp(strip.png).metadata()
      expect(meta.format).toBe("png")
      expect(meta.width).toBe(1125)
      expect(meta.height).toBe(432)
    }
  })

  it("returns null when the design has no strip", async () => {
    expect(await renderAppleCardStrip(input({ cardDesign: { ...design, showStrip: false } }))).toBeNull()
  })
})

import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("./certificates", () => ({
  getAppleCertificates: () => ({ wwdr: "w", signerCert: "c", signerKey: "k", signerKeyPassphrase: "p" }),
}))
vi.mock("./icons", () => ({ getIconBuffers: async () => ({}) }))
vi.mock("./constants", () => ({
  PASS_TYPE_IDENTIFIER: "pass.com.example.test",
  TEAM_IDENTIFIER: "ABCDE12345",
  WEB_SERVICE_BASE_URL: "https://loyalshy.com",
}))

import { PKPass } from "passkit-generator"
import { escapeStrings, generateApplePass, type PassGenerationInput } from "./generate-pass"

function input(overrides: Partial<PassGenerationInput> = {}): PassGenerationInput {
  return {
    serialNumber: "s",
    authenticationToken: "token-1234567890",
    customerName: "Ana García",
    customerEmail: null,
    currentCycleVisits: 3,
    visitsRequired: 8,
    totalVisits: 11,
    memberSince: new Date("2026-03-01T10:00:00Z"),
    hasAvailableReward: false,
    organizationName: "Café Luna",
    organizationLogo: null,
    organizationLogoApple: null,
    organizationLogoGoogle: null,
    brandColor: null,
    secondaryColor: null,
    rewardDescription: "Un café gratis",
    rewardExpiryDays: 30,
    termsAndConditions: null,
    organizationPhone: null,
    organizationWebsite: null,
    memberNumber: 42,
    programName: "Club Café",
    cardDesign: null,
    programType: "STAMP_CARD",
    ...overrides,
  }
}

/** Runs the generator up to signing and returns what went into the pass. */
async function build(i: PassGenerationInput) {
  const localize = vi.spyOn(PKPass.prototype, "localize")
  const getAsBuffer = vi.spyOn(PKPass.prototype, "getAsBuffer").mockReturnValue(Buffer.from(""))
  await generateApplePass(i)
  const byLang = Object.fromEntries(localize.mock.calls.map(([lang, strings]) => [lang, strings as Record<string, string>]))
  const pass = getAsBuffer.mock.contexts[0] as PKPass
  return { pass, byLang }
}

afterEach(() => vi.restoreAllMocks())

describe("generateApplePass localization", () => {
  it("writes pass.strings for every language, keyed by the English in pass.json", async () => {
    const { pass, byLang } = await build(input())
    expect(Object.keys(byLang).sort()).toEqual(["ca", "de", "en", "es", "fr", "it", "pt"])

    const back = pass.backFields
    const program = back.find((f) => f.key === "programInfo")
    expect(program?.label).toBe("Loyalty Program")
    expect(program?.value).toBe(
      "Earn a reward after every 8 visits! Your reward: Un café gratis. Rewards expire 30 days after being earned.",
    )
    expect(byLang.es[program?.label as string]).toBe("Programa de fidelidad")
    expect(byLang.es[program?.value as string]).toBe(
      "¡Consigue un premio cada 8 visitas! Tu premio: Un café gratis. Los premios caducan 30 días después de conseguirlos.",
    )

    // Change messages (the lock-screen banners) are translated too.
    const total = pass.secondaryFields.find((f) => f.key === "totalVisits")
    expect(total?.changeMessage).toBe("Visit recorded — %@ total")
    expect(byLang.it["Visit recorded — %@ total"]).toBe("Visita registrata: %@ in totale")

    // en.lproj only maps English to itself.
    for (const [k, v] of Object.entries(byLang.en)) expect(v).toBe(k)

    // Merchant text is never a key.
    expect(byLang.es["Club Café"]).toBeUndefined()
  })

  it("keeps a merchant's custom field label untranslated", async () => {
    const { pass, byLang } = await build(
      input({
        cardDesign: {
          cardType: "STAMP", showStrip: false, primaryColor: null, secondaryColor: null, textColor: null,
          stripImageUrl: null, stripImageApple: null, stripImageGoogle: null, patternStyle: "NONE",
          progressStyle: "NUMBERS", labelFormat: "UPPERCASE", customProgressLabel: null,
          generatedStripApple: null, generatedStripGoogle: null, palettePreset: null, templateId: null,
          businessHours: null, mapAddress: null, mapLatitude: null, mapLongitude: null, socialLinks: {},
          customMessage: null, designHash: "h", logoUrl: null, logoAppleUrl: null, logoGoogleUrl: null,
          editorConfig: { fields: ["totalVisits"], fieldLabels: { totalVisits: "Cafés" } },
        },
      }),
    )
    const total = [...pass.headerFields, ...pass.secondaryFields].find((f) => f.key === "totalVisits")
    expect(total?.label).toBe("CAFÉS")
    expect(byLang.es.CAFÉS).toBeUndefined()
  })

  it("translates a used single-use coupon", async () => {
    const { pass, byLang } = await build(
      input({
        programType: "COUPON",
        programConfig: { discountType: "percentage", discountValue: 20, redemptionLimit: "single" },
        isRedeemed: true,
        redeemedAt: new Date("2026-10-05T12:00:00Z"),
      }),
    )
    const valid = [...pass.headerFields, ...pass.secondaryFields].find((f) => f.key === "validUntil")
    expect(valid?.value).toBe("Redeemed")
    expect(byLang.fr.Redeemed).toBe("Utilisé")
    expect(byLang.de["Coupon %@"]).toBe("Gutschein %@")
    expect(byLang.pt["20% off"]).toBe("20% de desconto")
  })

  it("escapes quotes, backslashes and line breaks for pass.strings", async () => {
    expect(escapeStrings({ 'A "free" coffee\\ \nnext': 'Un café "gratis"\nya' })).toEqual({
      'A \\"free\\" coffee\\\\ \\nnext': 'Un café \\"gratis\\"\\nya',
    })
    const { byLang } = await build(input({ rewardDescription: 'Un "café"' }))
    const key = Object.keys(byLang.es).find((k) => k.startsWith("Earn a reward"))
    expect(key).toContain('Un \\"café\\"')
    expect(byLang.es["Loyalshy — Digital Loyalty Cards\\nhttps://loyalshy.com"]).toBe(
      "Loyalshy, tarjetas de fidelidad digitales\\nhttps://loyalshy.com",
    )
  })
})

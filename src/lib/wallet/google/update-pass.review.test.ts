import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// The review prompt's Google side: link merged with the prize link, and the
// TEXT_AND_NOTIFY message only while the prompt is fresh.

let mockDb: MockDb
const fetchMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("./credentials", () => ({ getAccessToken: async () => "token" }))
  vi.doMock("./constants", () => ({
    GOOGLE_WALLET_API_BASE: "https://wallet.test",
    GOOGLE_WALLET_ISSUER_ID: "issuer",
    buildPassInstanceObjectId: (id: string) => `issuer.${id}`,
  }))
  vi.doMock("../apple/update-pass", () => ({ createWalletPassLog: vi.fn() }))
  vi.doMock("../../storage", () => ({ uploadFile: vi.fn() }))
  vi.doMock("@/lib/env", () => ({ env: () => ({ BETTER_AUTH_SECRET: "s" }) }))
  vi.doMock("../../card-access", () => ({ signCardAccess: () => "sig" }))
})

function passInstance(reviewPromptedAt: Date | null, unrevealedPrize = false, reviewPromptPassId: string | null = "pi-1") {
  return {
    id: "pi-1",
    walletProvider: "GOOGLE",
    status: "ACTIVE",
    data: { currentCycleVisits: 3, totalVisits: 3 },
    contact: {
      id: "c-1",
      fullName: "Ana",
      memberNumber: 7,
      createdAt: new Date("2026-01-01"),
      reviewPromptedAt,
      reviewPromptPassId: reviewPromptedAt ? reviewPromptPassId : null,
      organization: { id: "org-1", name: "Café Lola", slug: "lola", brandColor: null, logo: null },
    },
    passTemplate: {
      id: "pt-1",
      name: "Sellos",
      passType: "STAMP_CARD",
      config: { stampsRequired: 10 },
      passDesign: { showStrip: false },
    },
    rewards: unrevealedPrize
      ? [{ id: "r-1", status: "AVAILABLE", revealedAt: null, description: "Café gratis" }]
      : [],
  }
}

function settingsRow() {
  return {
    enabled: true,
    reviewUrl: "https://g.page/r/a/review",
    triggerStamp: 3,
    message: "¿Qué tal en Café Lola?",
    linkLabel: "Dejar una reseña",
    organization: { name: "Café Lola", timezone: "Europe/Madrid", plan: "STARTER", subscriptionStatus: "ACTIVE" },
  }
}

async function patchBody(): Promise<Record<string, unknown>> {
  const { notifyGooglePassUpdate } = await import("./update-pass")
  await notifyGooglePassUpdate("pi-1")
  const init = fetchMock.mock.calls[0][1] as RequestInit
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

describe("Google review prompt", () => {
  it("adds the review link next to the prize link before the prompt", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(passInstance(null, true))
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(settingsRow())

    const body = await patchBody()
    const uris = (body.linksModuleData as { uris: { id: string; description: string; uri: string }[] }).uris
    expect(uris.map((u) => u.id)).toEqual(["revealLink", "googleReview"])
    expect(uris[1].description).toBe("Dejar una reseña")
    expect(uris[1].uri).toMatch(/\/r\/pi-1\./)
    const ids = (body.messages as { id: string }[]).map((m) => m.id)
    expect(ids).toEqual(["stamp-3"])
  })

  it("appends the review message while the prompt is fresh", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(passInstance(new Date()))
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(settingsRow())

    const body = await patchBody()
    const messages = body.messages as { id: string; header: string; body: string; messageType: string }[]
    expect(messages.map((m) => m.id)).toEqual(["stamp-3", "review-c-1"])
    expect(messages[1]).toMatchObject({ header: "Café Lola", body: "¿Qué tal en Café Lola?", messageType: "TEXT_AND_NOTIFY" })
  })

  it("drops the message after 24h and everything when the feature is off", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(passInstance(new Date(Date.now() - 25 * 3600_000)))
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(settingsRow())
    let body = await patchBody()
    expect((body.messages as { id: string }[]).map((m) => m.id)).toEqual(["stamp-3"])

    fetchMock.mockClear()
    vi.resetModules()
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(null)
    body = await patchBody()
    expect(body.linksModuleData).toEqual({ uris: [] })
  })

  it("still patches the pass when the settings lookup fails", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(passInstance(null))
    mockDb.googleReviewSettings.findUnique.mockRejectedValue(new Error("db blip"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const body = await patchBody()
    expect(body.linksModuleData).toEqual({ uris: [] })
    expect((body.messages as { id: string }[]).map((m) => m.id)).toEqual(["stamp-3"])
  })

  it("keeps a recently-asked contact's OTHER pass quiet", async () => {
    // Asked 10 minutes ago through another pass (e.g. a second program, or a
    // pass added after the prompt): link + no TEXT_AND_NOTIFY on this one.
    mockDb.passInstance.findUnique.mockResolvedValue(passInstance(new Date(Date.now() - 600_000), false, "pi-other"))
    mockDb.googleReviewSettings.findUnique.mockResolvedValue(settingsRow())

    const body = await patchBody()
    expect((body.messages as { id: string }[]).map((m) => m.id)).toEqual(["stamp-3"])
    expect((body.linksModuleData as { uris: { id: string }[] }).uris.map((u) => u.id)).toEqual(["googleReview"])
  })
})

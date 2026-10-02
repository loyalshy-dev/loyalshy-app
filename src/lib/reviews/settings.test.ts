import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/env", () => ({ env: () => ({ BETTER_AUTH_SECRET: "s" }) }))
  mockDb.googleReviewSettings.findUnique.mockResolvedValue({
    enabled: true,
    reviewUrl: "https://g.page/r/a/review",
    triggerStamp: 1,
    message: "¿Qué tal?",
    linkLabel: "Dejar una reseña",
    organization: { name: "Café", timezone: "Europe/Madrid", plan: "STARTER", subscriptionStatus: "ACTIVE" },
  })
})

async function load(passInstanceId: string, reviewPromptedAt: Date | null, reviewPromptPassId: string | null) {
  const { loadReviewPassField } = await import("./settings")
  return loadReviewPassField({
    organizationId: "org-1",
    passInstanceId,
    passType: "STAMP_CARD",
    templateConfig: {},
    reviewPromptedAt,
    reviewPromptPassId,
  })
}

describe("loadReviewPassField", () => {
  const justNow = new Date(Date.now() - 60_000)

  it("only the pass the prompt went through carries the notifying version", async () => {
    expect(await load("pi-asked", justNow, "pi-asked")).toMatchObject({ prompted: true, fresh: true })
  })

  it("a recently-asked contact's other or newly added pass stays quiet", async () => {
    // Regression: adding a new pass right after being asked re-bannered the
    // ask with 0 stamps on the new pass.
    expect(await load("pi-new", justNow, "pi-asked")).toMatchObject({ prompted: true, fresh: false })
  })

  it("prompts from before the pass id was recorded never notify again", async () => {
    expect(await load("pi-asked", justNow, null)).toMatchObject({ prompted: true, fresh: false })
  })

  it("not asked yet: plain link, nothing fresh", async () => {
    expect(await load("pi-1", null, null)).toMatchObject({ prompted: false, fresh: false })
  })
})

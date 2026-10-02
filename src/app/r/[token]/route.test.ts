import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: URL | string, status: number) =>
      new Response(null, { status, headers: { location: String(url) } }),
  },
}))

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/env", () => ({ env: () => ({ BETTER_AUTH_SECRET: "s" }) }))
})

async function hit(token: string) {
  const { GET } = await import("./route")
  return GET(new Request(`https://loyalshy.com/r/${token}`), { params: Promise.resolve({ token }) })
}

async function tokenFor(id: string) {
  const { createReviewToken } = await import("@/lib/reviews/token")
  return createReviewToken(id)
}

function passWithUrl(reviewUrl: string | null) {
  return {
    contactId: "c-1",
    passTemplate: { organization: { reviewSettings: reviewUrl ? { reviewUrl } : null } },
  }
}

describe("GET /r/[token]", () => {
  it("counts the tap and redirects to Google", async () => {
    const url = "https://search.google.com/local/writereview?placeid=P"
    mockDb.passInstance.findUnique.mockResolvedValue(passWithUrl(url))

    const res = await hit(await tokenFor("pi-1"))
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe(url)
    expect(mockDb.contact.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { reviewLinkOpens: { increment: 1 } },
    })
    expect(mockDb.contact.updateMany).toHaveBeenCalledWith({
      where: { id: "c-1", reviewLinkOpenedAt: null },
      data: { reviewLinkOpenedAt: expect.any(Date) },
    })
  })

  it("sends a bad token home without touching the database", async () => {
    const res = await hit("pi-1.forged")
    expect(res.headers.get("location")).toBe("https://loyalshy.com/")
    expect(mockDb.passInstance.findUnique).not.toHaveBeenCalled()
  })

  it("never redirects off Google, even if a bad URL got stored", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(passWithUrl("https://evil.example/review"))
    const res = await hit(await tokenFor("pi-1"))
    expect(res.headers.get("location")).toBe("https://loyalshy.com/")
    expect(mockDb.contact.update).not.toHaveBeenCalled()
  })

  it("still redirects when tracking fails", async () => {
    const url = "https://g.page/r/abc/review"
    mockDb.passInstance.findUnique.mockResolvedValue(passWithUrl(url))
    mockDb.contact.update.mockRejectedValue(new Error("db down"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await hit(await tokenFor("pi-1"))
    expect(res.headers.get("location")).toBe(url)
  })
})

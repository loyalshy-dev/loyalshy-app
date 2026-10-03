import { describe, it, expect } from "vitest"
import { buildPlaceReviewUrl, isAllowedReviewUrl, resolveReviewUrl, reviewSettingsSchema } from "./config"

const base = {
  enabled: true,
  placeId: null,
  placeName: null,
  customUrl: null,
  triggerStamp: 3,
  message: "¿Qué tal?",
  linkLabel: "Dejar una reseña",
}

describe("review URLs", () => {
  it("builds Google's writereview link", () => {
    expect(buildPlaceReviewUrl("ChIJ123")).toBe("https://search.google.com/local/writereview?placeid=ChIJ123")
  })

  it("accepts Google review hosts only, over https", () => {
    expect(isAllowedReviewUrl("https://g.page/r/abc/review")).toBe(true)
    expect(isAllowedReviewUrl("https://maps.app.goo.gl/xyz")).toBe(true)
    expect(isAllowedReviewUrl("http://g.page/r/abc/review")).toBe(false)
    expect(isAllowedReviewUrl("https://g.page.evil.com/r")).toBe(false)
    expect(isAllowedReviewUrl("https://evil.com/?u=https://g.page")).toBe(false)
    expect(isAllowedReviewUrl("not a url")).toBe(false)
  })

  it("prefers the place over a pasted link", () => {
    expect(resolveReviewUrl({ placeId: "P1", customUrl: "https://g.page/x" })).toContain("placeid=P1")
    expect(resolveReviewUrl({ placeId: null, customUrl: "https://g.page/x" })).toBe("https://g.page/x")
  })
})

describe("reviewSettingsSchema", () => {
  it("needs a place or a link", () => {
    const r = reviewSettingsSchema.safeParse(base)
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe("missingTarget")
  })

  it("rejects a non-Google link", () => {
    const r = reviewSettingsSchema.safeParse({ ...base, customUrl: "https://example.com/review" })
    expect(r.error?.issues[0]?.message).toBe("invalidUrl")
  })

  it("accepts a place or a Google link", () => {
    expect(reviewSettingsSchema.safeParse({ ...base, placeId: "ChIJ1", placeName: "Café" }).success).toBe(true)
    expect(reviewSettingsSchema.safeParse({ ...base, customUrl: "https://g.page/r/a/review" }).success).toBe(true)
  })

  it("bounds the trigger and the message", () => {
    const ok = { ...base, placeId: "P" }
    expect(reviewSettingsSchema.safeParse({ ...ok, triggerStamp: 0 }).success).toBe(false)
    expect(reviewSettingsSchema.safeParse({ ...ok, triggerStamp: 21 }).success).toBe(false)
    expect(reviewSettingsSchema.safeParse({ ...ok, message: "x".repeat(121) }).success).toBe(false)
    expect(reviewSettingsSchema.safeParse({ ...ok, message: "   " }).success).toBe(false)
  })
})

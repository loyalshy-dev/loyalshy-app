import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))

import { buildAppleReviewField } from "@/lib/wallet/apple/generate-pass"

const review = {
  url: "https://loyalshy.com/r/p1.sig",
  linkLabel: "Dejar una reseña",
  message: "¿Qué tal en Café <Lola> & co?",
  prompted: false,
  fresh: false,
}

describe("buildAppleReviewField", () => {
  it("is a quiet link before the contact is asked", () => {
    const f = buildAppleReviewField(review)
    expect(f.value).toBe("Dejar una reseña")
    expect(f.changeMessage).toBeUndefined()
    expect(f.attributedValue).toBe('<a href="https://loyalshy.com/r/p1.sig">Dejar una reseña</a>')
  })

  it("carries the message with a banner while the prompt is fresh", () => {
    const f = buildAppleReviewField({ ...review, prompted: true, fresh: true })
    expect(f.value).toBe(review.message)
    expect(f.changeMessage).toBe("%@")
    expect(f.attributedValue).toContain("Café &lt;Lola&gt; &amp; co?")
  })

  it("keeps the message but goes quiet after 24h", () => {
    const f = buildAppleReviewField({ ...review, prompted: true, fresh: false })
    expect(f.value).toBe(review.message)
    expect(f.changeMessage).toBeUndefined()
  })
})

import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))

import { buildAppleReviewFields } from "@/lib/wallet/apple/generate-pass"

const review = {
  url: "https://loyalshy.com/r/p1.sig",
  linkLabel: "Dejar una reseña",
  message: "¿Qué tal en Café <Lola> & co?",
  prompted: false,
  fresh: false,
}

describe("buildAppleReviewFields", () => {
  it("is a single quiet link before the contact is asked", () => {
    const fields = buildAppleReviewFields(review)
    expect(fields).toEqual([
      {
        key: "googleReview",
        label: "Google",
        value: "Dejar una reseña",
        attributedValue: '<a href="https://loyalshy.com/r/p1.sig">Dejar una reseña</a>',
      },
    ])
  })

  it("banners the plain message, with the link in its own row", () => {
    const [message, link] = buildAppleReviewFields({ ...review, prompted: true, fresh: true })
    expect(message).toEqual({ key: "googleReview", label: "Google", value: review.message, changeMessage: "%@" })
    expect(link.key).toBe("googleReviewLink")
    expect(link.changeMessage).toBeUndefined()
    expect(link.attributedValue).toBe('<a href="https://loyalshy.com/r/p1.sig">Dejar una reseña</a>')
  })

  it("never puts HTML in a field that notifies", () => {
    for (const state of [
      { prompted: false, fresh: false },
      { prompted: true, fresh: true },
      { prompted: true, fresh: false },
    ]) {
      for (const field of buildAppleReviewFields({ ...review, ...state })) {
        if (field.changeMessage) expect(field.attributedValue).toBeUndefined()
      }
    }
  })

  it("keeps the message but goes quiet after 24h", () => {
    const [message] = buildAppleReviewFields({ ...review, prompted: true, fresh: false })
    expect(message.value).toBe(review.message)
    expect(message.changeMessage).toBeUndefined()
  })

  it("escapes the link text", () => {
    const [, link] = buildAppleReviewFields({ ...review, linkLabel: "Café <Lola>", prompted: true, fresh: true })
    expect(link.attributedValue).toContain(">Café &lt;Lola&gt;</a>")
  })
})

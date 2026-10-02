import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/env", () => ({ env: () => ({ BETTER_AUTH_SECRET: "test-secret" }) }))

import { createReviewToken, verifyReviewToken } from "./token"

describe("review token", () => {
  it("round-trips the pass id", () => {
    const token = createReviewToken("0199-pass")
    expect(verifyReviewToken(token)).toBe("0199-pass")
  })

  it("rejects tampered or malformed tokens", () => {
    const token = createReviewToken("pass-a")
    const sig = token.split(".")[1]
    expect(verifyReviewToken(`pass-b.${sig}`)).toBeNull()
    expect(verifyReviewToken(`${token}x`)).toBeNull()
    expect(verifyReviewToken("no-dot")).toBeNull()
    expect(verifyReviewToken(".sig")).toBeNull()
  })
})

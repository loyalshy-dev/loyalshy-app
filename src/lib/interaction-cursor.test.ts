import { describe, expect, it } from "vitest"
import { afterInteractionCursor, decodeInteractionCursor, encodeInteractionCursor } from "./interaction-cursor"

describe("interaction cursor", () => {
  const sample = { createdAt: new Date("2026-09-26T13:05:00.123Z"), id: "cmfz1abc2def3ghi" }

  it("round-trips", () => {
    expect(decodeInteractionCursor(encodeInteractionCursor(sample))).toEqual(sample)
  })

  it("is opaque and URL-safe", () => {
    const token = encodeInteractionCursor(sample)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token).not.toContain(sample.id)
  })

  it("rejects garbage, missing parts, and bad dates", () => {
    expect(decodeInteractionCursor(null)).toBeNull()
    expect(decodeInteractionCursor("")).toBeNull()
    expect(decodeInteractionCursor("not-base64|")).toBeNull()
    expect(decodeInteractionCursor(Buffer.from("no-separator").toString("base64url"))).toBeNull()
    expect(decodeInteractionCursor(Buffer.from("|onlyid").toString("base64url"))).toBeNull()
    expect(decodeInteractionCursor(Buffer.from("2026-99-99T00:00:00Z|id").toString("base64url"))).toBeNull()
    expect(decodeInteractionCursor(Buffer.from("2026-09-26T00:00:00Z|bad id").toString("base64url"))).toBeNull()
  })

  it("builds a strict keyset predicate with the id as tie-breaker", () => {
    expect(afterInteractionCursor(sample)).toEqual({
      OR: [{ createdAt: { lt: sample.createdAt } }, { createdAt: sample.createdAt, id: { lt: sample.id } }],
    })
  })
})

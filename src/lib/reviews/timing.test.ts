import { describe, it, expect } from "vitest"
import { computeReviewDueAt, isReviewPromptFresh, REVIEW_PROMPT_DELAY_MS } from "./timing"

const MADRID = "Europe/Madrid"

describe("computeReviewDueAt", () => {
  it("sends 90 min after the stamp during the day", () => {
    // 11:00 Madrid (CEST, UTC+2) → 12:30 local
    const stamp = new Date("2026-06-10T09:00:00Z")
    expect(computeReviewDueAt(stamp, MADRID).toISOString()).toBe("2026-06-10T10:30:00.000Z")
  })

  it("moves an evening prompt to 10:00 the next morning", () => {
    // 20:00 Madrid + 90 min = 21:30 → next day 10:00 CEST = 08:00Z
    const stamp = new Date("2026-06-10T18:00:00Z")
    expect(computeReviewDueAt(stamp, MADRID).toISOString()).toBe("2026-06-11T08:00:00.000Z")
  })

  it("moves an early-morning prompt to 10:00 the same day", () => {
    // 06:00 Madrid + 90 min = 07:30 → 10:00 same day
    const stamp = new Date("2026-06-10T04:00:00Z")
    expect(computeReviewDueAt(stamp, MADRID).toISOString()).toBe("2026-06-10T08:00:00.000Z")
  })

  it("handles month rollover and winter time", () => {
    // Jan 31 22:00 Madrid (CET, UTC+1) → Feb 1 10:00 CET = 09:00Z
    const stamp = new Date("2026-01-31T21:00:00Z")
    expect(computeReviewDueAt(stamp, MADRID).toISOString()).toBe("2026-02-01T09:00:00.000Z")
  })

  it("lands on 10:00 local across the spring DST change", () => {
    // Sat Mar 28 2026 21:00 CET → Sun Mar 29 (CEST from 02:00) 10:00 = 08:00Z
    const stamp = new Date("2026-03-28T20:00:00Z")
    expect(computeReviewDueAt(stamp, MADRID).toISOString()).toBe("2026-03-29T08:00:00.000Z")
  })

  it("treats an unknown zone as UTC", () => {
    const stamp = new Date("2026-06-10T22:00:00Z")
    expect(computeReviewDueAt(stamp, "Not/AZone").toISOString()).toBe("2026-06-11T10:00:00.000Z")
  })

  it("keeps a prompt that lands exactly at 09:00", () => {
    const stamp = new Date(Date.parse("2026-06-10T07:00:00Z") - REVIEW_PROMPT_DELAY_MS) // due 09:00 Madrid
    expect(computeReviewDueAt(stamp, MADRID).toISOString()).toBe("2026-06-10T07:00:00.000Z")
  })
})

describe("isReviewPromptFresh", () => {
  const now = new Date("2026-06-10T12:00:00Z")
  it("is fresh for 24h", () => {
    expect(isReviewPromptFresh(new Date("2026-06-10T00:00:00Z"), now)).toBe(true)
    expect(isReviewPromptFresh(new Date("2026-06-09T12:00:01Z"), now)).toBe(true)
  })
  it("goes quiet after 24h or when never asked", () => {
    expect(isReviewPromptFresh(new Date("2026-06-09T12:00:00Z"), now)).toBe(false)
    expect(isReviewPromptFresh(null, now)).toBe(false)
  })
})

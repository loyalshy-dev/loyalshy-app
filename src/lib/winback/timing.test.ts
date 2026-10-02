import { describe, it, expect } from "vitest"
import { isHoldout, isWinbackFresh, isWinbackSendHour, localHour } from "./timing"

describe("win-back timing", () => {
  it("reads the local hour of the org's zone", () => {
    const at = new Date("2026-06-10T08:30:00Z") // 10:30 in Madrid (CEST)
    expect(localHour(at, "Europe/Madrid")).toBe(10)
    expect(isWinbackSendHour(at, "Europe/Madrid")).toBe(true)
    expect(isWinbackSendHour(at, "Europe/London")).toBe(false) // 09:30
    expect(localHour(at, "Not/AZone")).toBe(8) // UTC fallback
  })

  it("is fresh for 24h after a send", () => {
    const now = new Date("2026-06-10T12:00:00Z")
    expect(isWinbackFresh(new Date("2026-06-10T00:00:00Z"), now)).toBe(true)
    expect(isWinbackFresh(new Date("2026-06-09T12:00:00Z"), now)).toBe(false)
  })

  it("draws the comparison group deterministically, about 10%", () => {
    const lapse = new Date("2026-05-01T10:00:00Z")
    expect(isHoldout("contact-1", lapse)).toBe(isHoldout("contact-1", lapse))
    let held = 0
    const n = 5000
    for (let i = 0; i < n; i++) if (isHoldout(`c-${i}`, lapse)) held++
    expect(held / n).toBeGreaterThan(0.08)
    expect(held / n).toBeLessThan(0.12)
  })
})

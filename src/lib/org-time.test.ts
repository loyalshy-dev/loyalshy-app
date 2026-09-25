import { describe, it, expect } from "vitest"
import { startOfDayInTimeZone } from "./org-time"

describe("startOfDayInTimeZone", () => {
  it("uses the zone's midnight (Madrid, summer time UTC+2)", () => {
    const now = new Date("2026-09-25T00:30:00Z") // 02:30 in Madrid
    expect(startOfDayInTimeZone(now, "Europe/Madrid").toISOString()).toBe("2026-09-24T22:00:00.000Z")
  })
  it("handles a zone behind UTC", () => {
    const now = new Date("2026-09-25T03:00:00Z") // 23:00 on the 24th in New York
    expect(startOfDayInTimeZone(now, "America/New_York").toISOString()).toBe("2026-09-24T04:00:00.000Z")
  })
  it("falls back to UTC for an unknown zone", () => {
    const now = new Date("2026-09-25T10:00:00Z")
    expect(startOfDayInTimeZone(now, "Not/AZone").toISOString()).toBe("2026-09-25T00:00:00.000Z")
  })
})

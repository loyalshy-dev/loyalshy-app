import { describe, it, expect } from "vitest"
import { computeWinbackResults } from "./results-math"

const base = { periodDays: 90, measuring: 0, unreachable: 0 }

describe("computeWinbackResults", () => {
  it("measures the lift once both groups are big enough", () => {
    const r = computeWinbackResults({ ...base, messaged: { sent: 120, back: 41 }, comparison: { sent: 22, back: 2 } })
    expect(r.rateMessaged).toBeCloseTo(41 / 120)
    expect(r.rateComparison).toBeCloseTo(2 / 22)
    // (0.3417 − 0.0909) × 120 ≈ 30
    expect(r.extraCustomers).toBe(30)
  })

  it("no lift claim while the comparison group is small", () => {
    const r = computeWinbackResults({ ...base, messaged: { sent: 120, back: 41 }, comparison: { sent: 12, back: 1 } })
    expect(r.extraCustomers).toBeNull()
    expect(r.rateMessaged).toBeCloseTo(41 / 120)
  })

  it("no lift claim without a comparison group (holdout off)", () => {
    const r = computeWinbackResults({ ...base, messaged: { sent: 80, back: 20 }, comparison: { sent: 0, back: 0 } })
    expect(r.rateComparison).toBeNull()
    expect(r.extraCustomers).toBeNull()
  })

  it("reports a zero or negative lift honestly", () => {
    const r = computeWinbackResults({ ...base, messaged: { sent: 50, back: 5 }, comparison: { sent: 25, back: 5 } })
    expect(r.extraCustomers).toBe(-5)
  })

  it("empty period", () => {
    const r = computeWinbackResults({ ...base, messaged: { sent: 0, back: 0 }, comparison: { sent: 0, back: 0 } })
    expect(r).toMatchObject({ rateMessaged: null, rateComparison: null, extraCustomers: null })
  })
})

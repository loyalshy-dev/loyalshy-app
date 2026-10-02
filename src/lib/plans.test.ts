import { describe, it, expect } from "vitest"
import { planAllowsFeature } from "./plans"

describe("automation features by plan", () => {
  it("review prompts from Pro, win-back from Business", () => {
    const allows = (plan: Parameters<typeof planAllowsFeature>[0]) => ({
      reviews: planAllowsFeature(plan, "ACTIVE", "reviewPrompts"),
      winback: planAllowsFeature(plan, "ACTIVE", "winback"),
    })
    expect(allows("FREE")).toEqual({ reviews: false, winback: false })
    expect(allows("STARTER")).toEqual({ reviews: true, winback: false })
    expect(allows("GROWTH")).toEqual({ reviews: true, winback: true })
    expect(allows("SCALE")).toEqual({ reviews: true, winback: true })
    expect(allows("ENTERPRISE")).toEqual({ reviews: true, winback: true })
  })

  it("a lapsed subscription turns both off", () => {
    expect(planAllowsFeature("GROWTH", "CANCELED", "winback")).toBe(false)
    expect(planAllowsFeature("STARTER", "PAST_DUE", "reviewPrompts")).toBe(false)
    expect(planAllowsFeature("SCALE", "TRIALING", "winback")).toBe(true)
  })
})

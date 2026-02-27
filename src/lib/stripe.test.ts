import { describe, it, expect } from "vitest"
import {
  getPlanLimits,
  isUpgrade,
  getPlanForPriceLookupKey,
  PLANS,
  type PlanId,
} from "./stripe"

describe("PLANS", () => {
  it("defines all four plans", () => {
    expect(Object.keys(PLANS)).toEqual(["FREE", "STARTER", "PRO", "ENTERPRISE"])
  })

  it("FREE plan has lowest limits", () => {
    expect(PLANS.FREE.customerLimit).toBe(50)
    expect(PLANS.FREE.staffLimit).toBe(1)
    expect(PLANS.FREE.price).toBe(0)
  })

  it("PRO plan has unlimited customers", () => {
    expect(PLANS.PRO.customerLimit).toBe(Infinity)
    expect(PLANS.PRO.staffLimit).toBe(10)
  })

  it("ENTERPRISE plan has unlimited everything", () => {
    expect(PLANS.ENTERPRISE.customerLimit).toBe(Infinity)
    expect(PLANS.ENTERPRISE.staffLimit).toBe(Infinity)
    expect(PLANS.ENTERPRISE.price).toBeNull()
  })
})

describe("getPlanLimits", () => {
  it("returns correct limits for FREE plan", () => {
    const limits = getPlanLimits("FREE")
    expect(limits).toEqual({ customerLimit: 50, staffLimit: 1 })
  })

  it("returns correct limits for STARTER plan", () => {
    const limits = getPlanLimits("STARTER")
    expect(limits).toEqual({ customerLimit: 500, staffLimit: 3 })
  })

  it("returns correct limits for PRO plan", () => {
    const limits = getPlanLimits("PRO")
    expect(limits).toEqual({ customerLimit: Infinity, staffLimit: 10 })
  })

  it("returns correct limits for ENTERPRISE plan", () => {
    const limits = getPlanLimits("ENTERPRISE")
    expect(limits).toEqual({ customerLimit: Infinity, staffLimit: Infinity })
  })
})

describe("isUpgrade", () => {
  it("FREE → STARTER is an upgrade", () => {
    expect(isUpgrade("FREE", "STARTER")).toBe(true)
  })

  it("FREE → PRO is an upgrade", () => {
    expect(isUpgrade("FREE", "PRO")).toBe(true)
  })

  it("FREE → ENTERPRISE is an upgrade", () => {
    expect(isUpgrade("FREE", "ENTERPRISE")).toBe(true)
  })

  it("STARTER → PRO is an upgrade", () => {
    expect(isUpgrade("STARTER", "PRO")).toBe(true)
  })

  it("PRO → ENTERPRISE is an upgrade", () => {
    expect(isUpgrade("PRO", "ENTERPRISE")).toBe(true)
  })

  it("same plan is NOT an upgrade", () => {
    expect(isUpgrade("FREE", "FREE")).toBe(false)
    expect(isUpgrade("PRO", "PRO")).toBe(false)
  })

  it("downgrade is NOT an upgrade", () => {
    expect(isUpgrade("PRO", "STARTER")).toBe(false)
    expect(isUpgrade("ENTERPRISE", "FREE")).toBe(false)
    expect(isUpgrade("STARTER", "FREE")).toBe(false)
  })
})

describe("getPlanForPriceLookupKey", () => {
  it("maps starter_monthly to STARTER", () => {
    expect(getPlanForPriceLookupKey("starter_monthly")).toBe("STARTER")
  })

  it("maps pro_monthly to PRO", () => {
    expect(getPlanForPriceLookupKey("pro_monthly")).toBe("PRO")
  })

  it("returns FREE for unknown lookup keys", () => {
    expect(getPlanForPriceLookupKey("unknown")).toBe("FREE")
    expect(getPlanForPriceLookupKey("")).toBe("FREE")
  })
})

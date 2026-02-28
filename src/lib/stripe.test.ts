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
    expect(Object.keys(PLANS)).toEqual(["STARTER", "PRO", "BUSINESS", "ENTERPRISE"])
  })

  it("STARTER plan has correct limits", () => {
    expect(PLANS.STARTER.customerLimit).toBe(200)
    expect(PLANS.STARTER.staffLimit).toBe(2)
    expect(PLANS.STARTER.price).toBe(15)
  })

  it("PRO plan has correct limits", () => {
    expect(PLANS.PRO.customerLimit).toBe(1_000)
    expect(PLANS.PRO.staffLimit).toBe(5)
    expect(PLANS.PRO.price).toBe(39)
  })

  it("BUSINESS plan has unlimited customers", () => {
    expect(PLANS.BUSINESS.customerLimit).toBe(Infinity)
    expect(PLANS.BUSINESS.staffLimit).toBe(15)
    expect(PLANS.BUSINESS.price).toBe(79)
  })

  it("ENTERPRISE plan has unlimited everything", () => {
    expect(PLANS.ENTERPRISE.customerLimit).toBe(Infinity)
    expect(PLANS.ENTERPRISE.staffLimit).toBe(Infinity)
    expect(PLANS.ENTERPRISE.price).toBeNull()
  })
})

describe("getPlanLimits", () => {
  it("returns correct limits for STARTER plan", () => {
    const limits = getPlanLimits("STARTER")
    expect(limits).toEqual({ customerLimit: 200, staffLimit: 2 })
  })

  it("returns correct limits for PRO plan", () => {
    const limits = getPlanLimits("PRO")
    expect(limits).toEqual({ customerLimit: 1_000, staffLimit: 5 })
  })

  it("returns correct limits for BUSINESS plan", () => {
    const limits = getPlanLimits("BUSINESS")
    expect(limits).toEqual({ customerLimit: Infinity, staffLimit: 15 })
  })

  it("returns correct limits for ENTERPRISE plan", () => {
    const limits = getPlanLimits("ENTERPRISE")
    expect(limits).toEqual({ customerLimit: Infinity, staffLimit: Infinity })
  })
})

describe("isUpgrade", () => {
  it("STARTER → PRO is an upgrade", () => {
    expect(isUpgrade("STARTER", "PRO")).toBe(true)
  })

  it("STARTER → BUSINESS is an upgrade", () => {
    expect(isUpgrade("STARTER", "BUSINESS")).toBe(true)
  })

  it("STARTER → ENTERPRISE is an upgrade", () => {
    expect(isUpgrade("STARTER", "ENTERPRISE")).toBe(true)
  })

  it("PRO → BUSINESS is an upgrade", () => {
    expect(isUpgrade("PRO", "BUSINESS")).toBe(true)
  })

  it("BUSINESS → ENTERPRISE is an upgrade", () => {
    expect(isUpgrade("BUSINESS", "ENTERPRISE")).toBe(true)
  })

  it("same plan is NOT an upgrade", () => {
    expect(isUpgrade("STARTER", "STARTER")).toBe(false)
    expect(isUpgrade("PRO", "PRO")).toBe(false)
  })

  it("downgrade is NOT an upgrade", () => {
    expect(isUpgrade("PRO", "STARTER")).toBe(false)
    expect(isUpgrade("ENTERPRISE", "STARTER")).toBe(false)
    expect(isUpgrade("BUSINESS", "PRO")).toBe(false)
  })
})

describe("getPlanForPriceLookupKey", () => {
  it("maps starter_monthly to STARTER", () => {
    expect(getPlanForPriceLookupKey("starter_monthly")).toBe("STARTER")
  })

  it("maps pro_monthly to PRO", () => {
    expect(getPlanForPriceLookupKey("pro_monthly")).toBe("PRO")
  })

  it("maps business_monthly to BUSINESS", () => {
    expect(getPlanForPriceLookupKey("business_monthly")).toBe("BUSINESS")
  })

  it("returns STARTER for unknown lookup keys", () => {
    expect(getPlanForPriceLookupKey("unknown")).toBe("STARTER")
    expect(getPlanForPriceLookupKey("")).toBe("STARTER")
  })
})

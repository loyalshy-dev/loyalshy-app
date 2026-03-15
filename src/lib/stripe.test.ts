import { describe, it, expect } from "vitest"
import {
  getPlanLimits,
  isUpgrade,
  getPlanForPriceLookupKey,
  PLANS,
  type PlanId,
} from "./stripe"

describe("PLANS", () => {
  it("defines all five plans", () => {
    expect(Object.keys(PLANS)).toEqual(["FREE", "STARTER", "GROWTH", "SCALE", "ENTERPRISE"])
  })

  it("FREE plan has correct limits", () => {
    expect(PLANS.FREE.customerLimit).toBe(50)
    expect(PLANS.FREE.staffLimit).toBe(1)
    expect(PLANS.FREE.programLimit).toBe(1)
    expect(PLANS.FREE.price).toBe(0)
  })

  it("STARTER plan has correct limits", () => {
    expect(PLANS.STARTER.customerLimit).toBe(500)
    expect(PLANS.STARTER.staffLimit).toBe(2)
    expect(PLANS.STARTER.programLimit).toBe(2)
    expect(PLANS.STARTER.price).toBe(29)
  })

  it("GROWTH plan has correct limits", () => {
    expect(PLANS.GROWTH.customerLimit).toBe(2_500)
    expect(PLANS.GROWTH.staffLimit).toBe(5)
    expect(PLANS.GROWTH.programLimit).toBe(5)
    expect(PLANS.GROWTH.price).toBe(49)
  })

  it("SCALE plan has unlimited customers", () => {
    expect(PLANS.SCALE.customerLimit).toBe(Infinity)
    expect(PLANS.SCALE.staffLimit).toBe(25)
    expect(PLANS.SCALE.programLimit).toBe(Infinity)
    expect(PLANS.SCALE.price).toBe(99)
  })

  it("ENTERPRISE plan has unlimited everything", () => {
    expect(PLANS.ENTERPRISE.customerLimit).toBe(Infinity)
    expect(PLANS.ENTERPRISE.staffLimit).toBe(Infinity)
    expect(PLANS.ENTERPRISE.programLimit).toBe(Infinity)
    expect(PLANS.ENTERPRISE.price).toBeNull()
  })
})

describe("getPlanLimits", () => {
  it("returns correct limits for STARTER plan", () => {
    const limits = getPlanLimits("STARTER")
    expect(limits).toEqual({ customerLimit: 500, staffLimit: 2, programLimit: 2 })
  })

  it("returns correct limits for GROWTH plan", () => {
    const limits = getPlanLimits("GROWTH")
    expect(limits).toEqual({ customerLimit: 2_500, staffLimit: 5, programLimit: 5 })
  })

  it("returns correct limits for SCALE plan", () => {
    const limits = getPlanLimits("SCALE")
    expect(limits).toEqual({ customerLimit: Infinity, staffLimit: 25, programLimit: Infinity })
  })

  it("returns correct limits for ENTERPRISE plan", () => {
    const limits = getPlanLimits("ENTERPRISE")
    expect(limits).toEqual({ customerLimit: Infinity, staffLimit: Infinity, programLimit: Infinity })
  })
})

describe("isUpgrade", () => {
  it("STARTER → GROWTH is an upgrade", () => {
    expect(isUpgrade("STARTER", "GROWTH")).toBe(true)
  })

  it("STARTER → SCALE is an upgrade", () => {
    expect(isUpgrade("STARTER", "SCALE")).toBe(true)
  })

  it("STARTER → ENTERPRISE is an upgrade", () => {
    expect(isUpgrade("STARTER", "ENTERPRISE")).toBe(true)
  })

  it("GROWTH → SCALE is an upgrade", () => {
    expect(isUpgrade("GROWTH", "SCALE")).toBe(true)
  })

  it("SCALE → ENTERPRISE is an upgrade", () => {
    expect(isUpgrade("SCALE", "ENTERPRISE")).toBe(true)
  })

  it("same plan is NOT an upgrade", () => {
    expect(isUpgrade("STARTER", "STARTER")).toBe(false)
    expect(isUpgrade("GROWTH", "GROWTH")).toBe(false)
  })

  it("downgrade is NOT an upgrade", () => {
    expect(isUpgrade("GROWTH", "STARTER")).toBe(false)
    expect(isUpgrade("ENTERPRISE", "STARTER")).toBe(false)
    expect(isUpgrade("SCALE", "GROWTH")).toBe(false)
  })
})

describe("getPlanForPriceLookupKey", () => {
  it("maps starter_monthly to STARTER", () => {
    expect(getPlanForPriceLookupKey("starter_monthly")).toBe("STARTER")
  })

  it("maps starter_annual to STARTER", () => {
    expect(getPlanForPriceLookupKey("starter_annual")).toBe("STARTER")
  })

  it("maps growth_monthly to GROWTH", () => {
    expect(getPlanForPriceLookupKey("growth_monthly")).toBe("GROWTH")
  })

  it("maps growth_annual to GROWTH", () => {
    expect(getPlanForPriceLookupKey("growth_annual")).toBe("GROWTH")
  })

  it("maps scale_monthly to SCALE", () => {
    expect(getPlanForPriceLookupKey("scale_monthly")).toBe("SCALE")
  })

  it("maps scale_annual to SCALE", () => {
    expect(getPlanForPriceLookupKey("scale_annual")).toBe("SCALE")
  })

  it("returns STARTER for unknown lookup keys", () => {
    expect(getPlanForPriceLookupKey("unknown")).toBe("STARTER")
    expect(getPlanForPriceLookupKey("")).toBe("STARTER")
  })
})

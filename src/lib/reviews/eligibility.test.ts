import { describe, it, expect } from "vitest"
import { isReviewEligiblePass, reviewVisitCount } from "./eligibility"

const coupon = (redemptionLimit: "single" | "unlimited") => ({
  redemptionLimit,
  discountType: "percentage",
  discountValue: 10,
})

describe("review eligibility", () => {
  it("stamp cards and unlimited coupons can ask; single-use coupons can't", () => {
    expect(isReviewEligiblePass("STAMP_CARD", {})).toBe(true)
    expect(isReviewEligiblePass("COUPON", coupon("unlimited"))).toBe(true)
    expect(isReviewEligiblePass("COUPON", coupon("single"))).toBe(false)
    expect(isReviewEligiblePass("COUPON", {})).toBe(false)
  })

  it("counts stamps on stamp cards and redemptions on unlimited coupons", () => {
    expect(reviewVisitCount({ passType: "STAMP_CARD", templateConfig: {}, data: { totalVisits: 4, redeemCount: 9 } })).toBe(4)
    expect(reviewVisitCount({ passType: "COUPON", templateConfig: coupon("unlimited"), data: { totalVisits: 9, redeemCount: 2 } })).toBe(2)
    expect(reviewVisitCount({ passType: "COUPON", templateConfig: coupon("unlimited"), data: {} })).toBe(0)
    expect(reviewVisitCount({ passType: "COUPON", templateConfig: coupon("single"), data: { redeemCount: 1 } })).toBeNull()
  })
})

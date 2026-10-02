import { parseCouponConfig } from "@/lib/pass-config"

// Which passes can ask for a review, and what counts as a "visit" for the
// org's trigger: stamps on a stamp card, redemptions on an UNLIMITED coupon
// (redeemed on every visit, the pass stays active). Single-use coupons are
// out — once redeemed the pass is voided (Apple) / COMPLETED (Google), so a
// prompt 90 min later would land on a dead pass.

export function isReviewEligiblePass(passType: string | null | undefined, templateConfig: unknown): boolean {
  if (!passType || passType === "STAMP_CARD") return true
  if (passType === "COUPON") return parseCouponConfig(templateConfig)?.redemptionLimit === "unlimited"
  return false
}

/** Visits so far on an eligible pass, or null when the pass can't ask for a review. */
export function reviewVisitCount(pass: {
  passType: string | null | undefined
  templateConfig: unknown
  data: unknown
}): number | null {
  if (!isReviewEligiblePass(pass.passType, pass.templateConfig)) return null
  const data = (pass.data ?? {}) as Record<string, unknown>
  const raw = pass.passType === "COUPON" ? data.redeemCount : data.totalVisits
  return typeof raw === "number" ? raw : 0
}

import { Stamp, Ticket, Crown } from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ─── Program Type ────────────────────────────────────────────

export type ProgramType = "STAMP_CARD" | "COUPON" | "MEMBERSHIP"

// ─── Type-specific configs (stored in LoyaltyProgram.config JSON) ───

export type CouponConfig = {
  discountType: "percentage" | "fixed" | "freebie"
  discountValue: number
  couponDescription?: string
  validUntil?: string // ISO date
  redemptionLimit: "single" | "unlimited"
  couponCode?: string
  terms?: string
}

export type MembershipConfig = {
  membershipTier: string
  benefits: string
  validDuration: "monthly" | "yearly" | "lifetime" | "custom"
  customDurationDays?: number
  terms?: string
}

// ─── Program type metadata ──────────────────────────────────

export type ProgramTypeMeta = {
  label: string
  shortLabel: string
  icon: LucideIcon
  description: string
  defaultCardType: "STAMP" | "COUPON" | "POINTS" | "TIER"
}

export const PROGRAM_TYPE_META: Record<ProgramType, ProgramTypeMeta> = {
  STAMP_CARD: {
    label: "Stamp Card",
    shortLabel: "Stamp",
    icon: Stamp,
    description: "Reward customers after a set number of visits",
    defaultCardType: "STAMP",
  },
  COUPON: {
    label: "Coupon / Voucher",
    shortLabel: "Coupon",
    icon: Ticket,
    description: "Offer discounts or free items customers can redeem",
    defaultCardType: "COUPON",
  },
  MEMBERSHIP: {
    label: "Membership Card",
    shortLabel: "Membership",
    icon: Crown,
    description: "Exclusive membership with ongoing perks and benefits",
    defaultCardType: "TIER",
  },
}

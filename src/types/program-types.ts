import { Stamp, Ticket, Crown, Coins, CreditCard } from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ─── Program Type ────────────────────────────────────────────

export type ProgramType = "STAMP_CARD" | "COUPON" | "MEMBERSHIP" | "POINTS" | "PREPAID"

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
  autoRenew?: boolean
  terms?: string
}

export type PointsCatalogItem = {
  id: string
  name: string
  description?: string
  pointsCost: number
}

export type PointsConfig = {
  pointsPerVisit: number
  catalog: PointsCatalogItem[]
}

export type PrepaidConfig = {
  totalUses: number
  useLabel: string // "ride", "wash", "session", "class", "visit"
  rechargeable: boolean
  rechargeAmount?: number
  validUntil?: string // ISO date
  terms?: string
}

// ─── Program type metadata ──────────────────────────────────

export type ProgramTypeMeta = {
  label: string
  shortLabel: string
  icon: LucideIcon
  description: string
  defaultCardType: "STAMP" | "COUPON" | "POINTS" | "TIER" | "PREPAID"
}

// ─── Minigame config (stored in LoyaltyProgram.config JSON) ───

export type MinigameType = "scratch" | "slots" | "wheel"
export type PrizeItem = { name: string; weight: number }
export type MinigameConfig = { enabled: boolean; gameType: MinigameType; prizes?: PrizeItem[]; primaryColor?: string; accentColor?: string }

// ─── Program type metadata ──────────────────────────────────

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
    description: "Digital ID card for gyms, clubs, libraries, and more",
    defaultCardType: "TIER",
  },
  POINTS: {
    label: "Points Program",
    shortLabel: "Points",
    icon: Coins,
    description: "Earn points per visit, redeem from a reward catalog",
    defaultCardType: "POINTS",
  },
  PREPAID: {
    label: "Prepaid Pass",
    shortLabel: "Prepaid",
    icon: CreditCard,
    description: "Fixed uses that count down — bus pass, car wash, class pack",
    defaultCardType: "PREPAID",
  },
}

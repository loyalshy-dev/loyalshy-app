import { Stamp, Ticket } from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ─── Pass Type ──────────────────────────────────────────────

export type PassType = "STAMP_CARD" | "COUPON"

// ─── Type-specific configs (stored in PassTemplate.config JSON) ───

export type StampCardConfig = {
  stampsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
  minigame?: MinigameConfig
}

export type CouponConfig = {
  discountType: "percentage" | "fixed" | "freebie"
  discountValue: number
  couponCode?: string
  couponDescription?: string
  validUntil?: string // ISO date
  redemptionLimit: "single" | "unlimited"
  terms?: string
  minigame?: MinigameConfig
}

export type PassTemplateConfig = StampCardConfig | CouponConfig

// ─── Minigame config ────────────────────────────────────────

export type MinigameType = "scratch" | "slots" | "wheel"
export type PrizeItem = { name: string; weight: number }
export type MinigameConfig = {
  enabled: boolean
  gameType: MinigameType
  prizes?: PrizeItem[]
  primaryColor?: string
  accentColor?: string
}

// ─── Pass type metadata ─────────────────────────────────────

export type DesignCardType = "STAMP" | "COUPON"

export type PassTypeMeta = {
  label: string
  shortLabel: string
  icon: LucideIcon
  description: string
  defaultCardType: DesignCardType
  image: string | null
}

export const PASS_TYPE_META: Record<PassType, PassTypeMeta> = {
  STAMP_CARD: {
    label: "Stamp Card",
    shortLabel: "Stamp",
    icon: Stamp,
    description: "Reward contacts after a set number of visits",
    defaultCardType: "STAMP",
    image: "/pass-types/stamp-apple.webp",
  },
  COUPON: {
    label: "Coupon / Voucher",
    shortLabel: "Coupon",
    icon: Ticket,
    description: "Offer discounts or free items contacts can redeem",
    defaultCardType: "COUPON",
    image: "/pass-types/coupon-google.webp",
  },
}

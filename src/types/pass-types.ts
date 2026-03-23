import {
  Stamp,
  Ticket,
  Crown,
  Coins,
  Gift,
  CalendarDays,
  ContactRound,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ─── Pass Type ──────────────────────────────────────────────

export type PassType =
  | "STAMP_CARD"
  | "COUPON"
  | "MEMBERSHIP"
  | "POINTS"
  | "GIFT_CARD"
  | "TICKET"
  | "BUSINESS_CARD"

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

export type MembershipConfig = {
  membershipTier: string
  benefits: string
  validDuration: "monthly" | "yearly" | "lifetime" | "custom"
  customDurationDays?: number
  autoRenew?: boolean
  showHolderPhoto?: boolean
  holderPhotoPosition?: "left" | "center" | "right"
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
  pointsLabel?: string
}

export type GiftCardConfig = {
  currency: string
  initialBalanceCents: number
  partialRedemption: boolean
  expiryMonths?: number
}

export type TicketConfig = {
  eventName: string
  eventDate: string // ISO date
  eventVenue: string
  barcodeType: "qr" | "code128" | "pdf417" | "aztec"
  maxScans: number
}

export type BusinessCardConfig = {
  contactName: string
  jobTitle?: string
  phone?: string
  email?: string
  website?: string
  linkedinUrl?: string
  twitterUrl?: string
  instagramUrl?: string
}

export type PassTemplateConfig =
  | StampCardConfig
  | CouponConfig
  | MembershipConfig
  | PointsConfig
  | GiftCardConfig
  | TicketConfig
  | BusinessCardConfig

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

export type DesignCardType =
  | "STAMP"
  | "POINTS"
  | "TIER"
  | "COUPON"
  | "GIFT_CARD"
  | "TICKET"
  | "GENERIC"

export type PassTypeCategory = "loyalty" | "commerce" | "event" | "identity"

export type PassTypeMeta = {
  label: string
  shortLabel: string
  icon: LucideIcon
  description: string
  defaultCardType: DesignCardType
  category: PassTypeCategory
}

export const PASS_TYPE_META: Record<PassType, PassTypeMeta> = {
  STAMP_CARD: {
    label: "Stamp Card",
    shortLabel: "Stamp",
    icon: Stamp,
    description: "Reward contacts after a set number of visits",
    defaultCardType: "STAMP",
    category: "loyalty",
  },
  COUPON: {
    label: "Coupon / Voucher",
    shortLabel: "Coupon",
    icon: Ticket,
    description: "Offer discounts or free items contacts can redeem",
    defaultCardType: "COUPON",
    category: "loyalty",
  },
  MEMBERSHIP: {
    label: "Membership Card",
    shortLabel: "Membership",
    icon: Crown,
    description: "Digital ID card for gyms, clubs, libraries, and more",
    defaultCardType: "TIER",
    category: "identity",
  },
  POINTS: {
    label: "Points Program",
    shortLabel: "Points",
    icon: Coins,
    description: "Earn points per visit, redeem from a reward catalog",
    defaultCardType: "POINTS",
    category: "loyalty",
  },
  GIFT_CARD: {
    label: "Gift Card",
    shortLabel: "Gift Card",
    icon: Gift,
    description: "Stored-value card with balance tracking",
    defaultCardType: "GIFT_CARD",
    category: "commerce",
  },
  TICKET: {
    label: "Event Ticket",
    shortLabel: "Ticket",
    icon: CalendarDays,
    description: "Digital ticket for events, concerts, conferences",
    defaultCardType: "TICKET",
    category: "event",
  },
  BUSINESS_CARD: {
    label: "Business Card",
    shortLabel: "Card",
    icon: ContactRound,
    description: "Digital business card for Apple & Google Wallet",
    defaultCardType: "GENERIC",
    category: "identity",
  },
}

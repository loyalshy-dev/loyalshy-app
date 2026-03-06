import {
  Stamp,
  Ticket,
  Crown,
  Coins,
  CreditCard,
  Gift,
  CalendarDays,
  ShieldCheck,
  Bus,
  BadgeCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ─── Pass Type ──────────────────────────────────────────────

export type PassType =
  | "STAMP_CARD"
  | "COUPON"
  | "MEMBERSHIP"
  | "POINTS"
  | "PREPAID"
  | "GIFT_CARD"
  | "TICKET"
  | "ACCESS"
  | "TRANSIT"
  | "BUSINESS_ID"

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

export type PrepaidConfig = {
  totalUses: number
  useLabel: string
  rechargeable: boolean
  rechargeAmount?: number
  validUntil?: string
  terms?: string
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

export type AccessConfig = {
  accessLabel: string
  validDays?: string[] // e.g. ["mon","tue","wed"]
  validTimeStart?: string // HH:mm
  validTimeEnd?: string // HH:mm
  validDuration: "monthly" | "yearly" | "lifetime" | "custom"
  customDurationDays?: number
  maxDailyUses?: number
}

export type TransitConfig = {
  transitType: "bus" | "train" | "ferry" | "flight" | "other"
  originName?: string
  destinationName?: string
  departureDateTime?: string // ISO datetime
  barcodeType: "qr" | "code128" | "pdf417" | "aztec"
}

export type BusinessIdConfig = {
  idLabel: string // e.g. "Employee ID", "Student ID"
  showTitle?: boolean
  showPhoto?: boolean
  showEmployeeId?: boolean
  validDuration: "monthly" | "yearly" | "lifetime" | "custom"
  customDurationDays?: number
}

export type PassTemplateConfig =
  | StampCardConfig
  | CouponConfig
  | MembershipConfig
  | PointsConfig
  | PrepaidConfig
  | GiftCardConfig
  | TicketConfig
  | AccessConfig
  | TransitConfig
  | BusinessIdConfig

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
  | "PREPAID"
  | "GENERIC"

export type PassTypeMeta = {
  label: string
  shortLabel: string
  icon: LucideIcon
  description: string
  defaultCardType: DesignCardType
  category: "loyalty" | "commerce" | "event" | "identity"
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
  PREPAID: {
    label: "Prepaid Pass",
    shortLabel: "Prepaid",
    icon: CreditCard,
    description: "Fixed uses that count down — bus pass, car wash, class pack",
    defaultCardType: "PREPAID",
    category: "commerce",
  },
  GIFT_CARD: {
    label: "Gift Card",
    shortLabel: "Gift Card",
    icon: Gift,
    description: "Stored-value card with balance tracking",
    defaultCardType: "GENERIC",
    category: "commerce",
  },
  TICKET: {
    label: "Event Ticket",
    shortLabel: "Ticket",
    icon: CalendarDays,
    description: "Digital ticket for events, concerts, conferences",
    defaultCardType: "GENERIC",
    category: "event",
  },
  ACCESS: {
    label: "Access Pass",
    shortLabel: "Access",
    icon: ShieldCheck,
    description: "Grant access to facilities, co-working spaces, parking",
    defaultCardType: "GENERIC",
    category: "event",
  },
  TRANSIT: {
    label: "Transit Pass",
    shortLabel: "Transit",
    icon: Bus,
    description: "Boarding passes for buses, trains, ferries, flights",
    defaultCardType: "GENERIC",
    category: "event",
  },
  BUSINESS_ID: {
    label: "Business ID",
    shortLabel: "ID",
    icon: BadgeCheck,
    description: "Employee, student, or contractor identification card",
    defaultCardType: "GENERIC",
    category: "identity",
  },
}

import type { PassInstanceStatus, WalletProvider, TemplateStatus, PassType } from "@prisma/client"
import type { DesignCardType } from "./pass-types"

// ─── Type-specific state (stored in PassInstance.data JSON) ──

export type StampCardData = {
  currentCycleVisits: number
  totalVisits: number
  totalRewardsEarned: number
}

export type CouponData = {
  redeemed: boolean
  redeemedAt?: string // ISO datetime
  selectedPrize?: string
}

export type MembershipData = {
  totalCheckIns: number
  lastCheckInAt?: string // ISO datetime
  memberSince: string // ISO datetime
  tier: string
  benefits: string
  holderPhotoUrl?: string
}

export type PointsData = {
  pointsBalance: number
  totalPointsEarned: number
  totalPointsSpent: number
}

export type GiftCardData = {
  currency: string
  balanceCents: number
  initialBalanceCents: number
  totalChargedCents: number
}

export type TicketData = {
  scanCount: number
  firstScannedAt?: string // ISO datetime
  lastScannedAt?: string // ISO datetime
  voidedAt?: string // ISO datetime
}

export type BusinessCardData = {
  addedToWalletAt?: string // ISO datetime
}

export type PassInstanceData =
  | StampCardData
  | CouponData
  | MembershipData
  | PointsData
  | GiftCardData
  | TicketData
  | BusinessCardData

// ─── Pass design snapshot (shared across instance types) ─────

export type PassInstanceDesign = {
  cardType: DesignCardType
  primaryColor: string | null
  secondaryColor: string | null
  textColor: string | null
  showStrip: boolean
  patternStyle: string
  progressStyle: string
  labelFormat: string
  customProgressLabel: string | null
  stripImageUrl: string | null
  editorConfig?: unknown
  logoUrl?: string | null
  logoAppleUrl?: string | null
  logoGoogleUrl?: string | null
} | null

// ─── Summary (used in lists and search results) ─────────────

export type PassInstanceSummary = {
  passInstanceId: string
  templateId: string
  templateName: string
  passType: PassType
  data: PassInstanceData
  templateConfig?: unknown
  status: PassInstanceStatus
  walletProvider: WalletProvider
  passDesign: PassInstanceDesign
  minigameConfig?: {
    enabled: boolean
    gameType: "scratch" | "slots" | "wheel"
    prizes?: { name: string; weight: number }[]
    primaryColor?: string
    accentColor?: string
  } | null
}

// ─── Detail (used in contact detail sheet) ───────────────────

export type PassInstanceDetail = {
  passInstanceId: string
  templateId: string
  templateName: string
  passType: PassType
  templateConfig?: unknown
  templateStatus: TemplateStatus
  data: PassInstanceData
  status: PassInstanceStatus
  walletProvider: WalletProvider
  issuedAt: Date
  expiresAt: Date | null
  suspendedAt: Date | null
  revokedAt: Date | null
  passDesign: PassInstanceDesign
  hasAvailableReward: boolean
  rewardDescription: string | null
}

// ─── Template with PassDesign (for settings) ─────────────────

export type TemplateWithDesign = {
  id: string
  name: string
  passType: PassType
  description: string | null
  config: unknown
  status: TemplateStatus
  startsAt: Date
  endsAt: Date | null
  termsAndConditions: string | null
  passInstanceCount: number
  passDesign: {
    cardType: string
    showStrip: boolean
    primaryColor: string | null
    secondaryColor: string | null
    textColor: string | null
    stripImageUrl: string | null
    patternStyle: string
    progressStyle: string
    fontFamily: string
    labelFormat: string
    customProgressLabel: string | null
    customMessage: string | null
    designHash: string
  } | null
}

// ─── Public template info (for join page) ────────────────────

export type PublicTemplateInfo = {
  id: string
  name: string
  passType: PassType
  description: string | null
  config: unknown
  passDesign: {
    cardType: string
    showStrip: boolean
    primaryColor: string | null
    secondaryColor: string | null
    textColor: string | null
    stripImageUrl: string | null
    patternStyle: string
    progressStyle: string
    fontFamily: string
    labelFormat: string
    customProgressLabel: string | null
    customMessage: string | null
    editorConfig?: unknown
    logoUrl?: string | null
    logoAppleUrl?: string | null
    logoGoogleUrl?: string | null
  } | null
}

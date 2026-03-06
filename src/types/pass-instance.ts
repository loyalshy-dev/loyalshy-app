import type { PassInstanceStatus, WalletProvider, TemplateStatus } from "@prisma/client"
import type { DesignCardType } from "./pass-types"

// ─── Type-specific state (stored in PassInstance.data JSON) ──

export type StampCardData = {
  currentCycleStamps: number
  totalStamps: number
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
}

export type PointsData = {
  pointsBalance: number
  totalPointsEarned: number
  totalPointsSpent: number
}

export type PrepaidData = {
  remainingUses: number
  totalUsed: number
  lastUsedAt?: string // ISO datetime
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

export type AccessData = {
  totalGranted: number
  totalDenied: number
  lastGrantedAt?: string // ISO datetime
  todayGranted: number
  todayDate?: string // YYYY-MM-DD
}

export type TransitData = {
  boardedAt?: string // ISO datetime
  exitedAt?: string // ISO datetime
  isBoarded: boolean
}

export type BusinessIdData = {
  totalVerifications: number
  lastVerifiedAt?: string // ISO datetime
  title?: string
  department?: string
  photoUrl?: string
}

export type PassInstanceData =
  | StampCardData
  | CouponData
  | MembershipData
  | PointsData
  | PrepaidData
  | GiftCardData
  | TicketData
  | AccessData
  | TransitData
  | BusinessIdData

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
} | null

// ─── Summary (used in lists and search results) ─────────────

export type PassInstanceSummary = {
  passInstanceId: string
  templateId: string
  templateName: string
  passType: string
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
  passType: string
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
}

// ─── Template with PassDesign (for settings) ─────────────────

export type TemplateWithDesign = {
  id: string
  name: string
  passType: string
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
  passType: string
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
  } | null
}

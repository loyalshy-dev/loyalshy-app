import type { WalletPassType, EnrollmentStatus, ProgramStatus } from "@prisma/client"

// ─── Card design snapshot (shared across enrollment types) ───

export type EnrollmentCardDesign = {
  cardType: string
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

export type EnrollmentSummary = {
  enrollmentId: string
  programId: string
  programName: string
  programType: string
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  pointsBalance?: number
  remainingUses?: number
  programConfig?: unknown
  status: EnrollmentStatus
  walletPassType: WalletPassType
  cardDesign: EnrollmentCardDesign
  minigameConfig: { enabled: boolean; gameType: "scratch" | "slots" | "wheel"; prizes?: { name: string; weight: number }[]; primaryColor?: string; accentColor?: string } | null
}

// ─── Detail (used in customer detail sheet) ──────────────────

export type EnrollmentDetail = {
  enrollmentId: string
  programId: string
  programName: string
  programType: string
  programConfig?: unknown
  programStatus: ProgramStatus
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  pointsBalance?: number
  remainingUses?: number
  totalRewardsRedeemed: number
  rewardDescription: string
  status: EnrollmentStatus
  walletPassType: WalletPassType
  enrolledAt: Date
  frozenAt: Date | null
  suspendedAt: Date | null
  expiresAt: Date | null
  cardDesign: EnrollmentCardDesign
}

// ─── Program with CardDesign (for settings) ──────────────────

export type ProgramWithDesign = {
  id: string
  name: string
  programType: string
  visitsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
  config: unknown
  status: ProgramStatus
  startsAt: Date
  endsAt: Date | null
  termsAndConditions: string | null
  enrollmentCount: number
  cardDesign: {
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

// ─── Public program info (for join page) ─────────────────────

export type PublicProgramInfo = {
  id: string
  name: string
  programType: string
  visitsRequired: number
  rewardDescription: string
  config: unknown
  cardDesign: {
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

import type { WalletPassType, EnrollmentStatus, ProgramStatus } from "@prisma/client"

// ─── Summary (used in lists and search results) ─────────────

export type EnrollmentSummary = {
  enrollmentId: string
  programId: string
  programName: string
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  status: EnrollmentStatus
  walletPassType: WalletPassType
}

// ─── Detail (used in customer detail sheet) ──────────────────

export type EnrollmentDetail = {
  enrollmentId: string
  programId: string
  programName: string
  programStatus: ProgramStatus
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  totalRewardsRedeemed: number
  rewardDescription: string
  status: EnrollmentStatus
  walletPassType: WalletPassType
  enrolledAt: Date
  frozenAt: Date | null
}

// ─── Program with CardDesign (for settings) ──────────────────

export type ProgramWithDesign = {
  id: string
  name: string
  visitsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
  status: ProgramStatus
  startsAt: Date
  endsAt: Date | null
  termsAndConditions: string | null
  enrollmentCount: number
  cardDesign: {
    shape: string
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
  visitsRequired: number
  rewardDescription: string
  cardDesign: {
    shape: string
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
  } | null
}

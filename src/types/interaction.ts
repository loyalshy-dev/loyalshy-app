// ─── Interaction Types ──────────────────────────────────────

export type InteractionTypeName =
  // Loyalty
  | "STAMP"
  | "COUPON_REDEEM"
  | "CHECK_IN"
  | "POINTS_EARN"
  | "POINTS_REDEEM"
  | "PREPAID_USE"
  | "PREPAID_RECHARGE"
  // Gift card
  | "GIFT_CHARGE"
  | "GIFT_REFUND"
  // Ticket
  | "TICKET_SCAN"
  | "TICKET_VOID"
  // Access
  | "ACCESS_GRANT"
  | "ACCESS_DENY"
  // Transit
  | "TRANSIT_BOARD"
  | "TRANSIT_EXIT"
  // Business ID
  | "ID_VERIFY"
  // Generic
  | "STATUS_CHANGE"
  | "REWARD_EARNED"
  | "REWARD_REDEEMED"
  | "NOTE"

// ─── Interaction metadata shapes ────────────────────────────

export type StampMetadata = {
  stampNumber: number
  cycleStamps: number
  totalStamps: number
}

export type CouponRedeemMetadata = {
  discountType: string
  discountValue: number
  couponCode?: string
}

export type CheckInMetadata = {
  checkInNumber: number
}

export type PointsEarnMetadata = {
  pointsEarned: number
  newBalance: number
  reason?: string
}

export type PointsRedeemMetadata = {
  pointsSpent: number
  newBalance: number
  rewardName: string
  rewardId?: string
}

export type PrepaidUseMetadata = {
  usesConsumed: number
  remainingUses: number
}

export type PrepaidRechargeMetadata = {
  usesAdded: number
  newRemainingUses: number
}

export type GiftChargeMetadata = {
  amountCents: number
  newBalanceCents: number
  reference?: string
}

export type GiftRefundMetadata = {
  amountCents: number
  newBalanceCents: number
  reason?: string
}

export type TicketScanMetadata = {
  scanNumber: number
  location?: string
}

export type TicketVoidMetadata = {
  reason?: string
}

export type AccessGrantMetadata = {
  location?: string
  todayCount: number
}

export type AccessDenyMetadata = {
  reason: string
  location?: string
}

export type TransitBoardMetadata = {
  origin?: string
  destination?: string
  vehicleId?: string
}

export type TransitExitMetadata = {
  origin?: string
  destination?: string
}

export type IdVerifyMetadata = {
  verifiedBy?: string
  location?: string
}

export type StatusChangeMetadata = {
  fromStatus: string
  toStatus: string
  reason?: string
}

export type RewardEarnedMetadata = {
  rewardId: string
  description?: string
}

export type RewardRedeemedMetadata = {
  rewardId: string
  description?: string
}

export type NoteMetadata = {
  note: string
}

export type InteractionMetadata =
  | StampMetadata
  | CouponRedeemMetadata
  | CheckInMetadata
  | PointsEarnMetadata
  | PointsRedeemMetadata
  | PrepaidUseMetadata
  | PrepaidRechargeMetadata
  | GiftChargeMetadata
  | GiftRefundMetadata
  | TicketScanMetadata
  | TicketVoidMetadata
  | AccessGrantMetadata
  | AccessDenyMetadata
  | TransitBoardMetadata
  | TransitExitMetadata
  | IdVerifyMetadata
  | StatusChangeMetadata
  | RewardEarnedMetadata
  | RewardRedeemedMetadata
  | NoteMetadata

// ─── Interaction type metadata ──────────────────────────────

export type InteractionTypeMeta = {
  label: string
  pastTense: string
  passTypes: string[]
}

export const INTERACTION_TYPE_META: Record<InteractionTypeName, InteractionTypeMeta> = {
  STAMP: { label: "Stamp", pastTense: "Stamped", passTypes: ["STAMP_CARD"] },
  COUPON_REDEEM: { label: "Redeem Coupon", pastTense: "Coupon redeemed", passTypes: ["COUPON"] },
  CHECK_IN: { label: "Check In", pastTense: "Checked in", passTypes: ["MEMBERSHIP"] },
  POINTS_EARN: { label: "Earn Points", pastTense: "Points earned", passTypes: ["POINTS"] },
  POINTS_REDEEM: { label: "Redeem Points", pastTense: "Points redeemed", passTypes: ["POINTS"] },
  PREPAID_USE: { label: "Use Pass", pastTense: "Pass used", passTypes: ["PREPAID"] },
  PREPAID_RECHARGE: { label: "Recharge Pass", pastTense: "Pass recharged", passTypes: ["PREPAID"] },
  GIFT_CHARGE: { label: "Charge", pastTense: "Charged", passTypes: ["GIFT_CARD"] },
  GIFT_REFUND: { label: "Refund", pastTense: "Refunded", passTypes: ["GIFT_CARD"] },
  TICKET_SCAN: { label: "Scan Ticket", pastTense: "Ticket scanned", passTypes: ["TICKET"] },
  TICKET_VOID: { label: "Void Ticket", pastTense: "Ticket voided", passTypes: ["TICKET"] },
  ACCESS_GRANT: { label: "Grant Access", pastTense: "Access granted", passTypes: ["ACCESS"] },
  ACCESS_DENY: { label: "Deny Access", pastTense: "Access denied", passTypes: ["ACCESS"] },
  TRANSIT_BOARD: { label: "Board", pastTense: "Boarded", passTypes: ["TRANSIT"] },
  TRANSIT_EXIT: { label: "Exit", pastTense: "Exited", passTypes: ["TRANSIT"] },
  ID_VERIFY: { label: "Verify ID", pastTense: "ID verified", passTypes: ["BUSINESS_ID"] },
  STATUS_CHANGE: { label: "Status Change", pastTense: "Status changed", passTypes: [] },
  REWARD_EARNED: { label: "Reward Earned", pastTense: "Reward earned", passTypes: [] },
  REWARD_REDEEMED: { label: "Reward Redeemed", pastTense: "Reward redeemed", passTypes: [] },
  NOTE: { label: "Note", pastTense: "Note added", passTypes: [] },
}

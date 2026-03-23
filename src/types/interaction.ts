// ─── Interaction Types ──────────────────────────────────────

export type InteractionTypeName =
  // Loyalty
  | "STAMP"
  | "COUPON_REDEEM"
  | "CHECK_IN"
  | "POINTS_EARN"
  | "POINTS_REDEEM"
  // Gift card
  | "GIFT_CHARGE"
  | "GIFT_REFUND"
  // Ticket
  | "TICKET_SCAN"
  | "TICKET_VOID"
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
  | GiftChargeMetadata
  | GiftRefundMetadata
  | TicketScanMetadata
  | TicketVoidMetadata
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
  GIFT_CHARGE: { label: "Charge", pastTense: "Charged", passTypes: ["GIFT_CARD"] },
  GIFT_REFUND: { label: "Refund", pastTense: "Refunded", passTypes: ["GIFT_CARD"] },
  TICKET_SCAN: { label: "Scan Ticket", pastTense: "Ticket scanned", passTypes: ["TICKET"] },
  TICKET_VOID: { label: "Void Ticket", pastTense: "Ticket voided", passTypes: ["TICKET"] },
  STATUS_CHANGE: { label: "Status Change", pastTense: "Status changed", passTypes: [] },
  REWARD_EARNED: { label: "Reward Earned", pastTense: "Reward earned", passTypes: [] },
  REWARD_REDEEMED: { label: "Reward Redeemed", pastTense: "Reward redeemed", passTypes: [] },
  NOTE: { label: "Note", pastTense: "Note added", passTypes: [] },
}

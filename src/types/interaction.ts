// ─── Interaction Types ──────────────────────────────────────

export type InteractionTypeName =
  // Loyalty
  | "STAMP"
  | "COUPON_REDEEM"
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
  STATUS_CHANGE: { label: "Status Change", pastTense: "Status changed", passTypes: [] },
  REWARD_EARNED: { label: "Reward Earned", pastTense: "Reward earned", passTypes: [] },
  REWARD_REDEEMED: { label: "Reward Redeemed", pastTense: "Reward redeemed", passTypes: [] },
  NOTE: { label: "Note", pastTense: "Note added", passTypes: [] },
}

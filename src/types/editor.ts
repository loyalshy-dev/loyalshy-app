// ─── Card Types ────────────────────────────────────────────

export type CardType = "STAMP" | "POINTS" | "TIER" | "COUPON" | "PREPAID" | "GIFT_CARD" | "TICKET" | "ACCESS" | "TRANSIT" | "BUSINESS_ID" | "GENERIC"

// ─── Studio UI Types ──────────────────────────────────────

export type StudioTool =
  | "program"
  | "colors"
  | "progress"
  | "strip"
  | "logo"
  | "prize"
  | "avatar"
  | "notifications"
  | "details"

export type PreviewFormat = "apple" | "google"

export type DeviceFrame = "iphone" | "pixel" | "minimal" | "none"

export type ColorZone = "background" | "strip" | "text" | "labels" | "logo" | "progress"

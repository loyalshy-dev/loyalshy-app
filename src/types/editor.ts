// ─── Card Types ────────────────────────────────────────────

export type CardType = "STAMP" | "POINTS" | "TIER" | "COUPON" | "PREPAID" | "GIFT_CARD" | "TICKET" | "ACCESS" | "TRANSIT" | "BUSINESS_ID" | "GENERIC"

// ─── Studio UI Types ──────────────────────────────────────

export type StudioTool =
  | "program"
  | "templates"
  | "colors"
  | "progress"
  | "strip"
  | "logo"
  | "details"

export type PreviewFormat = "apple" | "google"

export type DeviceFrame = "iphone" | "pixel" | "minimal" | "none"

// ─── Card Types ────────────────────────────────────────────

export type CardType = "STAMP" | "POINTS" | "TIER" | "COUPON" | "GIFT_CARD" | "TICKET" | "GENERIC"

// ─── Studio UI Types ──────────────────────────────────────

export type StudioTool =
  | "program"
  | "colors"
  | "fields"
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

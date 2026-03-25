// ─── Feature Flags ──────────────────────────────────────────
// Platform-level feature flags for pass types.
// Pass types listed here are hidden from regular users but accessible to admin roles.

import type { PassType } from "@/lib/plans"

/**
 * Pass types that are not yet publicly available.
 * Admin roles bypass this — they can still create and test these types.
 * Remove a type from this array to make it generally available.
 */
export const COMING_SOON_PASS_TYPES: PassType[] = ["BUSINESS_CARD"]

/** Check if a pass type is flagged as coming soon */
export function isComingSoon(passType: PassType): boolean {
  return COMING_SOON_PASS_TYPES.includes(passType)
}

/**
 * Filter out coming-soon pass types from an allowed list.
 * Admin roles should NOT call this — they bypass feature flags.
 */
export function filterAvailablePassTypes(passTypes: PassType[]): PassType[] {
  return passTypes.filter((t) => !COMING_SOON_PASS_TYPES.includes(t))
}

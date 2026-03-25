// ─── Feature Flags ──────────────────────────────────────────
// Platform-level feature flags for pass types.
// Stored in DB (PlatformConfig singleton row), managed via admin panel.
// Pass types listed as disabled are hidden from regular users but accessible to admin roles.

import { cache } from "react"
import { db } from "@/lib/db"
import type { PassType } from "@/lib/plans"

/** Default disabled types — used when no DB row exists yet */
const DEFAULT_DISABLED: PassType[] = ["BUSINESS_CARD"]

/**
 * Fetch disabled pass types from DB (cached per-request).
 * Falls back to DEFAULT_DISABLED if no config row exists.
 */
export const getDisabledPassTypes = cache(async (): Promise<PassType[]> => {
  try {
    const config = await db.platformConfig.findUnique({
      where: { id: "singleton" },
      select: { disabledPassTypes: true },
    })
    if (!config) return DEFAULT_DISABLED
    return config.disabledPassTypes as PassType[]
  } catch {
    // DB not migrated yet or unavailable — use defaults
    return DEFAULT_DISABLED
  }
})

/** Check if a pass type is flagged as coming soon (async — reads DB) */
export async function isComingSoon(passType: PassType): Promise<boolean> {
  const disabled = await getDisabledPassTypes()
  return disabled.includes(passType)
}

/**
 * Kept for static/synchronous contexts where DB isn't available.
 * Prefer getDisabledPassTypes() in server components/actions.
 */
export const COMING_SOON_PASS_TYPES: PassType[] = DEFAULT_DISABLED

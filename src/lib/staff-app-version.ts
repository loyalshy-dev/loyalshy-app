import { withCorsHeaders } from "@/lib/api-cors"
import { problemJson } from "@/lib/api-session"

/**
 * Minimum staff-app version, enforced on GET /api/v1/auth/me (the call the
 * app makes on every launch). Set STAFF_APP_MIN_VERSION (e.g. "1.3.0") in
 * Vercel to force older builds onto the update screen. Unset = no minimum.
 *
 * Builds up to 1.2.0 don't send X-App-Version and are always let through:
 * they treat any non-2xx from /me as an expired session and would sign the
 * staff out on every launch instead of showing an update prompt.
 *
 * STAFF_APP_UPDATE_URL optionally overrides where the update button goes
 * (e.g. a public TestFlight link while the app isn't on the App Store).
 */
export const APP_VERSION_HEADER = "x-app-version"

/** "1.2.0" → [1, 2, 0]; null for anything that isn't dotted numbers. */
export function parseVersion(raw: string | null | undefined): number[] | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!/^\d+(\.\d+){0,3}$/.test(trimmed)) return null
  return trimmed.split(".").map(Number)
}

/** Negative when a < b, 0 when equal (missing parts count as 0), positive when a > b. */
export function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** 426 response for an outdated app, or null when the request may proceed. */
export function checkStaffAppVersion(req: Pick<Request, "headers">) {
  const min = parseVersion(process.env.STAFF_APP_MIN_VERSION)
  if (!min) return null
  const current = parseVersion(req.headers.get(APP_VERSION_HEADER))
  if (!current || compareVersions(current, min) >= 0) return null

  return withCorsHeaders(
    problemJson(426, "Upgrade Required", "This version of the app is no longer supported. Update to continue.", {
      code: "UPGRADE_REQUIRED",
      minVersion: min.join("."),
      updateUrl: process.env.STAFF_APP_UPDATE_URL || null,
    }),
  )
}

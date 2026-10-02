import "server-only"

import { timingSafeEqual } from "crypto"

/**
 * Bearer check for machine-to-machine routes (Vercel cron, Trigger.dev
 * callbacks). Vercel cron sends `Authorization: Bearer $CRON_SECRET`
 * automatically; Trigger.dev tasks send the same secret. No secret
 * configured = every call is refused.
 */
export function isAuthorizedInternalRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get("authorization") ?? ""
  const given = Buffer.from(header, "utf8")
  const expected = Buffer.from(`Bearer ${secret}`, "utf8")
  return given.length === expected.length && timingSafeEqual(given, expected)
}

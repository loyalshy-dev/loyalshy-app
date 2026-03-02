import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { env } from "@/lib/env"

const HMAC_ALGORITHM = "sha256"

/** Sign an enrollment ID to produce a URL-safe signature */
export function signCardAccess(enrollmentId: string): string {
  const hmac = createHmac(HMAC_ALGORITHM, env().BETTER_AUTH_SECRET)
  hmac.update(enrollmentId)
  return hmac.digest("base64url")
}

/** Verify that a signature matches the enrollment ID (timing-safe) */
export function verifyCardSignature(
  enrollmentId: string,
  signature: string
): boolean {
  const expected = signCardAccess(enrollmentId)
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8")
    )
  } catch {
    // Buffers differ in length
    return false
  }
}

/** Build the full card URL path with signature */
export function buildCardUrl(
  restaurantSlug: string,
  enrollmentId: string
): string {
  const sig = signCardAccess(enrollmentId)
  return `/join/${restaurantSlug}/card/${enrollmentId}?sig=${sig}`
}

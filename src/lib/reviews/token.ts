import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { env } from "@/lib/env"

// Review-link token: `{passInstanceId}.{hmac}`. Domain-separated from the
// card-access signature so a /card link signature can't be replayed here.

function sign(passInstanceId: string): string {
  return createHmac("sha256", env().BETTER_AUTH_SECRET)
    .update(`review-link:${passInstanceId}`)
    .digest("base64url")
}

export function createReviewToken(passInstanceId: string): string {
  return `${passInstanceId}.${sign(passInstanceId)}`
}

/** The passInstanceId a token was issued for, or null if it doesn't verify. */
export function verifyReviewToken(token: string): string | null {
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return null
  const passInstanceId = token.slice(0, dot)
  const given = Buffer.from(token.slice(dot + 1), "utf8")
  const expected = Buffer.from(sign(passInstanceId), "utf8")
  if (given.length !== expected.length) return null
  return timingSafeEqual(given, expected) ? passInstanceId : null
}

export function buildReviewLinkUrl(passInstanceId: string): string {
  const base = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"
  return `${base}/r/${createReviewToken(passInstanceId)}`
}

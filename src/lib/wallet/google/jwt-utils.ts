import "server-only"

import { createSign } from "crypto"
import { getServiceAccountKey } from "./credentials"
import { GOOGLE_WALLET_SAVE_BASE } from "./constants"

// ─── JWT Signing ────────────────────────────────────────────

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input
  return buf.toString("base64url")
}

/**
 * Sign a JWT for "Save to Google Wallet" links.
 * Uses RS256 with the service account private key.
 */
export function signJwt(payload: Record<string, unknown>): string {
  const key = getServiceAccountKey()

  const header = {
    alg: "RS256",
    typ: "JWT",
  }

  const now = Math.floor(Date.now() / 1000)
  const origins = process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : ["https://localhost:3000"]

  const fullPayload = {
    iss: key.client_email,
    aud: "google",
    origins,
    typ: "savetowallet",
    iat: now,
    ...payload,
  }

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(fullPayload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const signer = createSign("RSA-SHA256")
  signer.update(signingInput)
  const signature = signer.sign(key.private_key, "base64url")

  return `${signingInput}.${signature}`
}

/**
 * Generate a "Save to Google Wallet" URL from loyalty class/object definitions.
 */
export function buildSaveUrl(
  loyaltyClasses: Record<string, unknown>[],
  loyaltyObjects: Record<string, unknown>[]
): string {
  const jwt = signJwt({
    payload: {
      loyaltyClasses,
      loyaltyObjects,
    },
  })

  return `${GOOGLE_WALLET_SAVE_BASE}/${jwt}`
}

import "server-only"

import { GoogleAuth } from "google-auth-library"

// ─── Types ──────────────────────────────────────────────────

type ServiceAccountKey = {
  client_email: string
  private_key: string
  project_id: string
}

// ─── Parse Service Account Key ──────────────────────────────

let _parsedKey: ServiceAccountKey | null = null

export function getServiceAccountKey(): ServiceAccountKey {
  if (_parsedKey) return _parsedKey

  const keyJson = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY
  if (!keyJson) {
    throw new Error("GOOGLE_WALLET_SERVICE_ACCOUNT_KEY environment variable is not set")
  }

  try {
    _parsedKey = JSON.parse(keyJson) as ServiceAccountKey
  } catch {
    // Try base64 decode first, then parse
    const decoded = Buffer.from(keyJson, "base64").toString("utf-8")
    _parsedKey = JSON.parse(decoded) as ServiceAccountKey
  }

  return _parsedKey
}

// ─── Google Auth Client ─────────────────────────────────────

let _auth: GoogleAuth | null = null

function getAuth(): GoogleAuth {
  if (_auth) return _auth

  const key = getServiceAccountKey()

  _auth = new GoogleAuth({
    credentials: {
      client_email: key.client_email,
      private_key: key.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  })

  return _auth
}

/**
 * Get an OAuth2 access token for Google Wallet API calls.
 * Tokens are cached and auto-refreshed by google-auth-library.
 */
export async function getAccessToken(): Promise<string> {
  const auth = getAuth()
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token
  if (!token) {
    throw new Error("Failed to obtain Google Wallet access token")
  }
  return token
}

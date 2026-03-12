import "server-only"

import crypto from "node:crypto"
import { db } from "@/lib/db"

const KEY_PREFIX = "lsk_live_"

/**
 * Generate a new API key.
 * Returns the full key (show once to user) and values for DB storage.
 */
export function generateApiKey(): {
  fullKey: string
  keyPrefix: string
  keyHash: string
} {
  const randomPart = crypto.randomBytes(36).toString("base64url").slice(0, 48)
  const fullKey = `${KEY_PREFIX}${randomPart}`
  const keyPrefix = fullKey.slice(0, 12) // "lsk_live_a7Bk"
  const keyHash = hashApiKey(fullKey)
  return { fullKey, keyPrefix, keyHash }
}

/** Hash an API key for storage/lookup (SHA-256 hex). */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

/** Validate an API key from a request. Returns org context or null. */
export async function validateApiKey(key: string): Promise<{
  apiKeyId: string
  organizationId: string
  organization: {
    id: string
    name: string
    plan: string
    subscriptionStatus: string
  }
} | null> {
  if (!key.startsWith(KEY_PREFIX)) return null

  const keyHash = hashApiKey(key)

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          plan: true,
          subscriptionStatus: true,
        },
      },
    },
  })

  if (!apiKey) return null

  // Check if revoked
  if (apiKey.revokedAt) return null

  // Check if expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null

  // Update lastUsedAt (debounced: only if > 1 minute since last update)
  const now = new Date()
  if (!apiKey.lastUsedAt || now.getTime() - apiKey.lastUsedAt.getTime() > 60_000) {
    db.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: now } })
      .catch(() => {}) // fire-and-forget
  }

  return {
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    organization: {
      id: apiKey.organization.id,
      name: apiKey.organization.name,
      plan: apiKey.organization.plan,
      subscriptionStatus: apiKey.organization.subscriptionStatus,
    },
  }
}

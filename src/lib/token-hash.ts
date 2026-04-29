import crypto from "node:crypto"

/**
 * Hash a high-entropy token (sha256 hex) for storage in the database.
 *
 * We never store plaintext invitation/pairing tokens — a read-only DB
 * leak (e.g. via a Neon backup compromise) should not hand the attacker
 * live tokens. The plaintext is only ever in transit (email, QR code,
 * deep link); the DB only holds the hash.
 *
 * sha256 is sufficient here because the input has 256 bits of entropy
 * (`crypto.randomBytes(32)`) — there's no offline brute-force risk that
 * a slower KDF would meaningfully slow down.
 */
export function hashToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex")
}

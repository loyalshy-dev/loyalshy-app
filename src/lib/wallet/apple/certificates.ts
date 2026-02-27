import "server-only"

type AppleCertificates = {
  wwdr: Buffer
  signerCert: Buffer
  signerKey: Buffer
  signerKeyPassphrase: string
}

let cached: AppleCertificates | null = null

/**
 * Loads Apple certificates from base64-encoded environment variables.
 * Cached in module scope (singleton per process).
 */
export function getAppleCertificates(): AppleCertificates {
  if (cached) return cached

  const wwdrB64 = process.env.APPLE_WWDR_CERTIFICATE
  if (!wwdrB64) throw new Error("Missing APPLE_WWDR_CERTIFICATE env var")

  const certB64 = process.env.APPLE_PASS_CERTIFICATE
  if (!certB64) throw new Error("Missing APPLE_PASS_CERTIFICATE env var")

  const keyB64 = process.env.APPLE_PASS_KEY
  if (!keyB64) throw new Error("Missing APPLE_PASS_KEY env var")

  const passphrase = process.env.APPLE_PASS_KEY_PASSPHRASE ?? ""

  cached = {
    wwdr: Buffer.from(wwdrB64, "base64"),
    signerCert: Buffer.from(certB64, "base64"),
    signerKey: Buffer.from(keyB64, "base64"),
    signerKeyPassphrase: passphrase,
  }

  return cached
}

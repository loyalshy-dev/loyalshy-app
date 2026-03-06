// Google Wallet pass constants — loaded from environment variables

export const GOOGLE_WALLET_ISSUER_ID =
  process.env.GOOGLE_WALLET_ISSUER_ID ?? ""

export const GOOGLE_WALLET_API_BASE =
  "https://walletobjects.googleapis.com/walletobjects/v1"

export const GOOGLE_WALLET_SAVE_BASE =
  "https://pay.google.com/gp/v/save"

/**
 * Build a class ID in Google Wallet format: {issuerId}.{suffix}
 * Uses organizationId as the default scope.
 */
export function buildClassId(organizationId: string): string {
  return `${GOOGLE_WALLET_ISSUER_ID}.loyalshy-org-${organizationId}`
}

/**
 * Build a per-template class ID in Google Wallet format: {issuerId}.{suffix}
 * Each pass template gets its own Google Wallet class.
 */
export function buildTemplateClassId(templateId: string): string {
  return `${GOOGLE_WALLET_ISSUER_ID}.loyalshy-template-${templateId}`
}

/**
 * Build an object ID in Google Wallet format: {issuerId}.{suffix}
 * Legacy: scoped to contactId.
 */
export function buildObjectId(contactId: string): string {
  return `${GOOGLE_WALLET_ISSUER_ID}.loyalshy-contact-${contactId}`
}

/**
 * Build a pass-instance-scoped object ID in Google Wallet format: {issuerId}.{suffix}
 * Each pass instance gets its own Google Wallet object.
 */
export function buildPassInstanceObjectId(passInstanceId: string): string {
  return `${GOOGLE_WALLET_ISSUER_ID}.loyalshy-pass-${passInstanceId}`
}

// ─── Legacy aliases (for backward compatibility during migration) ────
export const buildProgramClassId = buildTemplateClassId
export const buildEnrollmentObjectId = buildPassInstanceObjectId

// Google Wallet pass constants — loaded from environment variables

export const GOOGLE_WALLET_ISSUER_ID =
  process.env.GOOGLE_WALLET_ISSUER_ID ?? ""

export const GOOGLE_WALLET_API_BASE =
  "https://walletobjects.googleapis.com/walletobjects/v1"

export const GOOGLE_WALLET_SAVE_BASE =
  "https://pay.google.com/gp/v/save"

/**
 * Build a class ID in Google Wallet format: {issuerId}.{suffix}
 * Uses restaurantId as the default scope.
 */
export function buildClassId(restaurantId: string): string {
  return `${GOOGLE_WALLET_ISSUER_ID}.fidelio-restaurant-${restaurantId}`
}

/**
 * Build a per-program class ID in Google Wallet format: {issuerId}.{suffix}
 * Each loyalty program gets its own Google Wallet class.
 */
export function buildProgramClassId(programId: string): string {
  return `${GOOGLE_WALLET_ISSUER_ID}.fidelio-program-${programId}`
}

/**
 * Build an object ID in Google Wallet format: {issuerId}.{suffix}
 * Legacy: scoped to customerId.
 */
export function buildObjectId(customerId: string): string {
  return `${GOOGLE_WALLET_ISSUER_ID}.fidelio-customer-${customerId}`
}

/**
 * Build an enrollment-scoped object ID in Google Wallet format: {issuerId}.{suffix}
 * Each enrollment gets its own Google Wallet object.
 */
export function buildEnrollmentObjectId(enrollmentId: string): string {
  return `${GOOGLE_WALLET_ISSUER_ID}.fidelio-enrollment-${enrollmentId}`
}

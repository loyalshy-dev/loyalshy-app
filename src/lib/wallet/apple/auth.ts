import "server-only"

import { db } from "@/lib/db"

type ApplePassAuthResult = {
  valid: boolean
  enrollmentId: string | null
}

/**
 * Validates the "Authorization: ApplePass <token>" header used by Apple
 * Wallet callbacks. The token is the enrollment's `walletPassId`.
 *
 * Looks up the Enrollment by `walletPassSerialNumber` and verifies the
 * token matches `walletPassId`.
 */
export async function validateApplePassAuth(
  request: Request,
  serialNumber: string
): Promise<ApplePassAuthResult> {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("ApplePass ")) {
    return { valid: false, enrollmentId: null }
  }

  const token = authHeader.slice("ApplePass ".length).trim()
  if (!token) {
    return { valid: false, enrollmentId: null }
  }

  const enrollment = await db.enrollment.findUnique({
    where: { walletPassSerialNumber: serialNumber },
    select: { id: true, walletPassId: true },
  })

  if (!enrollment || enrollment.walletPassId !== token) {
    return { valid: false, enrollmentId: null }
  }

  return { valid: true, enrollmentId: enrollment.id }
}

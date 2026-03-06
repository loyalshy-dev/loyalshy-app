import "server-only"

import { db } from "@/lib/db"

type ApplePassAuthResult = {
  valid: boolean
  passInstanceId: string | null
}

/**
 * Validates the "Authorization: ApplePass <token>" header used by Apple
 * Wallet callbacks. The token is the pass instance's `walletPassId`.
 *
 * Looks up the PassInstance by `walletPassSerialNumber` and verifies the
 * token matches `walletPassId`.
 */
export async function validateApplePassAuth(
  request: Request,
  serialNumber: string
): Promise<ApplePassAuthResult> {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("ApplePass ")) {
    return { valid: false, passInstanceId: null }
  }

  const token = authHeader.slice("ApplePass ".length).trim()
  if (!token) {
    return { valid: false, passInstanceId: null }
  }

  const passInstance = await db.passInstance.findUnique({
    where: { walletPassSerialNumber: serialNumber },
    select: { id: true, walletPassId: true },
  })

  if (!passInstance || passInstance.walletPassId !== token) {
    return { valid: false, passInstanceId: null }
  }

  return { valid: true, passInstanceId: passInstance.id }
}

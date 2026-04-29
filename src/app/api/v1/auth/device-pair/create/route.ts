import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"
import { auth } from "@/lib/auth"
import { hashToken } from "@/lib/token-hash"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * POST /api/v1/auth/device-pair/create
 * Generate a QR pairing token. Requires authenticated web session (cookie).
 * Returns { token, expiresAt, qrData } for the dashboard to display as QR.
 *
 * The DB stores sha256(token); plaintext only ever leaves in the QR payload.
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate via cookie session (this is called from the web dashboard)
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.session?.activeOrganizationId) {
      return withCorsHeaders(
        NextResponse.json({ error: "Not authenticated or no active organization" }, { status: 401 })
      )
    }

    const orgId = session.session.activeOrganizationId
    const userId = session.user.id

    // Verify user is a member of the org
    const member = await db.member.findFirst({
      where: { userId, organizationId: orgId },
    })
    if (!member) {
      return withCorsHeaders(
        NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
      )
    }

    // Generate pairing token (32 bytes = 64 hex chars). Plaintext goes in
    // the QR; only the hash is persisted.
    const plaintextToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    await db.devicePairingToken.create({
      data: {
        organizationId: orgId,
        createdByUserId: userId,
        token: hashToken(plaintextToken),
        expiresAt,
      },
    })

    const siteUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"
    const qrData = `loyalshystaff://pair?token=${plaintextToken}&url=${encodeURIComponent(siteUrl)}`

    return withCorsHeaders(
      NextResponse.json({ token: plaintextToken, expiresAt: expiresAt.toISOString(), qrData })
    )
  } catch (err) {
    console.error("[device-pair/create] error:", err)
    return withCorsHeaders(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    )
  }
}

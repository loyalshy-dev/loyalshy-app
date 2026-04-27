import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"
import { publicFormLimiter } from "@/lib/rate-limit"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * POST /api/v1/auth/device-pair/claim
 * Exchange a pairing token for a session. Called from mobile app after scanning QR.
 * Body: { token: string }
 * No auth required — the pairing token IS the auth.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = publicFormLimiter.check(ip)
    if (!rl.success) {
      return withCorsHeaders(
        NextResponse.json({ error: "Too many requests" }, { status: 429 })
      )
    }

    const body = await req.json().catch(() => null)
    const token = body?.token
    if (!token || typeof token !== "string") {
      return withCorsHeaders(
        NextResponse.json({ error: "token is required" }, { status: 400 })
      )
    }

    // Find and validate pairing token
    const pairing = await db.devicePairingToken.findUnique({
      where: { token },
      select: {
        id: true,
        organizationId: true,
        createdByUserId: true,
        expiresAt: true,
        claimedAt: true,
      },
    })

    if (!pairing) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invalid pairing token" }, { status: 404 })
      )
    }

    if (pairing.claimedAt) {
      return withCorsHeaders(
        NextResponse.json({ error: "Pairing token already used" }, { status: 410 })
      )
    }

    if (pairing.expiresAt < new Date()) {
      return withCorsHeaders(
        NextResponse.json({ error: "Pairing token expired" }, { status: 410 })
      )
    }

    // Atomically claim the token. Two concurrent claims race here; only one
    // gets count === 1. The loser bails before any session is created.
    const claimResult = await db.devicePairingToken.updateMany({
      where: { id: pairing.id, claimedAt: null },
      data: { claimedAt: new Date() },
    })
    if (claimResult.count === 0) {
      return withCorsHeaders(
        NextResponse.json({ error: "Pairing token already used" }, { status: 410 })
      )
    }

    const sessionToken = crypto.randomBytes(32).toString("base64url")
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const [, user] = await Promise.all([
      db.session.create({
        data: {
          token: sessionToken,
          userId: pairing.createdByUserId,
          expiresAt,
          activeOrganizationId: pairing.organizationId,
          ipAddress: ip,
          userAgent: req.headers.get("user-agent"),
        },
      }),
      db.user.findUnique({
        where: { id: pairing.createdByUserId },
        select: { id: true, name: true, email: true, image: true },
      }),
    ])

    // Get org info
    const org = await db.organization.findUnique({
      where: { id: pairing.organizationId },
      select: { id: true, name: true },
    })

    // Get member role
    const member = await db.member.findFirst({
      where: { userId: pairing.createdByUserId, organizationId: pairing.organizationId },
      select: { role: true },
    })

    return withCorsHeaders(
      NextResponse.json({
        token: sessionToken,
        user,
        organizations: [
          { id: org!.id, name: org!.name, role: member?.role ?? "member" },
        ],
      })
    )
  } catch {
    return withCorsHeaders(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    )
  }
}

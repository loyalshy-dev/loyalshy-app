import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"
import { problemJson } from "@/lib/api-session"
import { checkDevicePairClaimLimit } from "@/lib/auth-rate-limit"
import { hashToken } from "@/lib/token-hash"

export function OPTIONS() {
  return handlePreflight()
}

const MAX_PIN_ATTEMPTS = 5
const PIN_PATTERN = /^\d{6}$/

/**
 * POST /api/v1/auth/device-pair/claim
 * Exchange a pairing token + PIN for a session.
 * Body: { token: string, pin: string }
 *
 * Two-factor: the QR carries the token, the PIN is shown beside the QR on
 * the dashboard. A leaked QR alone is useless; an attacker also needs the
 * PIN, and they get at most MAX_PIN_ATTEMPTS guesses before the token is
 * dead-lettered (1M PIN space → 5/1M = 0.0005% blind-guess success rate
 * inside the 5-min TTL, even ignoring the per-IP rate limit above).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const userAgent = req.headers.get("user-agent")
    const rl = await checkDevicePairClaimLimit(ip)
    if (!rl.success) {
      return withCorsHeaders(problemJson(429, "Too Many Requests", "Too many requests"))
    }

    const body = await req.json().catch(() => null)
    const token = body?.token
    const pin = body?.pin
    if (!token || typeof token !== "string") {
      return withCorsHeaders(problemJson(400, "Bad Request", "token is required"))
    }
    if (!pin || typeof pin !== "string" || !PIN_PATTERN.test(pin)) {
      return withCorsHeaders(problemJson(400, "Bad Request", "pin must be 6 digits"))
    }

    // Look up by hash — the DB never sees plaintext.
    const tokenHash = hashToken(token)
    const pairing = await db.devicePairingToken.findUnique({
      where: { token: tokenHash },
      select: {
        id: true,
        organizationId: true,
        createdByUserId: true,
        pinHash: true,
        failedAttempts: true,
        expiresAt: true,
        claimedAt: true,
      },
    })

    if (!pairing) {
      return withCorsHeaders(problemJson(404, "Not Found", "Invalid pairing token"))
    }

    if (pairing.claimedAt) {
      return withCorsHeaders(problemJson(410, "Gone", "Pairing token already used"))
    }

    if (pairing.expiresAt < new Date()) {
      return withCorsHeaders(problemJson(410, "Gone", "Pairing token expired"))
    }

    if (pairing.failedAttempts >= MAX_PIN_ATTEMPTS) {
      return withCorsHeaders(
        problemJson(
          410,
          "Gone",
          "Too many incorrect PIN attempts. Generate a new QR code.",
        ),
      )
    }

    // Constant-time PIN comparison via the hashes (both 64-byte hex strings,
    // so equal-length is guaranteed and timingSafeEqual is safe).
    const submittedPinHash = hashToken(pin)
    const expected = Buffer.from(pairing.pinHash, "hex")
    const submitted = Buffer.from(submittedPinHash, "hex")
    const pinMatches =
      expected.length === submitted.length &&
      crypto.timingSafeEqual(expected, submitted)

    if (!pinMatches) {
      // Bump the counter atomically. If we just hit MAX, the token is dead.
      const updated = await db.devicePairingToken.update({
        where: { id: pairing.id },
        data: { failedAttempts: { increment: 1 } },
        select: { failedAttempts: true },
      })
      const remaining = Math.max(0, MAX_PIN_ATTEMPTS - updated.failedAttempts)
      return withCorsHeaders(
        problemJson(401, "Unauthorized", "Incorrect PIN", { remainingAttempts: remaining }),
      )
    }

    // Atomically claim the token. Two concurrent claims race here; only one
    // gets count === 1. The loser bails before any session is created. The
    // failedAttempts < MAX guard mirrors the check above and closes a TOCTOU
    // window with a parallel wrong-PIN request that would push us past MAX.
    const claimResult = await db.devicePairingToken.updateMany({
      where: {
        id: pairing.id,
        claimedAt: null,
        failedAttempts: { lt: MAX_PIN_ATTEMPTS },
      },
      data: { claimedAt: new Date() },
    })
    if (claimResult.count === 0) {
      return withCorsHeaders(problemJson(410, "Gone", "Pairing token already used"))
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
          userAgent,
        },
      }),
      db.user.findUnique({
        where: { id: pairing.createdByUserId },
        select: { id: true, name: true, email: true, image: true },
      }),
    ])

    // Audit trail — captured by Sentry/log aggregation so the dashboard
    // user can investigate a stolen QR (e.g. screenshare leak).
    console.info("[device-pair/claim] claimed", {
      pairingId: pairing.id,
      organizationId: pairing.organizationId,
      userId: pairing.createdByUserId,
      userEmail: user?.email,
      ipAddress: ip,
      userAgent,
    })

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
  } catch (err) {
    console.error("[device-pair/claim] error:", err)
    return withCorsHeaders(problemJson(500, "Internal Server Error", "Unexpected error"))
  }
}

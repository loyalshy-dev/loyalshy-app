import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { OAuth2Client } from "google-auth-library"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"
import { problemJson } from "@/lib/api-session"
import { checkGoogleMobileLimit } from "@/lib/auth-rate-limit"

let _googleClient: OAuth2Client | null = null
function getGoogleClient() {
  if (!_googleClient) {
    _googleClient = new OAuth2Client()
  }
  return _googleClient
}

export function OPTIONS() {
  return handlePreflight()
}

/**
 * POST /api/v1/auth/google-mobile
 * Authenticate with a Google ID token from expo-auth-session.
 * Body: { idToken: string }
 * Returns session token + user + organizations.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = await checkGoogleMobileLimit(ip)
    if (!rl.success) {
      return withCorsHeaders(problemJson(429, "Too Many Requests", "Too many requests"))
    }

    const body = await req.json().catch(() => null)
    const idToken = body?.idToken
    if (!idToken || typeof idToken !== "string") {
      return withCorsHeaders(problemJson(400, "Bad Request", "idToken is required"))
    }

    // Mobile-only audiences. The web GOOGLE_CLIENT_ID is intentionally
    // excluded — the web Better Auth flow has its own non-bearer path
    // and accepting web-issued tokens here would let any leaked web ID
    // token mint a 30-day staff session.
    const allowedClientIds = [
      process.env.GOOGLE_CLIENT_ID_IOS,
      process.env.GOOGLE_CLIENT_ID_ANDROID,
    ].filter(Boolean) as string[]

    if (allowedClientIds.length === 0) {
      console.error("[google-mobile] no mobile client IDs configured")
      return withCorsHeaders(
        problemJson(500, "Internal Server Error", "Google sign-in is not configured"),
      )
    }

    let payload
    try {
      const ticket = await getGoogleClient().verifyIdToken({
        idToken,
        audience: allowedClientIds,
      })
      payload = ticket.getPayload()
    } catch (err) {
      console.error("[google-mobile] verifyIdToken failed:", err)
      return withCorsHeaders(problemJson(401, "Unauthorized", "Invalid Google ID token"))
    }

    if (!payload?.email) {
      return withCorsHeaders(problemJson(400, "Bad Request", "No email in Google token"))
    }

    if (!payload.email_verified) {
      return withCorsHeaders(
        problemJson(403, "Forbidden", "Please verify your email before signing in."),
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        banned: true,
      },
    })

    if (!user) {
      return withCorsHeaders(
        problemJson(
          404,
          "Not Found",
          "No account found with this email. Please sign up on the web first.",
        ),
      )
    }

    if (user.banned) {
      return withCorsHeaders(problemJson(403, "Forbidden", "Account is suspended"))
    }

    if (!user.emailVerified) {
      return withCorsHeaders(
        problemJson(403, "Forbidden", "Please verify your email before signing in."),
      )
    }

    // Get memberships
    const memberships = await db.member.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    })

    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    }))

    // Create session
    const sessionToken = crypto.randomBytes(32).toString("base64url")
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    // Auto-set activeOrganizationId if exactly one org
    const activeOrgId = organizations.length === 1 ? organizations[0].id : null

    await db.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt,
        activeOrganizationId: activeOrgId,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent"),
      },
    })

    return withCorsHeaders(
      NextResponse.json({
        token: sessionToken,
        user: { id: user.id, name: user.name, email: user.email, image: user.image },
        organizations,
      }),
    )
  } catch (err) {
    console.error("[google-mobile] error:", err)
    return withCorsHeaders(problemJson(500, "Internal Server Error", "Unexpected error"))
  }
}

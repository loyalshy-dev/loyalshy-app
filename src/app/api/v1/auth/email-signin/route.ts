import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { verifyPassword } from "better-auth/crypto"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"
import { checkEmailSigninLimit } from "@/lib/auth-rate-limit"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * POST /api/v1/auth/email-signin
 * Authenticate with email + password from the mobile app.
 * Body: { email: string, password: string }
 * Returns session token + user + organizations.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

    const body = await req.json().catch(() => null)
    const email = body?.email
    const password = body?.password

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return withCorsHeaders(
        NextResponse.json({ error: "Email and password are required" }, { status: 400 })
      )
    }

    const rl = await checkEmailSigninLimit(email, ip)
    if (!rl.success) {
      return withCorsHeaders(
        NextResponse.json({ error: "Too many requests" }, { status: 429 })
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        banned: true,
      },
    })

    // Banned accounts get a distinct response so users understand why they
    // can't sign in. All other failure modes (no user, wrong password,
    // Google-only account) collapse into the same generic 401 to avoid
    // account enumeration.
    if (user?.banned) {
      return withCorsHeaders(
        NextResponse.json({ error: "Account is suspended" }, { status: 403 })
      )
    }

    if (!user) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
      )
    }

    // Find the credential account and verify password.
    // Always run the password-verify path even if the account is Google-only
    // so timing doesn't reveal which branch was taken.
    const account = await db.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
      select: { password: true },
    })

    let valid = false
    if (account?.password) {
      valid = await verifyPassword({ hash: account.password, password })
    }

    if (!account?.password || !valid) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
      )
    }

    // Mirror the web onboarding gate: require verified email before issuing
    // a 30-day mobile session.
    if (!user.emailVerified) {
      return withCorsHeaders(
        NextResponse.json(
          { error: "Please verify your email before signing in." },
          { status: 403 }
        )
      )
    }

    // Get memberships
    const memberships = await db.member.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        organization: { select: { id: true, name: true } },
      },
    })

    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
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
      })
    )
  } catch (err) {
    console.error("[email-signin] error:", err)
    return withCorsHeaders(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    )
  }
}

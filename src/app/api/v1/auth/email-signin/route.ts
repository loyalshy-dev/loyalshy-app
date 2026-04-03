import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { verifyPassword } from "better-auth/crypto"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"
import { publicFormLimiter } from "@/lib/rate-limit"

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
    const rl = publicFormLimiter.check(ip)
    if (!rl.success) {
      return withCorsHeaders(
        NextResponse.json({ error: "Too many requests" }, { status: 429 })
      )
    }

    const body = await req.json().catch(() => null)
    const email = body?.email
    const password = body?.password

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return withCorsHeaders(
        NextResponse.json({ error: "Email and password are required" }, { status: 400 })
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, email: true, image: true, banned: true },
    })

    if (!user) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
      )
    }

    if (user.banned) {
      return withCorsHeaders(
        NextResponse.json({ error: "Account is suspended" }, { status: 403 })
      )
    }

    // Find the credential account and verify password
    const account = await db.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
      select: { password: true },
    })

    if (!account?.password) {
      return withCorsHeaders(
        NextResponse.json(
          { error: "This account uses a different sign-in method (e.g. Google). Try signing in with Google instead." },
          { status: 401 }
        )
      )
    }

    const valid = await verifyPassword({ hash: account.password, password })
    if (!valid) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
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
  } catch {
    return withCorsHeaders(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    )
  }
}

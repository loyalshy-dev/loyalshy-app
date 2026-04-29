import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"
import { checkInviteValidateLimit } from "@/lib/auth-rate-limit"
import { hashToken } from "@/lib/token-hash"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * GET /api/v1/auth/invite?token=xxx
 * Validate an invitation token and return details.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = await checkInviteValidateLimit(ip)
    if (!rl.success) {
      return withCorsHeaders(
        NextResponse.json({ error: "Too many requests" }, { status: 429 })
      )
    }

    const token = req.nextUrl.searchParams.get("token")
    if (!token) {
      return withCorsHeaders(
        NextResponse.json({ error: "token parameter is required" }, { status: 400 })
      )
    }

    const invitation = await db.staffInvitation.findUnique({
      where: { token: hashToken(token) },
      select: {
        id: true,
        email: true,
        role: true,
        accepted: true,
        expiresAt: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    })

    if (!invitation) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invitation not found" }, { status: 404 })
      )
    }

    if (invitation.accepted) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invitation already accepted" }, { status: 410 })
      )
    }

    if (invitation.expiresAt < new Date()) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invitation expired" }, { status: 410 })
      )
    }

    return withCorsHeaders(
      NextResponse.json({
        email: invitation.email,
        role: invitation.role,
        organizationName: invitation.organization.name,
        organizationId: invitation.organizationId,
      })
    )
  } catch (err) {
    console.error("[auth/invite GET] error:", err)
    return withCorsHeaders(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    )
  }
}

/**
 * POST /api/v1/auth/invite
 * Accept an invitation. Requires authenticated session (Bearer token).
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.headers.get("authorization")?.slice(7)
    if (!sessionToken) {
      return withCorsHeaders(
        NextResponse.json({ error: "Missing Authorization header" }, { status: 401 })
      )
    }

    const session = await db.session.findUnique({
      where: { token: sessionToken },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        user: { select: { email: true, emailVerified: true } },
      },
    })

    if (!session || session.expiresAt < new Date()) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
      )
    }

    // Mirror the web onboarding gate — invite acceptance must come from a
    // verified mailbox, otherwise anyone who can guess an invited email
    // can hijack the invitation by signing up with that address.
    if (!session.user.emailVerified) {
      return withCorsHeaders(
        NextResponse.json(
          { error: "Please verify your email before accepting an invitation." },
          { status: 403 }
        )
      )
    }

    const body = await req.json().catch(() => null)
    const token = body?.token
    if (!token || typeof token !== "string") {
      return withCorsHeaders(
        NextResponse.json({ error: "token is required" }, { status: 400 })
      )
    }

    const invitation = await db.staffInvitation.findUnique({
      where: { token: hashToken(token) },
      select: {
        id: true,
        email: true,
        role: true,
        accepted: true,
        expiresAt: true,
        organizationId: true,
        organization: { select: { id: true, name: true } },
      },
    })

    if (!invitation || invitation.accepted || invitation.expiresAt < new Date()) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invalid, expired, or already accepted invitation" }, { status: 400 })
      )
    }

    // Verify email matches
    if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return withCorsHeaders(
        NextResponse.json(
          { error: "Your email does not match the invitation email" },
          { status: 403 }
        )
      )
    }

    // Accept in transaction: mark invitation + create member + set active org
    await db.$transaction([
      db.staffInvitation.update({
        where: { id: invitation.id },
        data: { accepted: true },
      }),
      db.member.create({
        data: {
          userId: session.userId,
          organizationId: invitation.organizationId,
          role: invitation.role === "OWNER" ? "owner" : "member",
        },
      }),
      db.session.update({
        where: { id: session.id },
        data: { activeOrganizationId: invitation.organizationId },
      }),
    ])

    return withCorsHeaders(
      NextResponse.json({
        success: true,
        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
        },
      })
    )
  } catch (err) {
    console.error("[auth/invite POST] error:", err)
    return withCorsHeaders(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    )
  }
}

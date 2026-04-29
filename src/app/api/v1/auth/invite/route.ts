import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"
import { problemJson } from "@/lib/api-session"
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
      return withCorsHeaders(problemJson(429, "Too Many Requests", "Too many requests"))
    }

    const token = req.nextUrl.searchParams.get("token")
    if (!token) {
      return withCorsHeaders(
        problemJson(400, "Bad Request", "token parameter is required"),
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
      return withCorsHeaders(problemJson(404, "Not Found", "Invitation not found"))
    }

    if (invitation.accepted) {
      return withCorsHeaders(problemJson(410, "Gone", "Invitation already accepted"))
    }

    if (invitation.expiresAt < new Date()) {
      return withCorsHeaders(problemJson(410, "Gone", "Invitation expired"))
    }

    return withCorsHeaders(
      NextResponse.json({
        email: invitation.email,
        role: invitation.role,
        organizationName: invitation.organization.name,
        organizationId: invitation.organizationId,
      }),
    )
  } catch (err) {
    console.error("[auth/invite GET] error:", err)
    return withCorsHeaders(problemJson(500, "Internal Server Error", "Unexpected error"))
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
        problemJson(401, "Unauthorized", "Missing Authorization header"),
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
        problemJson(401, "Unauthorized", "Invalid or expired session"),
      )
    }

    // Mirror the web onboarding gate — invite acceptance must come from a
    // verified mailbox, otherwise anyone who can guess an invited email
    // can hijack the invitation by signing up with that address.
    if (!session.user.emailVerified) {
      return withCorsHeaders(
        problemJson(
          403,
          "Forbidden",
          "Please verify your email before accepting an invitation.",
        ),
      )
    }

    const body = await req.json().catch(() => null)
    const token = body?.token
    if (!token || typeof token !== "string") {
      return withCorsHeaders(problemJson(400, "Bad Request", "token is required"))
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
        problemJson(
          400,
          "Bad Request",
          "Invalid, expired, or already accepted invitation",
        ),
      )
    }

    // Verify email matches
    if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return withCorsHeaders(
        problemJson(403, "Forbidden", "Your email does not match the invitation email"),
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
      }),
    )
  } catch (err) {
    console.error("[auth/invite POST] error:", err)
    return withCorsHeaders(problemJson(500, "Internal Server Error", "Unexpected error"))
  }
}

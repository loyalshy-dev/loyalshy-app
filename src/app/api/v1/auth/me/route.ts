import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * GET /api/v1/auth/me
 * Validate a session token and return user info + organizations.
 * Used by mobile app on startup to check session validity.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.slice(7)
    if (!token) {
      return withCorsHeaders(
        NextResponse.json({ error: "Missing Authorization header" }, { status: 401 })
      )
    }

    const session = await db.session.findUnique({
      where: { token },
      select: {
        id: true,
        expiresAt: true,
        activeOrganizationId: true,
        user: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
      },
    })

    if (!session || session.expiresAt < new Date()) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
      )
    }

    // Get user's organization memberships
    const memberships = await db.member.findMany({
      where: { userId: session.user.id },
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

    return withCorsHeaders(
      NextResponse.json({
        user: session.user,
        session: { activeOrganizationId: session.activeOrganizationId },
        organizations,
      })
    )
  } catch {
    return withCorsHeaders(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    )
  }
}

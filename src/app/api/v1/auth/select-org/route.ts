import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * POST /api/v1/auth/select-org
 * Set the active organization for a session.
 * Body: { organizationId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.slice(7)
    if (!token) {
      return withCorsHeaders(
        NextResponse.json({ error: "Missing Authorization header" }, { status: 401 })
      )
    }

    const session = await db.session.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true },
    })

    if (!session || session.expiresAt < new Date()) {
      return withCorsHeaders(
        NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
      )
    }

    const body = await req.json().catch(() => null)
    const organizationId = body?.organizationId
    if (!organizationId || typeof organizationId !== "string") {
      return withCorsHeaders(
        NextResponse.json({ error: "organizationId is required" }, { status: 400 })
      )
    }

    // Verify user is a member of the org
    const member = await db.member.findFirst({
      where: { userId: session.userId, organizationId },
      select: { role: true },
    })

    if (!member) {
      return withCorsHeaders(
        NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
      )
    }

    // Set active org on session
    await db.session.update({
      where: { id: session.id },
      data: { activeOrganizationId: organizationId },
    })

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, plan: true },
    })

    return withCorsHeaders(
      NextResponse.json({ organization: { ...org, role: member.role } })
    )
  } catch {
    return withCorsHeaders(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    )
  }
}

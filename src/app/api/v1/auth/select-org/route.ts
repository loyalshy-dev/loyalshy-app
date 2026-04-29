import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { handlePreflight } from "@/lib/api-cors"
import { sessionHandlerNoOrg, badRequest, forbidden, notFound } from "@/lib/api-session"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * POST /api/v1/auth/select-org
 * Set the active organization for a session.
 * Body: { organizationId: string }
 */
export async function POST(req: NextRequest) {
  return sessionHandlerNoOrg(req, async (ctx) => {
    const body = await req.json().catch(() => null)
    const organizationId = body?.organizationId
    if (!organizationId || typeof organizationId !== "string") {
      throw badRequest("organizationId is required")
    }

    // Verify user is a member of the org
    const member = await db.member.findFirst({
      where: { userId: ctx.userId, organizationId },
      select: { role: true },
    })

    if (!member) throw forbidden("Not a member of this organization")

    // Only update the current session (other sessions for the same user —
    // e.g. a parallel web login — keep their own activeOrganizationId).
    await db.session.update({
      where: { id: ctx.sessionId },
      data: { activeOrganizationId: organizationId },
    })

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    })

    if (!org) throw notFound("Organization not found")

    return { organization: { ...org, role: member.role } }
  })
}

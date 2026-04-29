import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { handlePreflight } from "@/lib/api-cors"
import { sessionHandlerNoOrg } from "@/lib/api-session"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * GET /api/v1/auth/me
 * Validate a session token and return user info + organizations.
 * Used by mobile app on startup to check session validity.
 */
export async function GET(req: NextRequest) {
  return sessionHandlerNoOrg(req, async (ctx) => {
    const [user, memberships] = await Promise.all([
      db.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true, name: true, email: true, image: true, role: true },
      }),
      db.member.findMany({
        where: { userId: ctx.userId },
        select: {
          role: true,
          organization: { select: { id: true, name: true } },
        },
      }),
    ])

    return {
      user,
      session: { activeOrganizationId: ctx.activeOrganizationId },
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
    }
  })
}

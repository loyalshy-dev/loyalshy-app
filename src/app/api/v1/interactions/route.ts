import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight } from "@/lib/api-session"
import { toApiInteraction } from "@/lib/api-serializers"

export function OPTIONS() {
  return handlePreflight()
}

export async function GET(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20))

    const where = { organizationId: ctx.organizationId }

    const [interactions, total] = await Promise.all([
      db.interaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contact: { select: { id: true, fullName: true } },
          passInstance: {
            select: {
              id: true,
              status: true,
              passTemplate: { select: { name: true, passType: true } },
            },
          },
        },
      }),
      db.interaction.count({ where }),
    ])

    return { data: interactions.map(toApiInteraction), pagination: { page, pageSize, total } }
  })
}

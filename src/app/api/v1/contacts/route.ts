import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight } from "@/lib/api-session"
import { toApiContact } from "@/lib/api-serializers"

export function OPTIONS() {
  return handlePreflight()
}

export async function GET(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    const url = new URL(req.url)
    const search = url.searchParams.get("search")?.trim() ?? ""
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20))

    const where = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        orderBy: { lastInteractionAt: { sort: "desc", nulls: "last" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { passInstances: true } } },
      }),
      db.contact.count({ where }),
    ])

    return { data: contacts.map(toApiContact), pagination: { page, pageSize, total } }
  })
}

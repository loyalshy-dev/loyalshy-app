import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight } from "@/lib/api-session"
import { orgScope } from "@/lib/org-scope"
import { toApiInteraction } from "@/lib/api-serializers"
import {
  afterInteractionCursor,
  decodeInteractionCursor,
  encodeInteractionCursor,
} from "@/lib/interaction-cursor"

export function OPTIONS() {
  return handlePreflight()
}

const include = {
  contact: { select: { id: true, fullName: true } },
  passInstance: {
    select: {
      id: true,
      status: true,
      passTemplate: { select: { name: true, passType: true } },
    },
  },
} as const

/**
 * The org's activity feed, newest first.
 *
 * Paging is by keyset: every response carries `pagination.nextCursor`
 * (null when there's nothing older), and `?cursor=` continues from there.
 * Rows that land while the staff scrolls can't shift the pages, which an
 * offset would. `?page=` is still honoured for clients built before the
 * cursor existed (offset paging, same shape).
 */
export async function GET(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    const url = new URL(req.url)
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20))
    const cursor = decodeInteractionCursor(url.searchParams.get("cursor"))
    const page = cursor ? 1 : Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)

    const scope = orgScope.interaction(ctx)
    const where = cursor ? { AND: [scope, afterInteractionCursor(cursor)] } : scope

    const [rows, total] = await Promise.all([
      db.interaction.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: cursor ? 0 : (page - 1) * pageSize,
        // One extra row tells us whether there's a next page without a second query.
        take: pageSize + 1,
        include,
      }),
      db.interaction.count({ where: scope }),
    ])

    const hasMore = rows.length > pageSize
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows
    const last = pageRows[pageRows.length - 1]
    const nextCursor = hasMore && last ? encodeInteractionCursor({ createdAt: last.createdAt, id: last.id }) : null

    return {
      data: pageRows.map(toApiInteraction),
      pagination: { page, pageSize, total, nextCursor },
    }
  })
}

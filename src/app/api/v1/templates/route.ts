import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight } from "@/lib/api-session"
import { orgScope } from "@/lib/org-scope"
import { toApiTemplate } from "@/lib/api-serializers"

export function OPTIONS() {
  return handlePreflight()
}

export async function GET(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    const url = new URL(req.url)
    const status = url.searchParams.get("status") ?? undefined

    const where = orgScope.passTemplate(ctx, {
      ...(status ? { status: status as Prisma.PassTemplateWhereInput["status"] } : {}),
    })

    const templates = await db.passTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { passInstances: true } } },
    })

    return templates.map(toApiTemplate)
  })
}

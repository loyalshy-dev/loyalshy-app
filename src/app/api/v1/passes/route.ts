import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight } from "@/lib/api-session"
import { toApiPassInstance } from "@/lib/api-serializers"

export function OPTIONS() {
  return handlePreflight()
}

export async function GET(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    const url = new URL(req.url)
    const contactId = url.searchParams.get("contactId") ?? undefined
    const templateId = url.searchParams.get("templateId") ?? undefined
    const status = url.searchParams.get("status") ?? undefined
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20))

    const where: Prisma.PassInstanceWhereInput = {
      passTemplate: { organizationId: ctx.organizationId },
      ...(contactId ? { contactId } : {}),
      ...(templateId ? { passTemplateId: templateId } : {}),
      ...(status ? { status: status as Prisma.PassInstanceWhereInput["status"] } : {}),
    }

    const [passes, total] = await Promise.all([
      db.passInstance.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          passTemplate: { select: { id: true, name: true, passType: true, config: true } },
        },
      }),
      db.passInstance.count({ where }),
    ])

    return { data: passes.map(toApiPassInstance), pagination: { page, pageSize, total } }
  })
}

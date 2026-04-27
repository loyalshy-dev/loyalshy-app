import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight, notFound } from "@/lib/api-session"
import { toApiContact } from "@/lib/api-serializers"

export function OPTIONS() {
  return handlePreflight()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return sessionHandler(req, async (ctx) => {
    const contact = await db.contact.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: { _count: { select: { passInstances: true } } },
    })
    if (!contact) throw notFound("Contact not found")
    return toApiContact(contact)
  })
}

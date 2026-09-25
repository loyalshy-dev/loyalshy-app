import { NextRequest } from "next/server"
import { sessionRawHandler, notFound, handlePreflight } from "@/lib/api-session"
import { loadTemplateCardInput } from "@/lib/wallet/apple/card-view"
import { stripResponse } from "@/lib/wallet/apple/card-strip-response"

export function OPTIONS() {
  return handlePreflight()
}

/** The program's strip image for a fresh card (0 stamps) as PNG. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return sessionRawHandler(req, async (ctx) => {
    const input = await loadTemplateCardInput(id, ctx.organizationId)
    if (!input) throw notFound("Program not found")
    return stripResponse(input)
  })
}

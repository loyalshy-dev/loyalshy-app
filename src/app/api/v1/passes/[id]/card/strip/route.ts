import { NextRequest } from "next/server"
import { sessionRawHandler, notFound, handlePreflight } from "@/lib/api-session"
import { loadPassCardInput } from "@/lib/wallet/apple/card-view"
import { stripResponse } from "@/lib/wallet/apple/card-strip-response"

export function OPTIONS() {
  return handlePreflight()
}

/** The pass's strip image (stamp grid / progress / artwork) as PNG. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return sessionRawHandler(req, async (ctx) => {
    const input = await loadPassCardInput(id, ctx.organizationId)
    if (!input) throw notFound("Pass not found")
    return stripResponse(input)
  })
}

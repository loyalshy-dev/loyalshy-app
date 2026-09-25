import { NextRequest } from "next/server"
import { sessionHandler, notFound, handlePreflight } from "@/lib/api-session"
import { loadTemplateCardInput, toAppleCardView } from "@/lib/wallet/apple/card-view"

export function OPTIONS() {
  return handlePreflight()
}

/** What a customer joining this program right now gets in Apple Wallet. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return sessionHandler(req, async (ctx) => {
    const input = await loadTemplateCardInput(id, ctx.organizationId)
    if (!input) throw notFound("Program not found")
    return toAppleCardView(input)
  })
}

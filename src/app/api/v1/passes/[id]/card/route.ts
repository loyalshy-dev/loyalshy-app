import { NextRequest } from "next/server"
import { sessionHandler, notFound, handlePreflight } from "@/lib/api-session"
import { loadPassCardInput, toAppleCardView } from "@/lib/wallet/apple/card-view"

export function OPTIONS() {
  return handlePreflight()
}

/** The customer's pass as Apple Wallet shows it (front only). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return sessionHandler(req, async (ctx) => {
    const input = await loadPassCardInput(id, ctx.organizationId)
    if (!input) throw notFound("Pass not found")
    return toAppleCardView(input)
  })
}

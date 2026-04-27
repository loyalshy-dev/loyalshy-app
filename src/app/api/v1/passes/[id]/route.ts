import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight, notFound } from "@/lib/api-session"
import { toApiPassInstanceDetail } from "@/lib/api-serializers"

export function OPTIONS() {
  return handlePreflight()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return sessionHandler(req, async (ctx) => {
    // Look up by id OR walletPassId (Apple/Google QRs encode walletPassId)
    const pass = await db.passInstance.findFirst({
      where: {
        OR: [{ id }, { walletPassId: id }],
        passTemplate: { organizationId: ctx.organizationId },
      },
      include: {
        passTemplate: { select: { id: true, name: true, passType: true, config: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        rewards: { orderBy: { earnedAt: "desc" } },
        interactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { passTemplate: { select: { name: true, passType: true } } },
        },
      },
    })
    if (!pass) throw notFound("Pass not found")
    return toApiPassInstanceDetail(pass)
  })
}

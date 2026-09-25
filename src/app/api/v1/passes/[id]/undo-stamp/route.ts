import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight, notFound, ApiError } from "@/lib/api-session"
import { orgScope } from "@/lib/org-scope"
import { toApiPassInstanceDetail } from "@/lib/api-serializers"
import { dispatchWalletUpdate } from "@/lib/wallet/dispatch"
import { logOrgAction } from "@/lib/org-audit"

export function OPTIONS() {
  return handlePreflight()
}

/** How long after a stamp it can still be taken back. */
const UNDO_WINDOW_MS = 10 * 60 * 1000
const ROLE_RANK: Record<string, number> = { member: 1, admin: 2, owner: 3 }

function conflict(code: string, detail: string): ApiError {
  return new ApiError(409, "Conflict", detail, { code })
}

/**
 * Take back the most recent stamp on a pass (wrong card, double tap).
 *
 * Rules:
 * - Only the pass's latest interaction, only a STAMP, only within 10 minutes.
 * - Staff can undo their own stamps; owners / program managers anyone's.
 * - If that stamp completed the card, its reward is removed too — refused
 *   (409 `rewardAlreadyUsed`) once the reward was redeemed, expired, or its
 *   prize revealed to the customer.
 * - Every undo is written to the org audit log (STAMP_UNDONE).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return sessionHandler(req, async (ctx) => {
    const pass = await db.passInstance.findFirst({
      where: orgScope.passInstance(ctx, { OR: [{ id }, { walletPassId: id }] }),
      select: {
        id: true,
        status: true,
        walletProvider: true,
        passTemplate: { select: { id: true, name: true, passType: true, config: true } },
        contact: { select: { id: true, fullName: true } },
      },
    })
    if (!pass) throw notFound("Pass not found")
    if (pass.passTemplate.passType !== "STAMP_CARD") {
      throw conflict("notStampCard", "Only stamp cards have stamps to undo")
    }

    const stampsRequired =
      ((pass.passTemplate.config as Record<string, unknown> | null)?.stampsRequired as number | undefined) ?? 10

    const undone = await db.$transaction(async (tx) => {
      // Same row lock as performStamp, so an undo can't interleave with a stamp.
      await tx.$queryRaw`SELECT id FROM pass_instance WHERE id = ${pass.id} FOR UPDATE`

      const latest = await tx.interaction.findFirst({
        where: { passInstanceId: pass.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, createdAt: true, performedById: true, metadata: true },
      })
      if (!latest || latest.type !== "STAMP") {
        throw conflict("nothingToUndo", "The last action on this card isn't a stamp")
      }
      if (Date.now() - latest.createdAt.getTime() > UNDO_WINDOW_MS) {
        throw conflict("undoWindowPassed", "Stamps can only be undone within 10 minutes")
      }
      if (latest.performedById !== ctx.userId && (ROLE_RANK[ctx.role] ?? 0) < ROLE_RANK.admin) {
        throw conflict("notYourStamp", "Only the person who added this stamp can undo it")
      }

      const fresh = await tx.passInstance.findUnique({ where: { id: pass.id }, select: { data: true } })
      const data = (fresh?.data ?? {}) as Record<string, unknown>
      const cycle = (data.currentCycleVisits as number) ?? 0
      const total = (data.totalVisits as number) ?? 0
      const visitNumber = ((latest.metadata as Record<string, unknown> | null)?.visitNumber as number | undefined) ?? cycle
      const completedCard = visitNumber >= stampsRequired

      if (completedCard) {
        // The reward that stamp created (same transaction → earnedAt ≈ createdAt).
        const reward = await tx.reward.findFirst({
          where: { passInstanceId: pass.id, earnedAt: { gte: new Date(latest.createdAt.getTime() - 5_000) } },
          orderBy: { earnedAt: "desc" },
          select: { id: true, status: true, revealedAt: true, description: true },
        })
        if (reward) {
          const prizeRevealed = reward.description != null && reward.revealedAt != null
          if (reward.status !== "AVAILABLE" || prizeRevealed) {
            throw conflict("rewardAlreadyUsed", "The reward from this stamp was already used")
          }
          // Conditional delete: a concurrent redeem that wins leaves count 0.
          const { count } = await tx.reward.deleteMany({ where: { id: reward.id, status: "AVAILABLE" } })
          if (count === 0) throw conflict("rewardAlreadyUsed", "The reward from this stamp was already used")
        }
      }

      await tx.interaction.delete({ where: { id: latest.id } })
      await tx.passInstance.update({
        where: { id: pass.id },
        data: {
          data: {
            ...data,
            currentCycleVisits: completedCard ? Math.max(0, visitNumber - 1) : Math.max(0, cycle - 1),
            totalVisits: Math.max(0, total - 1),
          } as Prisma.InputJsonValue,
        },
      })

      const previous = await tx.interaction.findFirst({
        where: { contactId: pass.contact.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
      await tx.contact.update({
        where: { id: pass.contact.id },
        data: {
          totalInteractions: { decrement: 1 },
          lastInteractionAt: previous?.createdAt ?? null,
        },
      })

      return { stampedAt: latest.createdAt, completedCard }
    })

    dispatchWalletUpdate(pass.id, pass.walletProvider, "STAMP")

    const actor = await db.user.findUnique({ where: { id: ctx.userId }, select: { email: true } })
    await logOrgAction({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      actorEmail: actor?.email ?? null,
      action: "STAMP_UNDONE",
      targetType: "pass",
      targetId: pass.id,
      targetLabel: `${pass.contact.fullName} · ${pass.passTemplate.name}`,
      metadata: {
        stampedAt: undone.stampedAt.toISOString(),
        rewardRemoved: undone.completedCard,
      },
    })

    const refreshed = await db.passInstance.findUnique({
      where: { id: pass.id },
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
    if (!refreshed) throw notFound("Pass not found after undo")
    return toApiPassInstanceDetail(refreshed)
  })
}

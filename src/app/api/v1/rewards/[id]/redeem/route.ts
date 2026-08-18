import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight, notFound, ApiError } from "@/lib/api-session"
import { orgScope } from "@/lib/org-scope"
import { toApiPassInstanceDetail } from "@/lib/api-serializers"
import { parseCouponConfig } from "@/lib/pass-config"
import { dispatchWalletUpdate } from "@/lib/wallet/dispatch"
import type { Prisma } from "@prisma/client"

export function OPTIONS() {
  return handlePreflight()
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  return sessionHandler(req, async (ctx) => {
    const reward = await db.reward.findFirst({
      where: orgScope.reward(ctx, { id }),
      select: {
        id: true,
        status: true,
        contactId: true,
        passInstanceId: true,
        expiresAt: true,
        revealedAt: true,
        passInstance: {
          select: {
            walletProvider: true,
            passTemplate: { select: { passType: true, config: true } },
          },
        },
      },
    })

    if (!reward) throw notFound("Reward not found")
    if (reward.status !== "AVAILABLE") {
      throw new ApiError(409, "Conflict", `Reward is already ${reward.status.toLowerCase()}`)
    }
    if (reward.expiresAt < new Date()) {
      await db.reward.update({ where: { id: reward.id }, data: { status: "EXPIRED" } })
      throw new ApiError(409, "Conflict", "Reward has expired")
    }

    await performRewardRedeem(reward, ctx.userId)

    if (!reward.passInstanceId) throw notFound("Pass instance not found for reward")
    const refreshed = await db.passInstance.findUnique({
      where: { id: reward.passInstanceId },
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
    if (!refreshed) throw notFound("Pass instance not found")
    return toApiPassInstanceDetail(refreshed)
  })
}

// ─── Redeem logic ──────────────────────────────────────────
// `performRewardRedeem` is exported for unit tests in route.test.ts. The
// route file is consumed by Next.js for HTTP exports only; extra named
// exports are ignored by the framework.

type RewardForRedeem = {
  id: string
  revealedAt: Date | null
  passInstanceId: string | null
  passInstance: {
    walletProvider: string
    passTemplate: { passType: "STAMP_CARD" | "COUPON"; config: Prisma.JsonValue } | null
  } | null
}

export async function performRewardRedeem(reward: RewardForRedeem, redeemedByUserId: string) {
  const isCoupon = reward.passInstance?.passTemplate?.passType === "COUPON"
  const couponConfig = isCoupon ? parseCouponConfig(reward.passInstance?.passTemplate?.config) : null
  const isSingleUse = couponConfig?.redemptionLimit === "single"

  await db.$transaction(async (tx) => {
    // Atomic claim: the conditional UPDATE takes the row lock itself, so a
    // concurrent redeem blocks here, then matches 0 rows once this commits.
    // The status guard lives in a typed `where` (not raw SQL) so Prisma owns
    // the enum @map translation — raw reads return DB values ("available"),
    // never enum names ("AVAILABLE").
    const claimed = await tx.reward.updateMany({
      where: { id: reward.id, status: "AVAILABLE" },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedById: redeemedByUserId,
        ...(!reward.revealedAt ? { revealedAt: new Date() } : {}),
      },
    })
    if (claimed.count === 0) {
      const current = await tx.reward.findUnique({
        where: { id: reward.id },
        select: { status: true },
      })
      throw new ApiError(
        409,
        "Conflict",
        `Reward is already ${(current?.status ?? "unavailable").toLowerCase()}`,
      )
    }

    if (reward.passInstanceId) {
      const cur = await tx.passInstance.findUnique({
        where: { id: reward.passInstanceId },
        select: { data: true },
      })
      const data = (cur?.data as Record<string, unknown>) ?? {}
      await tx.passInstance.update({
        where: { id: reward.passInstanceId },
        data: {
          data: { ...data, totalRewardsRedeemed: ((data.totalRewardsRedeemed as number) ?? 0) + 1 },
          ...(isSingleUse ? { status: "COMPLETED" } : {}),
        },
      })
    }
  })

  if (reward.passInstanceId && reward.passInstance?.walletProvider) {
    dispatchWalletUpdate(reward.passInstanceId, reward.passInstance.walletProvider, "REWARD_REDEEMED")
  }
}

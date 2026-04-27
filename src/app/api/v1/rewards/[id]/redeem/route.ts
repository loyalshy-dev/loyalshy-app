import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight, notFound, ApiError } from "@/lib/api-session"
import { toApiPassInstanceDetail } from "@/lib/api-serializers"
import { parseCouponConfig } from "@/lib/pass-config"

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
      where: { id, organizationId: ctx.organizationId },
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

    const isCoupon = reward.passInstance?.passTemplate?.passType === "COUPON"
    const couponConfig = isCoupon ? parseCouponConfig(reward.passInstance?.passTemplate?.config) : null
    const isSingleUse = couponConfig?.redemptionLimit === "single"

    await db.$transaction(async (tx) => {
      // Serialize concurrent redeems on the same reward — second caller waits
      // here, then sees status="REDEEMED" via the conditional update below.
      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM reward WHERE id = ${reward.id} FOR UPDATE
      `
      if (locked[0]?.status !== "AVAILABLE") {
        throw new ApiError(409, "Conflict", `Reward is already ${(locked[0]?.status ?? "unavailable").toLowerCase()}`)
      }

      await tx.reward.update({
        where: { id: reward.id },
        data: {
          status: "REDEEMED",
          redeemedAt: new Date(),
          redeemedById: ctx.userId,
          ...(!reward.revealedAt ? { revealedAt: new Date() } : {}),
        },
      })

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
      dispatchWalletUpdate(reward.passInstanceId, reward.passInstance.walletProvider)
    }

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

function dispatchWalletUpdate(passInstanceId: string, walletProvider: string) {
  if (walletProvider === "NONE") return
  if (process.env.TRIGGER_SECRET_KEY) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) => tasks.trigger("update-wallet-pass", { passInstanceId, updateType: "REWARD_REDEEMED" }))
      .catch((err: unknown) => console.error("Wallet update failed:", err instanceof Error ? err.message : err))
  } else if (walletProvider === "GOOGLE") {
    import("@/lib/wallet/google/update-pass")
      .then(({ notifyGooglePassUpdate }) => notifyGooglePassUpdate(passInstanceId))
      .catch((err: unknown) => console.error("Google update failed:", err instanceof Error ? err.message : err))
  } else if (walletProvider === "APPLE") {
    import("@/lib/wallet/apple/update-pass")
      .then(({ notifyApplePassUpdate }) => notifyApplePassUpdate(passInstanceId))
      .catch((err: unknown) => console.error("Apple update failed:", err instanceof Error ? err.message : err))
  }
}

import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { queryPassInstanceDetail } from "@/lib/api-data"
import { serializePassInstanceDetail } from "@/lib/api-serializers"
import { apiSuccess } from "@/lib/api-response"
import { NotFoundError, UnprocessableError } from "@/lib/api-errors"
import { parseCouponConfig } from "@/lib/pass-config"
import { db } from "@/lib/db"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// POST /api/v1/rewards/:rewardId/redeem — Redeem an available reward
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const segments = req.nextUrl.pathname.split("/")
  // /api/v1/rewards/[id]/redeem → id is at index -2
  const rewardId = segments[segments.length - 2]!

  // Find reward with org ownership check
  const reward = await db.reward.findFirst({
    where: {
      id: rewardId,
      organizationId: ctx.organizationId,
    },
    select: {
      id: true,
      status: true,
      contactId: true,
      passInstanceId: true,
      expiresAt: true,
      revealedAt: true,
      passInstance: {
        select: {
          passTemplate: {
            select: { passType: true, config: true },
          },
        },
      },
    },
  })

  if (!reward) {
    throw new NotFoundError("Reward not found.")
  }

  if (reward.status !== "AVAILABLE") {
    throw new UnprocessableError(
      `This reward has already been ${reward.status.toLowerCase()}.`
    )
  }

  if (reward.expiresAt < new Date()) {
    await db.reward.update({
      where: { id: rewardId },
      data: { status: "EXPIRED" },
    })
    throw new UnprocessableError("This reward has expired.")
  }

  // Check if single-use coupon
  const isCoupon = reward.passInstance?.passTemplate?.passType === "COUPON"
  const couponConfig = isCoupon
    ? parseCouponConfig(reward.passInstance?.passTemplate?.config)
    : null
  const isSingleUse = couponConfig?.redemptionLimit === "single"

  // Redeem in transaction
  await db.$transaction(async (tx) => {
    await tx.reward.update({
      where: { id: rewardId },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedById: ctx.userId,
        ...(!reward.revealedAt ? { revealedAt: new Date() } : {}),
      },
    })

    if (reward.passInstanceId) {
      const currentInstance = await tx.passInstance.findUnique({
        where: { id: reward.passInstanceId },
        select: { data: true },
      })
      const instanceData =
        (currentInstance?.data as Record<string, unknown>) ?? {}
      const totalRewardsRedeemed =
        ((instanceData.totalRewardsRedeemed as number) ?? 0) + 1

      await tx.passInstance.update({
        where: { id: reward.passInstanceId },
        data: {
          data: { ...instanceData, totalRewardsRedeemed },
          ...(isSingleUse ? { status: "COMPLETED" } : {}),
        },
      })
    }
  })

  // Trigger wallet pass update (fire-and-forget)
  if (reward.passInstanceId && process.env.TRIGGER_SECRET_KEY) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-wallet-pass", {
          passInstanceId: reward.passInstanceId,
          updateType: "REWARD_REDEEMED",
        })
      )
      .catch(() => {})
  }

  // Return updated pass detail
  if (reward.passInstanceId) {
    const updatedPass = await queryPassInstanceDetail(
      ctx.organizationId,
      reward.passInstanceId
    )
    if (updatedPass) {
      return apiSuccess(serializePassInstanceDetail(updatedPass))
    }
  }

  return apiSuccess({ rewardId, status: "REDEEMED" })
})

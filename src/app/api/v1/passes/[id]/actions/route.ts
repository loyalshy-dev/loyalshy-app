import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight, badRequest, notFound, ApiError } from "@/lib/api-session"
import { toApiPassInstanceDetail } from "@/lib/api-serializers"
import { parseCouponConfig, parseMinigameConfig, weightedRandomPrize } from "@/lib/pass-config"

export function OPTIONS() {
  return handlePreflight()
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("stamp") }),
  z.object({ action: z.literal("redeem") }),
])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  return sessionHandler(req, async (ctx) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest("Invalid JSON body")
    }

    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid action")
    }

    // Look up pass by id OR walletPassId (wallet QRs encode walletPassId)
    const pass = await db.passInstance.findFirst({
      where: {
        OR: [{ id }, { walletPassId: id }],
        passTemplate: { organizationId: ctx.organizationId },
      },
      include: {
        passTemplate: { select: { id: true, name: true, passType: true, config: true, status: true, endsAt: true } },
        contact: { select: { id: true, organizationId: true, deletedAt: true, totalInteractions: true } },
      },
    })

    if (!pass) throw notFound("Pass not found")
    if (pass.contact.deletedAt) throw new ApiError(409, "Conflict", "Contact has been deleted")
    if (pass.status !== "ACTIVE") throw new ApiError(409, "Conflict", `Pass is ${pass.status.toLowerCase()}`)
    if (pass.passTemplate.status !== "ACTIVE") throw new ApiError(409, "Conflict", "Template is no longer active")
    if (pass.passTemplate.endsAt && pass.passTemplate.endsAt < new Date()) {
      throw new ApiError(409, "Conflict", "Template has expired")
    }

    if (parsed.data.action === "stamp") {
      if (pass.passTemplate.passType !== "STAMP_CARD") {
        throw badRequest("Stamp action is only valid for stamp card passes")
      }
      await performStamp(pass, ctx.userId)
    } else {
      if (pass.passTemplate.passType !== "COUPON") {
        throw badRequest("Redeem action is only valid for coupon passes")
      }
      await performRedeemCoupon(pass, ctx.userId)
    }

    // Return refreshed detail
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
    if (!refreshed) throw notFound("Pass not found after action")
    return toApiPassInstanceDetail(refreshed)
  })
}

// ─── Stamp logic ───────────────────────────────────────────
// `performStamp` and `performRedeemCoupon` are exported for unit tests in
// route.test.ts. The route file is consumed by Next.js for HTTP exports only;
// extra named exports are ignored by the framework.

type PassForAction = Awaited<ReturnType<typeof loadPassForAction>>

async function loadPassForAction(passId: string) {
  // Type alias holder — the actual lookup is in POST handler.
  return db.passInstance.findUnique({
    where: { id: passId },
    include: {
      passTemplate: { select: { id: true, name: true, passType: true, config: true, status: true, endsAt: true } },
      contact: { select: { id: true, organizationId: true, deletedAt: true, totalInteractions: true } },
    },
  })
}

export async function performStamp(pass: NonNullable<PassForAction>, performedByUserId: string) {
  const templateConfig = (pass.passTemplate.config as Record<string, unknown>) ?? {}
  const visitsRequired = (templateConfig.stampsRequired as number) ?? 10
  const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 90

  await db.$transaction(async (tx) => {
    // Serialize concurrent stamps on the same pass — second caller waits here
    // until the first transaction commits, then sees the just-created interaction below.
    await tx.$queryRaw`SELECT id FROM pass_instance WHERE id = ${pass.id} FOR UPDATE`

    const fresh = await tx.passInstance.findUnique({
      where: { id: pass.id },
      select: { data: true },
    })
    const freshData = (fresh?.data as Record<string, unknown>) ?? {}
    const freshCycle = (freshData.currentCycleVisits as number) ?? 0
    const freshTotal = (freshData.totalVisits as number) ?? 0

    // Prevent double-stamp within 1 minute
    const recent = await tx.interaction.findFirst({
      where: { passInstanceId: pass.id, createdAt: { gte: new Date(Date.now() - 60_000) } },
      select: { id: true },
    })
    if (recent) throw new ApiError(409, "Conflict", "A stamp was already registered less than a minute ago")

    const newCycle = freshCycle + 1
    const newTotal = freshTotal + 1
    const wasRewardEarned = newCycle >= visitsRequired

    let selectedPrize: string | undefined
    if (wasRewardEarned) {
      const mg = parseMinigameConfig(pass.passTemplate.config)
      if (mg?.enabled && mg.prizes?.length) selectedPrize = weightedRandomPrize(mg.prizes)
    }

    await tx.interaction.create({
      data: {
        contactId: pass.contact.id,
        organizationId: pass.contact.organizationId,
        passTemplateId: pass.passTemplate.id,
        passInstanceId: pass.id,
        performedById: performedByUserId,
        type: "STAMP",
        metadata: { visitNumber: newCycle },
      },
    })

    if (wasRewardEarned) {
      await tx.passInstance.update({
        where: { id: pass.id },
        data: { data: { ...freshData, currentCycleVisits: 0, totalVisits: newTotal } },
      })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + rewardExpiryDays)
      const mg = parseMinigameConfig(pass.passTemplate.config)
      await tx.reward.create({
        data: {
          contactId: pass.contact.id,
          organizationId: pass.contact.organizationId,
          passTemplateId: pass.passTemplate.id,
          passInstanceId: pass.id,
          status: "AVAILABLE",
          expiresAt,
          description: selectedPrize ?? null,
          revealedAt: selectedPrize && mg?.enabled ? null : new Date(),
        },
      })
    } else {
      await tx.passInstance.update({
        where: { id: pass.id },
        data: { data: { ...freshData, currentCycleVisits: newCycle, totalVisits: newTotal } },
      })
    }

    await tx.contact.update({
      where: { id: pass.contact.id },
      data: { totalInteractions: { increment: 1 }, lastInteractionAt: new Date() },
    })
  })

  dispatchWalletUpdate(pass.id, pass.walletProvider, "STAMP")
}

// ─── Coupon redeem logic ───────────────────────────────────

export async function performRedeemCoupon(pass: NonNullable<PassForAction>, performedByUserId: string) {
  const config = parseCouponConfig(pass.passTemplate.config)
  const isUnlimited = config?.redemptionLimit === "unlimited"

  await db.$transaction(async (tx) => {
    // Serialize concurrent redeems on the same pass — second caller waits here
    // until the first transaction commits, then sees redeemed=true below.
    await tx.$queryRaw`SELECT id FROM pass_instance WHERE id = ${pass.id} FOR UPDATE`

    const fresh = await tx.passInstance.findUnique({
      where: { id: pass.id },
      select: { data: true },
    })
    const freshData = (fresh?.data as Record<string, unknown>) ?? {}
    const wasRedeemed = (freshData.redeemed as boolean) ?? false
    if (wasRedeemed) {
      if (!isUnlimited) throw new ApiError(409, "Conflict", "Coupon already redeemed")
      // Unlimited coupons: debounce so a double-tap doesn't issue two new passes
      const lastRedeemedAt = freshData.redeemedAt as string | undefined
      if (lastRedeemedAt && Date.now() - new Date(lastRedeemedAt).getTime() < 60_000) {
        throw new ApiError(409, "Conflict", "Coupon was just redeemed less than a minute ago")
      }
    }

    await tx.passInstance.update({
      where: { id: pass.id },
      data: {
        data: { ...freshData, redeemed: true, redeemedAt: new Date().toISOString() },
        status: isUnlimited ? "ACTIVE" : "COMPLETED",
      },
    })

    // Mark existing reward as redeemed
    const existing = await tx.reward.findFirst({
      where: { passInstanceId: pass.id, status: "AVAILABLE" },
      select: { id: true, description: true },
    })
    if (existing) {
      await tx.reward.update({
        where: { id: existing.id },
        data: {
          status: "REDEEMED",
          redeemedAt: new Date(),
          revealedAt: existing.description ? new Date() : undefined,
        },
      })
    }

    await tx.interaction.create({
      data: {
        contactId: pass.contact.id,
        organizationId: pass.contact.organizationId,
        passTemplateId: pass.passTemplate.id,
        passInstanceId: pass.id,
        performedById: performedByUserId,
        type: "COUPON_REDEEM",
        metadata: existing?.description ? { selectedPrize: existing.description } : {},
      },
    })

    await tx.contact.update({
      where: { id: pass.contact.id },
      data: { totalInteractions: { increment: 1 }, lastInteractionAt: new Date() },
    })

    // Reissue for unlimited coupons
    if (isUnlimited) {
      const newPi = await tx.passInstance.create({
        data: {
          contactId: pass.contact.id,
          passTemplateId: pass.passTemplate.id,
          walletProvider: "NONE",
          status: "ACTIVE",
          data: { redeemed: false },
        },
      })
      const rewardExpiryDays = (pass.passTemplate.config as Record<string, unknown>)?.rewardExpiryDays as number | undefined
      const newExpiresAt = config?.validUntil
        ? new Date(config.validUntil)
        : rewardExpiryDays && rewardExpiryDays > 0
          ? new Date(Date.now() + rewardExpiryDays * 86_400_000)
          : new Date(Date.now() + 365 * 86_400_000)
      const mg = parseMinigameConfig(pass.passTemplate.config)
      const newPrize = mg?.enabled && mg.prizes?.length ? weightedRandomPrize(mg.prizes) : null
      await tx.reward.create({
        data: {
          contactId: pass.contact.id,
          organizationId: pass.contact.organizationId,
          passTemplateId: pass.passTemplate.id,
          passInstanceId: newPi.id,
          status: "AVAILABLE",
          expiresAt: newExpiresAt,
          ...(newPrize ? { description: newPrize, revealedAt: null } : {}),
        },
      })
    }
  })

  dispatchWalletUpdate(pass.id, pass.walletProvider, "COUPON_REDEEM")
}

// ─── Wallet update dispatch ────────────────────────────────

function dispatchWalletUpdate(passInstanceId: string, walletProvider: string, updateType: string) {
  if (walletProvider === "NONE") return
  if (process.env.TRIGGER_SECRET_KEY) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) => tasks.trigger("update-wallet-pass", { passInstanceId, updateType }))
      .catch((err: unknown) => console.error("Wallet update dispatch failed:", err instanceof Error ? err.message : err))
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

"use server"

/**
 * interaction-actions.ts
 *
 * Facade module adapting stamp-actions and implementing coupon/membership/
 * points interaction actions for register-visit-dialog.tsx.
 *
 * InteractionSearchResult aliases StampSearchResult so both naming
 * conventions remain compatible.
 */

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import {
  assertAuthenticated,
  getOrganizationForUser,
  assertOrganizationAccess,
} from "@/lib/dal"
import { parseCouponConfig, parsePointsConfig, formatCouponValue, parseMinigameConfig, weightedRandomPrize } from "@/lib/pass-config"

// NOTE: stamp-actions exports (searchContactsForStamp, registerStamp, lookupPassInstanceByWalletPassId)
// must be imported directly from "@/server/stamp-actions" — Turbopack does not support
// re-exporting server actions across "use server" module boundaries.

// ─── Shared helper ────────────────────────────────────────────

async function fetchPassInstanceForInteraction(passInstanceId: string) {
  const t = await getTranslations("serverErrors")
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) return { error: t("noOrganization"), organization: null, passInstance: null }
  await assertOrganizationAccess(organization.id)

  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    include: {
      contact: {
        select: {
          id: true,
          organizationId: true,
          deletedAt: true,
          totalInteractions: true,
        },
      },
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          status: true,
          endsAt: true,
        },
      },
    },
  })

  if (!passInstance) return { error: t("passInstanceNotFound"), organization: null, passInstance: null }
  if (passInstance.contact.organizationId !== organization.id) return { error: t("passInstanceNotFound"), organization: null, passInstance: null }
  if (passInstance.contact.deletedAt) return { error: t("contactDeleted"), organization: null, passInstance: null }
  if (passInstance.status !== "ACTIVE") return { error: t("passStatus", { status: passInstance.status.toLowerCase() }), organization: null, passInstance: null }
  if (passInstance.passTemplate.status !== "ACTIVE") return { error: t("templateNoLongerActive"), organization: null, passInstance: null }
  if (passInstance.passTemplate.endsAt && passInstance.passTemplate.endsAt < new Date()) {
    return { error: t("templateExpired"), organization: null, passInstance: null }
  }

  return { error: null, organization, passInstance }
}

function dispatchWalletUpdate(passInstanceId: string, walletProvider: string, updateType: string) {
  if (walletProvider === "NONE") return
  if (process.env.TRIGGER_SECRET_KEY) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) => tasks.trigger("update-wallet-pass", { passInstanceId, updateType }))
      .catch((err: unknown) => console.error("Wallet pass update dispatch failed:", err instanceof Error ? err.message : "Unknown error"))
  } else if (walletProvider === "GOOGLE") {
    import("@/lib/wallet/google/update-pass")
      .then(({ notifyGooglePassUpdate }) => notifyGooglePassUpdate(passInstanceId))
      .catch((err: unknown) => console.error("Direct Google pass update failed:", err instanceof Error ? err.message : "Unknown error"))
  } else if (walletProvider === "APPLE") {
    import("@/lib/wallet/apple/update-pass")
      .then(({ notifyApplePassUpdate }) => notifyApplePassUpdate(passInstanceId))
      .catch((err: unknown) => console.error("Direct Apple pass update failed:", err instanceof Error ? err.message : "Unknown error"))
  }
}

// ─── Coupon Redemption ───────────────────────────────────────

export type RedeemCouponResult = {
  success: boolean
  error?: string
  templateName?: string
  discountText?: string
  selectedPrize?: string
  redemptionLimit?: "single" | "unlimited"
}

export async function redeemCoupon(
  passInstanceId: string
): Promise<RedeemCouponResult> {
  const t = await getTranslations("serverErrors")
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? t("unknownError") }
  }

  if (passInstance.passTemplate.passType !== "COUPON") {
    return { success: false, error: t("notACoupon") }
  }

  const config = parseCouponConfig(passInstance.passTemplate.config)
  const discountText = config ? formatCouponValue(config) : "Coupon"
  const isUnlimited = config?.redemptionLimit === "unlimited"

  // Find existing reward for this pass instance (created at issue time)
  let selectedPrize: string | undefined

  try {
  await db.$transaction(async (tx) => {
    // Re-read data inside transaction to prevent double redemption
    const fresh = await tx.passInstance.findUnique({
      where: { id: passInstance.id },
      select: { data: true },
    })
    const freshData = (fresh?.data as Record<string, unknown>) ?? {}
    if ((freshData.redeemed as boolean) ?? false) {
      throw new Error("ALREADY_REDEEMED")
    }

    // Mark coupon as redeemed in data JSON
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: { ...freshData, redeemed: true, redeemedAt: new Date().toISOString() },
        status: isUnlimited ? "ACTIVE" : "COMPLETED",
      },
    })

    // Mark existing reward as redeemed (created at issue time with prize description)
    const existingReward = await tx.reward.findFirst({
      where: { passInstanceId: passInstance.id, status: "AVAILABLE" },
      select: { id: true, description: true },
    })
    if (existingReward) {
      selectedPrize = existingReward.description ?? undefined
      await tx.reward.update({
        where: { id: existingReward.id },
        data: { status: "REDEEMED", redeemedAt: new Date(), revealedAt: existingReward.description ? new Date() : undefined },
      })
    }

    // Log interaction
    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "COUPON_REDEEM",
        metadata: { discountText, selectedPrize },
      },
    })

    // Update contact counters
    await tx.contact.update({
      where: { id: passInstance.contact.id },
      data: {
        totalInteractions: passInstance.contact.totalInteractions + 1,
        lastInteractionAt: new Date(),
      },
    })

    // For unlimited coupons, reissue a fresh pass instance with a new Reward
    if (isUnlimited) {
      const newPi = await tx.passInstance.create({
        data: {
          contactId: passInstance.contact.id,
          passTemplateId: passInstance.passTemplate.id,
          walletProvider: "NONE",
          status: "ACTIVE",
          data: { redeemed: false },
        },
      })

      const couponConfig2 = parseCouponConfig(passInstance.passTemplate.config)
      const rewardExpiryDays = (passInstance.passTemplate.config as Record<string, unknown>)?.rewardExpiryDays as number | undefined
      const newExpiresAt = couponConfig2?.validUntil
        ? new Date(couponConfig2.validUntil)
        : rewardExpiryDays && rewardExpiryDays > 0
          ? new Date(Date.now() + rewardExpiryDays * 86_400_000)
          : new Date(Date.now() + 365 * 86_400_000)

      const mgConfig = parseMinigameConfig(passInstance.passTemplate.config)
      const hasPrizes = mgConfig?.enabled && mgConfig.prizes?.length
      const newPrize = hasPrizes ? weightedRandomPrize(mgConfig.prizes!) : null

      await tx.reward.create({
        data: {
          contactId: passInstance.contact.id,
          organizationId: organization.id,
          passTemplateId: passInstance.passTemplate.id,
          passInstanceId: newPi.id,
          status: "AVAILABLE",
          expiresAt: newExpiresAt,
          ...(newPrize ? { description: newPrize, revealedAt: null } : {}),
        },
      })
    }
  })
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_REDEEMED") {
      return { success: false, error: t("couponAlreadyRedeemed") }
    }
    throw err
  }

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "COUPON_REDEEM")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/contacts")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    discountText,
    selectedPrize,
    redemptionLimit: isUnlimited ? "unlimited" : "single",
  }
}

// ─── Membership Check-in ─────────────────────────────────────

export type CheckInResult = {
  success: boolean
  error?: string
  templateName?: string
  totalCheckIns?: number
}

export async function checkInMember(
  passInstanceId: string
): Promise<CheckInResult> {
  const t = await getTranslations("serverErrors")
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? t("unknownError") }
  }

  if (passInstance.passTemplate.passType !== "MEMBERSHIP") {
    return { success: false, error: t("notAMembership") }
  }

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const totalCheckIns = ((instanceData.totalCheckIns as number) ?? 0) + 1

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: {
          ...instanceData,
          totalCheckIns,
          lastCheckInAt: new Date().toISOString(),
        },
      },
    })

    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "CHECK_IN",
        metadata: { totalCheckIns },
      },
    })

    await tx.contact.update({
      where: { id: passInstance.contact.id },
      data: {
        totalInteractions: passInstance.contact.totalInteractions + 1,
        lastInteractionAt: new Date(),
      },
    })
  })

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "CHECK_IN")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/contacts")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    totalCheckIns,
  }
}

// ─── Points Earn ─────────────────────────────────────────────

export type EarnPointsResult = {
  success: boolean
  error?: string
  templateName?: string
  pointsEarned?: number
  newBalance?: number
}

export async function earnPoints(
  passInstanceId: string
): Promise<EarnPointsResult> {
  const t = await getTranslations("serverErrors")
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? t("unknownError") }
  }

  if (passInstance.passTemplate.passType !== "POINTS") {
    return { success: false, error: t("notAPointsCard") }
  }

  const pConfig = parsePointsConfig(passInstance.passTemplate.config)
  const pointsPerVisit = pConfig?.pointsPerVisit ?? 1

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const oldBalance = (instanceData.pointsBalance as number) ?? 0
  const totalPointsEarned = (instanceData.totalPointsEarned as number) ?? 0
  const newBalance = oldBalance + pointsPerVisit

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: {
          ...instanceData,
          pointsBalance: newBalance,
          totalPointsEarned: totalPointsEarned + pointsPerVisit,
        },
      },
    })

    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "POINTS_EARN",
        metadata: { pointsEarned: pointsPerVisit, newBalance },
      },
    })

    await tx.contact.update({
      where: { id: passInstance.contact.id },
      data: {
        totalInteractions: passInstance.contact.totalInteractions + 1,
        lastInteractionAt: new Date(),
      },
    })
  })

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "POINTS_EARN")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/contacts")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    pointsEarned: pointsPerVisit,
    newBalance,
  }
}

// ─── Points Redeem ───────────────────────────────────────────

export type RedeemPointsResult = {
  success: boolean
  error?: string
  templateName?: string
  itemName?: string
  pointsSpent?: number
  newBalance?: number
}

export async function redeemPoints(
  passInstanceId: string,
  catalogItemId: string
): Promise<RedeemPointsResult> {
  const t = await getTranslations("serverErrors")
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? t("unknownError") }
  }

  if (passInstance.passTemplate.passType !== "POINTS") {
    return { success: false, error: t("notAPointsCard") }
  }

  const pConfig = parsePointsConfig(passInstance.passTemplate.config)
  const catalogItem = pConfig?.catalog.find((item) => item.id === catalogItemId)
  if (!catalogItem) {
    return { success: false, error: t("rewardNotInCatalog") }
  }

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const currentBalance = (instanceData.pointsBalance as number) ?? 0
  const totalPointsSpent = (instanceData.totalPointsSpent as number) ?? 0

  if (currentBalance < catalogItem.pointsCost) {
    return { success: false, error: t("notEnoughPoints", { needed: catalogItem.pointsCost, current: currentBalance }) }
  }

  const newBalance = currentBalance - catalogItem.pointsCost

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: {
          ...instanceData,
          pointsBalance: newBalance,
          totalPointsSpent: totalPointsSpent + catalogItem.pointsCost,
        },
      },
    })

    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "POINTS_REDEEM",
        metadata: { itemId: catalogItemId, itemName: catalogItem.name, pointsSpent: catalogItem.pointsCost, newBalance },
      },
    })

    await tx.reward.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        status: "REDEEMED",
        description: catalogItem.name,
        revealedAt: new Date(),
        redeemedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        pointsCost: catalogItem.pointsCost,
      },
    })

    await tx.contact.update({
      where: { id: passInstance.contact.id },
      data: {
        totalInteractions: passInstance.contact.totalInteractions + 1,
        lastInteractionAt: new Date(),
      },
    })
  })

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "POINTS_REDEEM")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/contacts")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    itemName: catalogItem.name,
    pointsSpent: catalogItem.pointsCost,
    newBalance,
  }
}


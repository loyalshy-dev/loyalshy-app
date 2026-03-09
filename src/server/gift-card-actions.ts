"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationAccess } from "@/lib/dal"
import { parseGiftCardConfig, formatGiftCardValue } from "@/lib/pass-config"

// ─── Shared helper (same pattern as interaction-actions) ─────

async function fetchPassInstanceForInteraction(passInstanceId: string) {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) return { error: "No organization found", organization: null, passInstance: null }
  await assertOrganizationAccess(organization.id)

  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    include: {
      contact: {
        select: { id: true, organizationId: true, deletedAt: true, totalInteractions: true },
      },
      passTemplate: {
        select: { id: true, name: true, passType: true, config: true, status: true, endsAt: true },
      },
    },
  })

  if (!passInstance) return { error: "Pass instance not found", organization: null, passInstance: null }
  if (passInstance.contact.organizationId !== organization.id) return { error: "Pass instance not found", organization: null, passInstance: null }
  if (passInstance.contact.deletedAt) return { error: "Contact has been deleted", organization: null, passInstance: null }
  if (passInstance.status !== "ACTIVE") return { error: `This pass is ${passInstance.status.toLowerCase()}`, organization: null, passInstance: null }
  if (passInstance.passTemplate.status !== "ACTIVE") return { error: "This pass template is no longer active", organization: null, passInstance: null }
  if (passInstance.passTemplate.endsAt && passInstance.passTemplate.endsAt < new Date()) {
    return { error: "This pass template has expired", organization: null, passInstance: null }
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

// ─── Gift Card Charge ────────────────────────────────────────

export type ChargeGiftCardResult = {
  success: boolean
  error?: string
  templateName?: string
  amountCharged?: number
  newBalanceCents?: number
  currency?: string
}

export async function chargeGiftCard(
  passInstanceId: string,
  amountCents: number
): Promise<ChargeGiftCardResult> {
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? "Unknown error" }
  }

  if (passInstance.passTemplate.passType !== "GIFT_CARD") {
    return { success: false, error: "This pass is not a gift card" }
  }

  if (amountCents <= 0) {
    return { success: false, error: "Charge amount must be positive" }
  }

  const config = parseGiftCardConfig(passInstance.passTemplate.config)
  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const currentBalance = (instanceData.balanceCents as number) ?? 0
  const totalCharged = (instanceData.totalChargedCents as number) ?? 0
  const currency = (instanceData.currency as string) ?? config?.currency ?? "USD"

  if (!config?.partialRedemption && amountCents !== currentBalance) {
    return { success: false, error: "Partial redemption not allowed — must charge full balance" }
  }

  if (amountCents > currentBalance) {
    return { success: false, error: `Insufficient balance. Have ${(currentBalance / 100).toFixed(2)}, need ${(amountCents / 100).toFixed(2)}` }
  }

  const newBalance = currentBalance - amountCents
  const isDepleted = newBalance <= 0

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: {
          ...instanceData,
          balanceCents: newBalance,
          totalChargedCents: totalCharged + amountCents,
        },
        status: isDepleted ? "COMPLETED" : "ACTIVE",
      },
    })

    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "GIFT_CHARGE",
        metadata: { amountCents, newBalanceCents: newBalance, currency },
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

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "GIFT_CHARGE")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/contacts")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    amountCharged: amountCents,
    newBalanceCents: newBalance,
    currency,
  }
}

// ─── Gift Card Refund ────────────────────────────────────────

export type RefundGiftCardResult = {
  success: boolean
  error?: string
  templateName?: string
  amountRefunded?: number
  newBalanceCents?: number
  currency?: string
}

export async function refundGiftCard(
  passInstanceId: string,
  amountCents: number
): Promise<RefundGiftCardResult> {
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? "Unknown error" }
  }

  if (passInstance.passTemplate.passType !== "GIFT_CARD") {
    return { success: false, error: "This pass is not a gift card" }
  }

  if (amountCents <= 0) {
    return { success: false, error: "Refund amount must be positive" }
  }

  const config = parseGiftCardConfig(passInstance.passTemplate.config)
  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const currentBalance = (instanceData.balanceCents as number) ?? 0
  const initialBalance = (instanceData.initialBalanceCents as number) ?? config?.initialBalanceCents ?? 0
  const currency = (instanceData.currency as string) ?? config?.currency ?? "USD"

  if (currentBalance + amountCents > initialBalance) {
    return { success: false, error: "Refund would exceed original balance" }
  }

  const newBalance = currentBalance + amountCents

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: { ...instanceData, balanceCents: newBalance },
        status: "ACTIVE",
      },
    })

    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "GIFT_REFUND",
        metadata: { amountCents, newBalanceCents: newBalance, currency },
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

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "GIFT_REFUND")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/contacts")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    amountRefunded: amountCents,
    newBalanceCents: newBalance,
    currency,
  }
}

"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationAccess } from "@/lib/dal"
import { parseTransitConfig } from "@/lib/pass-config"

// ─── Shared helper ──────────────────────────────────────────

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
  }
}

// ─── Transit Board ───────────────────────────────────────────

export type TransitBoardResult = {
  success: boolean
  error?: string
  templateName?: string
  transitType?: string
  originName?: string
  destinationName?: string
}

export async function transitBoard(
  passInstanceId: string
): Promise<TransitBoardResult> {
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? "Unknown error" }
  }

  if (passInstance.passTemplate.passType !== "TRANSIT") {
    return { success: false, error: "This pass is not a transit pass" }
  }

  const config = parseTransitConfig(passInstance.passTemplate.config)
  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const isBoarded = (instanceData.isBoarded as boolean) ?? false

  if (isBoarded) {
    return { success: false, error: "Already boarded — exit first before re-boarding" }
  }

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: {
          ...instanceData,
          isBoarded: true,
          boardedAt: new Date().toISOString(),
          exitedAt: undefined,
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
        type: "TRANSIT_BOARD",
        metadata: {
          transitType: config?.transitType ?? "other",
          originName: config?.originName,
          destinationName: config?.destinationName,
        },
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

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "TRANSIT_BOARD")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    transitType: config?.transitType,
    originName: config?.originName,
    destinationName: config?.destinationName,
  }
}

// ─── Transit Exit ────────────────────────────────────────────

export type TransitExitResult = {
  success: boolean
  error?: string
  templateName?: string
}

export async function transitExit(
  passInstanceId: string
): Promise<TransitExitResult> {
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? "Unknown error" }
  }

  if (passInstance.passTemplate.passType !== "TRANSIT") {
    return { success: false, error: "This pass is not a transit pass" }
  }

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const isBoarded = (instanceData.isBoarded as boolean) ?? false

  if (!isBoarded) {
    return { success: false, error: "Not currently boarded" }
  }

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: {
          ...instanceData,
          isBoarded: false,
          exitedAt: new Date().toISOString(),
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
        type: "TRANSIT_EXIT",
        metadata: {},
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

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "TRANSIT_EXIT")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
  }
}

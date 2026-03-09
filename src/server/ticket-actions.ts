"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationAccess } from "@/lib/dal"
import { parseTicketConfig } from "@/lib/pass-config"

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
  } else if (walletProvider === "APPLE") {
    import("@/lib/wallet/apple/update-pass")
      .then(({ notifyApplePassUpdate }) => notifyApplePassUpdate(passInstanceId))
      .catch((err: unknown) => console.error("Direct Apple pass update failed:", err instanceof Error ? err.message : "Unknown error"))
  }
}

// ─── Ticket Scan ─────────────────────────────────────────────

export type ScanTicketResult = {
  success: boolean
  error?: string
  templateName?: string
  scanCount?: number
  maxScans?: number
  eventName?: string
  isMaxedOut?: boolean
}

export async function scanTicket(
  passInstanceId: string
): Promise<ScanTicketResult> {
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? "Unknown error" }
  }

  if (passInstance.passTemplate.passType !== "TICKET") {
    return { success: false, error: "This pass is not a ticket" }
  }

  const config = parseTicketConfig(passInstance.passTemplate.config)
  const maxScans = config?.maxScans ?? 1
  const eventName = config?.eventName ?? "Event"

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const currentScans = (instanceData.scanCount as number) ?? 0

  if (passInstance.status !== "ACTIVE") {
    return { success: false, error: `This ticket is ${passInstance.status.toLowerCase()}` }
  }

  if (currentScans >= maxScans) {
    return { success: false, error: `Maximum scans reached (${maxScans})` }
  }

  const newScanCount = currentScans + 1
  const isMaxedOut = newScanCount >= maxScans
  const now = new Date().toISOString()

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: {
          ...instanceData,
          scanCount: newScanCount,
          firstScannedAt: instanceData.firstScannedAt ?? now,
          lastScannedAt: now,
        },
        status: isMaxedOut ? "COMPLETED" : "ACTIVE",
      },
    })

    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "TICKET_SCAN",
        metadata: { scanCount: newScanCount, maxScans },
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

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "TICKET_SCAN")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/contacts")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    scanCount: newScanCount,
    maxScans,
    eventName,
    isMaxedOut,
  }
}

// ─── Ticket Void ─────────────────────────────────────────────

export type VoidTicketResult = {
  success: boolean
  error?: string
  templateName?: string
}

export async function voidTicket(
  passInstanceId: string
): Promise<VoidTicketResult> {
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? "Unknown error" }
  }

  if (passInstance.passTemplate.passType !== "TICKET") {
    return { success: false, error: "This pass is not a ticket" }
  }

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: { ...instanceData, voidedAt: new Date().toISOString() },
        status: "VOIDED",
      },
    })

    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "TICKET_VOID",
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

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "TICKET_VOID")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/contacts")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
  }
}

"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationAccess } from "@/lib/dal"
import { parseBusinessIdConfig } from "@/lib/pass-config"

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
  } else if (walletProvider === "APPLE") {
    import("@/lib/wallet/apple/update-pass")
      .then(({ notifyApplePassUpdate }) => notifyApplePassUpdate(passInstanceId))
      .catch((err: unknown) => console.error("Direct Apple pass update failed:", err instanceof Error ? err.message : "Unknown error"))
  }
}

// ─── ID Verify ───────────────────────────────────────────────

export type VerifyIdResult = {
  success: boolean
  error?: string
  templateName?: string
  totalVerifications?: number
  idLabel?: string
  contactName?: string
}

export async function verifyId(
  passInstanceId: string
): Promise<VerifyIdResult> {
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? "Unknown error" }
  }

  if (passInstance.passTemplate.passType !== "BUSINESS_ID") {
    return { success: false, error: "This pass is not a business ID" }
  }

  const config = parseBusinessIdConfig(passInstance.passTemplate.config)
  const idLabel = config?.idLabel ?? "ID"

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const totalVerifications = ((instanceData.totalVerifications as number) ?? 0) + 1

  // Fetch contact name for verification display
  const contact = await db.contact.findUnique({
    where: { id: passInstance.contact.id },
    select: { fullName: true },
  })

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: {
          ...instanceData,
          totalVerifications,
          lastVerifiedAt: new Date().toISOString(),
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
        type: "ID_VERIFY",
        metadata: { totalVerifications },
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

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "ID_VERIFY")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    totalVerifications,
    idLabel,
    contactName: contact?.fullName,
  }
}

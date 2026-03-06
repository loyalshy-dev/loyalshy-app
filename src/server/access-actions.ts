"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationAccess } from "@/lib/dal"
import { parseAccessConfig } from "@/lib/pass-config"

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
  }
}

// ─── Access Grant ────────────────────────────────────────────

export type GrantAccessResult = {
  success: boolean
  error?: string
  templateName?: string
  totalGranted?: number
  todayGranted?: number
  accessLabel?: string
}

export async function grantAccess(
  passInstanceId: string
): Promise<GrantAccessResult> {
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? "Unknown error" }
  }

  if (passInstance.passTemplate.passType !== "ACCESS") {
    return { success: false, error: "This pass is not an access pass" }
  }

  const config = parseAccessConfig(passInstance.passTemplate.config)
  const accessLabel = config?.accessLabel ?? "Access"
  const maxDailyUses = config?.maxDailyUses

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const totalGranted = ((instanceData.totalGranted as number) ?? 0) + 1
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const storedDate = (instanceData.todayDate as string) ?? ""
  const todayGranted = storedDate === today ? ((instanceData.todayGranted as number) ?? 0) + 1 : 1

  // Check day-of-week restrictions
  if (config?.validDays && config.validDays.length > 0) {
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    const todayDay = dayNames[new Date().getDay()]
    if (!config.validDays.includes(todayDay)) {
      return { success: false, error: `Access not available on ${todayDay}` }
    }
  }

  // Check time restrictions
  if (config?.validTimeStart && config?.validTimeEnd) {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const [startH, startM] = config.validTimeStart.split(":").map(Number)
    const [endH, endM] = config.validTimeEnd.split(":").map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return { success: false, error: `Access only available ${config.validTimeStart}–${config.validTimeEnd}` }
    }
  }

  // Check daily usage limit
  if (maxDailyUses && todayGranted > maxDailyUses) {
    return { success: false, error: `Daily limit reached (${maxDailyUses} uses per day)` }
  }

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: {
          ...instanceData,
          totalGranted,
          todayGranted,
          todayDate: today,
          lastGrantedAt: new Date().toISOString(),
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
        type: "ACCESS_GRANT",
        metadata: { totalGranted, todayGranted },
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

  dispatchWalletUpdate(passInstance.id, passInstance.walletProvider, "ACCESS_GRANT")

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    totalGranted,
    todayGranted,
    accessLabel,
  }
}

// ─── Access Deny ─────────────────────────────────────────────

export type DenyAccessResult = {
  success: boolean
  error?: string
  templateName?: string
  reason?: string
}

export async function denyAccess(
  passInstanceId: string,
  reason?: string
): Promise<DenyAccessResult> {
  const session = await assertAuthenticated()
  const { error, organization, passInstance } = await fetchPassInstanceForInteraction(passInstanceId)

  if (error || !organization || !passInstance) {
    return { success: false, error: error ?? "Unknown error" }
  }

  if (passInstance.passTemplate.passType !== "ACCESS") {
    return { success: false, error: "This pass is not an access pass" }
  }

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const totalDenied = ((instanceData.totalDenied as number) ?? 0) + 1

  await db.$transaction(async (tx) => {
    await tx.passInstance.update({
      where: { id: passInstance.id },
      data: {
        data: { ...instanceData, totalDenied },
      },
    })

    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: passInstance.passTemplate.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "ACCESS_DENY",
        metadata: { totalDenied, reason: reason ?? "Access denied" },
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

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")

  return {
    success: true,
    templateName: passInstance.passTemplate.name,
    reason,
  }
}

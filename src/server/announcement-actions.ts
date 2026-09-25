"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { assertOrganizationRole, getCurrentUser, getOrganizationForUser } from "@/lib/dal"
import {
  getAnnouncementQuota,
  countProgramSendsLast24h,
  ANNOUNCEMENT_PROGRAM_MAX_PER_24H,
} from "@/lib/announcement-quota"
import { getPlanLimits, type PlanId } from "@/lib/plans"
import type { Prisma } from "@prisma/client"

const sendAnnouncementSchema = z.object({
  templateId: z.string().min(1),
  message: z.string().trim().min(1).max(160),
})

export type AnnouncementErrorCode =
  | "quotaReached"
  | "programDailyCap"
  | "subscriptionInactive"

export type SendAnnouncementResult =
  | { success: true; recipients: number; remaining: number | null }
  | { error: string; code?: AnnouncementErrorCode; nextAvailableAt?: string | null }

type QuotaCheck =
  | { ok: true; recipients: number; remaining: number | null }
  | { ok: false; code: AnnouncementErrorCode; nextAvailableAt: string | null }

/**
 * Broadcasts a short announcement (e.g. "2x1 today") to every wallet pass of
 * a program. Google holders are notified via ONE class-level TEXT_AND_NOTIFY
 * PATCH; Apple holders via the standard per-instance APNs push → the device
 * re-fetches the pass and the announcement back field's changeMessage fires
 * the lock-screen banner.
 */
export async function sendProgramAnnouncement(input: {
  templateId: string
  message: string
}): Promise<SendAnnouncementResult> {
  const t = await getTranslations("serverErrors")

  const parsed = sendAnnouncementSchema.safeParse(input)
  if (!parsed.success) {
    return { error: t("invalidInput") }
  }
  const { templateId, message } = parsed.data

  const organization = await getOrganizationForUser()
  if (!organization) {
    return { error: t("noOrganization") }
  }
  await assertOrganizationRole(organization.id, "admin")

  const template = await db.passTemplate.findFirst({
    where: { id: templateId, organizationId: organization.id },
    select: { id: true, name: true, status: true },
  })
  if (!template) {
    return { error: t("templateNotFound") }
  }
  if (template.status !== "ACTIVE") {
    return { error: t("announcementProgramNotActive") }
  }

  const session = await getCurrentUser()
  const now = new Date()

  // Check quota + record the send atomically. The per-org advisory lock
  // serializes concurrent sends so two clicks can't both pass the check.
  const check: QuotaCheck = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`announcement:${organization.id}`}))`

    const quota = await getAnnouncementQuota(tx, organization, now)
    if (quota.inactive) {
      return { ok: false, code: "subscriptionInactive", nextAvailableAt: null }
    }
    if (quota.remaining === 0) {
      return { ok: false, code: "quotaReached", nextAvailableAt: quota.nextAvailableAt }
    }
    const programSends = await countProgramSendsLast24h(tx, template.id, now)
    if (programSends >= ANNOUNCEMENT_PROGRAM_MAX_PER_24H) {
      return { ok: false, code: "programDailyCap", nextAvailableAt: null }
    }

    const recipients = await tx.passInstance.count({
      where: {
        passTemplateId: template.id,
        status: "ACTIVE",
        walletProvider: { not: "NONE" },
      },
    })

    await tx.programAnnouncement.create({
      data: {
        organizationId: organization.id,
        passTemplateId: template.id,
        sentById: session?.user.id ?? null,
        message,
        recipients,
        createdAt: now,
      },
    })
    await tx.passTemplate.update({
      where: { id: template.id },
      data: {
        announcement: { message, sentAt: now.toISOString() } as Prisma.InputJsonValue,
      },
    })

    return {
      ok: true,
      recipients,
      remaining: quota.remaining === null ? null : quota.remaining - 1,
    }
  })

  if (!check.ok) {
    const errorKey = {
      quotaReached:
        getPlanLimits(organization.plan as PlanId).announcementPeriod === "lifetime"
          ? "announcementQuotaReachedFree"
          : "announcementQuotaReachedWeek",
      programDailyCap: "announcementProgramDailyCap",
      subscriptionInactive: "announcementSubscriptionInactive",
    }[check.code]
    return { error: t(errorKey), code: check.code, nextAvailableAt: check.nextAvailableAt }
  }
  const { recipients } = check

  // Google: one class-level PATCH notifies every Google Wallet holder.
  // Best-effort — an API hiccup must not fail the send (Apple leg + stored
  // announcement still went through).
  try {
    const { sendGoogleClassAnnouncement } = await import("@/lib/wallet/google/announce")
    await sendGoogleClassAnnouncement({
      templateId: template.id,
      organizationName: organization.name,
      message,
      sentAt: now,
    })
  } catch (err) {
    console.error(
      "Google class announcement failed:",
      err instanceof Error ? err.message : "Unknown error"
    )
  }

  // Apple (and Google object refresh): fan out per-instance updates. Each
  // notifyApplePassUpdate touches updatedAt + APNs-pushes, so devices
  // re-fetch and the announcement field change fires the banner.
  if (process.env.TRIGGER_SECRET_KEY) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-all-passes", {
          organizationId: organization.id,
          templateId: template.id,
          reason: "TEMPLATE_CHANGE",
        })
      )
      .catch((err: unknown) =>
        console.error("Failed to trigger bulk pass update:", err instanceof Error ? err.message : "Unknown error")
      )
  } else {
    import("@/lib/wallet/apple/update-pass")
      .then(async ({ notifyApplePassUpdate }) => {
        const instances = await db.passInstance.findMany({
          where: { passTemplateId: template.id, walletProvider: "APPLE" },
          select: { id: true },
        })
        await Promise.allSettled(instances.map((pi) => notifyApplePassUpdate(pi.id)))
      })
      .catch((err: unknown) =>
        console.error("Direct Apple pass update failed:", err instanceof Error ? err.message : "Unknown error")
      )
    import("@/lib/wallet/google/update-pass")
      .then(async ({ notifyGooglePassUpdate }) => {
        const instances = await db.passInstance.findMany({
          where: { passTemplateId: template.id, walletProvider: "GOOGLE" },
          select: { id: true },
        })
        await Promise.allSettled(instances.map((pi) => notifyGooglePassUpdate(pi.id)))
      })
      .catch((err: unknown) =>
        console.error("Direct Google pass update failed:", err instanceof Error ? err.message : "Unknown error")
      )
  }

  revalidatePath(`/dashboard/programs/${template.id}/distribution`)
  return { success: true, recipients, remaining: check.remaining }
}

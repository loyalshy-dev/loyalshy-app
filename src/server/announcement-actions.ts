"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"
import {
  parseTemplateAnnouncement,
  recentAnnouncementSends,
  ANNOUNCEMENT_MAX_PER_24H,
} from "@/lib/pass-config"
import type { Prisma } from "@prisma/client"

const sendAnnouncementSchema = z.object({
  templateId: z.string().min(1),
  message: z.string().trim().min(1).max(160),
})

export type SendAnnouncementResult =
  | { success: true; recipients: number }
  | { error: string; remainingQuota?: number }

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
    select: { id: true, name: true, status: true, announcement: true },
  })
  if (!template) {
    return { error: t("templateNotFound") }
  }
  if (template.status !== "ACTIVE") {
    return { error: t("announcementProgramNotActive") }
  }

  // Quota: at most 3 sends per rolling 24h per template
  const now = new Date()
  const existing = parseTemplateAnnouncement(template.announcement)
  const recentSends = recentAnnouncementSends(existing, now)
  if (recentSends.length >= ANNOUNCEMENT_MAX_PER_24H) {
    return { error: t("announcementQuotaReached"), remainingQuota: 0 }
  }

  const announcement = {
    message,
    sentAt: now.toISOString(),
    history: [...recentSends, now.toISOString()].slice(-10),
  }

  const [, recipients] = await Promise.all([
    db.passTemplate.update({
      where: { id: template.id },
      data: { announcement: announcement as Prisma.InputJsonValue },
    }),
    db.passInstance.count({
      where: {
        passTemplateId: template.id,
        status: "ACTIVE",
        walletProvider: { not: "NONE" },
      },
    }),
  ])

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
  return { success: true, recipients }
}

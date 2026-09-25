import { db } from "@/lib/db"
import {
  getAnnouncementQuota,
  countProgramSendsLast24h,
  ANNOUNCEMENT_PROGRAM_MAX_PER_24H,
} from "@/lib/announcement-quota"
import type { Prisma } from "@prisma/client"

/**
 * Core of a program announcement (wallet broadcast), shared by the dashboard
 * server action (src/server/announcement-actions.ts) and the staff-app route
 * (POST /api/v1/announcements). Callers own auth, role checks, input
 * validation and user-facing error copy; this owns quota, bookkeeping and
 * dispatch.
 */

export const ANNOUNCEMENT_MAX_LENGTH = 160

export type AnnouncementErrorCode =
  | "quotaReached"
  | "programDailyCap"
  | "noRecipients"
  | "subscriptionInactive"

export type AnnouncementOutcome =
  | { ok: true; templateId: string; recipients: number; remaining: number | null }
  | { ok: false; code: AnnouncementErrorCode | "templateNotFound" | "programNotActive"; nextAvailableAt: string | null }

type QuotaCheck =
  | { ok: true; recipients: number; remaining: number | null }
  | { ok: false; code: AnnouncementErrorCode; nextAvailableAt: string | null }

/** Runs dispatch work. Route handlers pass `after` so Vercel keeps the Lambda alive. */
export type BackgroundScheduler = (task: () => Promise<void>) => void

const fireAndForget: BackgroundScheduler = (task) => {
  void task()
}

export async function sendAnnouncement(params: {
  organization: { id: string; name: string; plan: string; subscriptionStatus: string }
  sentById: string | null
  templateId: string
  message: string
  schedule?: BackgroundScheduler
}): Promise<AnnouncementOutcome> {
  const { organization, sentById, templateId, message } = params
  const schedule = params.schedule ?? fireAndForget

  const template = await db.passTemplate.findFirst({
    where: { id: templateId, organizationId: organization.id },
    select: { id: true, name: true, status: true },
  })
  if (!template) return { ok: false, code: "templateNotFound", nextAvailableAt: null }
  if (template.status !== "ACTIVE") return { ok: false, code: "programNotActive", nextAvailableAt: null }

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
    // Nobody to notify — don't burn quota (Free has only 2, ever)
    if (recipients === 0) {
      return { ok: false, code: "noRecipients", nextAvailableAt: null }
    }

    await tx.programAnnouncement.create({
      data: {
        organizationId: organization.id,
        passTemplateId: template.id,
        sentById,
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

  if (!check.ok) return check

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
    schedule(() =>
      import("@trigger.dev/sdk")
        .then(({ tasks }) =>
          tasks.trigger("update-all-passes", {
            organizationId: organization.id,
            templateId: template.id,
            reason: "TEMPLATE_CHANGE",
          })
        )
        .then(() => undefined)
        .catch((err: unknown) =>
          console.error("Failed to trigger bulk pass update:", err instanceof Error ? err.message : "Unknown error")
        )
    )
  } else {
    schedule(() =>
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
    )
    schedule(() =>
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
    )
  }

  return { ok: true, templateId: template.id, recipients: check.recipients, remaining: check.remaining }
}

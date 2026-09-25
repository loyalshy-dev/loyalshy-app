"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { assertOrganizationRole, getCurrentUser, getOrganizationForUser } from "@/lib/dal"
import { sendAnnouncement, ANNOUNCEMENT_MAX_LENGTH, type AnnouncementErrorCode } from "@/lib/announcements"
import { getAnnouncementUpgrade, getPlanLimits, type PlanId } from "@/lib/plans"

const sendAnnouncementSchema = z.object({
  templateId: z.string().min(1),
  message: z.string().trim().min(1).max(ANNOUNCEMENT_MAX_LENGTH),
})

export type { AnnouncementErrorCode }

export type SendAnnouncementResult =
  | { success: true; recipients: number; remaining: number | null }
  | { error: string; code?: AnnouncementErrorCode; nextAvailableAt?: string | null }

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

  const session = await getCurrentUser()
  const outcome = await sendAnnouncement({
    organization,
    sentById: session?.user.id ?? null,
    templateId,
    message,
  })

  if (!outcome.ok) {
    if (outcome.code === "templateNotFound") return { error: t("templateNotFound") }
    if (outcome.code === "programNotActive") return { error: t("announcementProgramNotActive") }
    const plan = organization.plan as PlanId
    const errorKey = {
      quotaReached:
        getPlanLimits(plan).announcementPeriod === "lifetime"
          ? "announcementQuotaReachedFree"
          : getAnnouncementUpgrade(plan)
            ? "announcementQuotaReachedWeek"
            : "announcementQuotaReachedWeekTopPlan",
      programDailyCap: "announcementProgramDailyCap",
      noRecipients: "announcementNoRecipients",
      subscriptionInactive: "announcementSubscriptionInactive",
    }[outcome.code]
    return { error: t(errorKey), code: outcome.code, nextAvailableAt: outcome.nextAvailableAt }
  }

  revalidatePath(`/dashboard/programs/${outcome.templateId}/distribution`)
  return { success: true, recipients: outcome.recipients, remaining: outcome.remaining }
}

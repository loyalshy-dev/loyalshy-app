"use server"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"
import { orgAllowsFeature } from "@/lib/plan-access"
import { refreshOrgPasses } from "@/lib/wallet/refresh-org-passes"
import { winbackSettingsSchema, type WinbackSettingsInput } from "@/lib/winback/config"
import { countWinbackCandidates } from "@/lib/winback/engine"

export type SaveWinbackSettingsResult = { success: true } | { error: string }

/**
 * Saves the org's win-back settings (owner + admin). Turning it on needs a
 * paid plan. Every off→on switch restarts the "only from now on" clock and
 * silently refreshes all passes so the placeholder field is on the devices
 * before the first message (iOS doesn't banner a brand-new field).
 */
export async function saveWinbackSettings(input: WinbackSettingsInput): Promise<SaveWinbackSettingsResult> {
  const t = await getTranslations("serverErrors")
  const organization = await getOrganizationForUser()
  if (!organization) return { error: t("noOrganization") }
  await assertOrganizationRole(organization.id, "admin")

  const parsed = winbackSettingsSchema.safeParse(input)
  if (!parsed.success) return { error: t("invalidInput") }
  const data = parsed.data

  if (data.enabled && !(await orgAllowsFeature(organization, "winback"))) {
    return { error: t("winbackPlanRequired") }
  }

  const previous = await db.winbackSettings.findUnique({
    where: { organizationId: organization.id },
    select: { enabled: true, startedAt: true },
  })
  const turningOn = data.enabled && !previous?.enabled

  const values = {
    enabled: data.enabled,
    inactiveDays: data.inactiveDays,
    message: data.message,
    holdout: data.holdout,
    includeExisting: data.includeExisting,
    ...(turningOn ? { startedAt: new Date() } : {}),
  }
  await db.winbackSettings.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, ...values },
    update: values,
  })

  if (turningOn) refreshOrgPasses(organization.id)

  revalidatePath("/dashboard/automations/winback")
  return { success: true }
}

/** Live counter on the settings page. */
export async function countWinbackEligible(input: {
  inactiveDays: number
  includeExisting: boolean
}): Promise<{ eligible: number; reachable: number } | null> {
  const parsed = winbackSettingsSchema
    .pick({ inactiveDays: true, includeExisting: true })
    .safeParse(input)
  if (!parsed.success) return null
  const organization = await getOrganizationForUser()
  if (!organization) return null
  await assertOrganizationRole(organization.id, "admin")

  const settings = await db.winbackSettings.findUnique({
    where: { organizationId: organization.id },
    select: { enabled: true, startedAt: true },
  })
  return countWinbackCandidates({
    organizationId: organization.id,
    inactiveDays: parsed.data.inactiveDays,
    includeExisting: parsed.data.includeExisting,
    // Not on yet: "from now on" means nobody qualifies today.
    startedAt: settings?.enabled ? settings.startedAt : null,
  })
}

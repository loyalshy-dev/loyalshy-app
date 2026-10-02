"use server"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"
import { proximitySettingsSchema, type ProximitySettingsInput } from "@/lib/proximity/config"
import { refreshOrgPasses } from "@/lib/wallet/refresh-org-passes"

export type SaveProximitySettingsResult = { success: true } | { error: string }

/**
 * Saves the business location for "near your business" (owner + admin, all
 * plans). The address/coords are mirrored into every program's design — the
 * address shown on the pass and the Google Maps link stay the business's —
 * and every pass is refreshed silently (Google classes resynced for the
 * link; Apple pushed for the lock-screen location).
 */
export async function saveProximitySettings(input: ProximitySettingsInput): Promise<SaveProximitySettingsResult> {
  const t = await getTranslations("serverErrors")
  const organization = await getOrganizationForUser()
  if (!organization) return { error: t("noOrganization") }
  await assertOrganizationRole(organization.id, "admin")

  const parsed = proximitySettingsSchema.safeParse(input)
  if (!parsed.success) return { error: t("invalidInput") }
  const data = parsed.data

  const values = {
    enabled: data.enabled,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    message: data.message || null,
  }
  await db.$transaction([
    db.proximitySettings.upsert({
      where: { organizationId: organization.id },
      create: { organizationId: organization.id, ...values },
      update: values,
    }),
    db.passDesign.updateMany({
      where: { passTemplate: { organizationId: organization.id } },
      data: { mapAddress: data.address, mapLatitude: data.latitude, mapLongitude: data.longitude },
    }),
  ])

  refreshOrgPasses(organization.id, { syncGoogleClasses: true })

  revalidatePath("/dashboard/automations/proximity")
  return { success: true }
}

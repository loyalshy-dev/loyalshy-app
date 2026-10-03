"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { getLocale, getTranslations } from "next-intl/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"
import { orgAllowsReviewPrompts } from "@/lib/reviews/access"
import { reviewSettingsSchema, resolveReviewUrl, type ReviewSettingsInput } from "@/lib/reviews/config"
import { searchBusinesses, type BusinessSuggestion } from "@/lib/reviews/places"
import { snapshotPlaceRating } from "@/lib/reviews/snapshots"

export type SaveReviewSettingsResult = { success: true } | { error: string }

/**
 * Saves the org's Google review prompt. Owner + admin ("Program manager",
 * so partners can set it up for a client). Turning it on needs a plan with
 * review prompts; saving it off is always allowed. A newly picked business
 * gets an immediate rating snapshot — the "before" point of the chart.
 */
export async function saveReviewSettings(input: ReviewSettingsInput): Promise<SaveReviewSettingsResult> {
  const t = await getTranslations("serverErrors")

  const organization = await getOrganizationForUser()
  if (!organization) return { error: t("noOrganization") }
  await assertOrganizationRole(organization.id, "admin")

  const parsed = reviewSettingsSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message
    if (issue === "missingTarget") return { error: t("reviewMissingTarget") }
    if (issue === "invalidUrl") return { error: t("reviewInvalidUrl") }
    return { error: t("invalidInput") }
  }
  const data = parsed.data

  if (data.enabled && !(await orgAllowsReviewPrompts(organization))) {
    return { error: t("reviewPlanRequired") }
  }

  const previous = await db.googleReviewSettings.findUnique({
    where: { organizationId: organization.id },
    select: { placeId: true },
  })

  const values = {
    enabled: data.enabled,
    placeId: data.placeId,
    placeName: data.placeId ? data.placeName : null,
    reviewUrl: resolveReviewUrl(data),
    triggerStamp: data.triggerStamp,
    message: data.message,
    linkLabel: data.linkLabel,
  }
  await db.googleReviewSettings.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, ...values },
    update: values,
  })

  const newPlaceId = data.placeId
  if (newPlaceId && newPlaceId !== previous?.placeId) {
    const organizationId = organization.id
    after(async () => {
      try {
        await snapshotPlaceRating(organizationId, newPlaceId)
      } catch (err) {
        console.error("[google-ratings] baseline snapshot failed:", err instanceof Error ? err.message : err)
      }
    })
  }

  revalidatePath("/dashboard/automations/reviews")
  return { success: true }
}

const searchSchema = z.string().trim().min(2).max(120)

/** Business search for the "find your business" picker. */
export async function searchReviewBusinesses(query: string): Promise<BusinessSuggestion[]> {
  const parsed = searchSchema.safeParse(query)
  if (!parsed.success) return []
  const organization = await getOrganizationForUser()
  if (!organization) return []
  await assertOrganizationRole(organization.id, "admin")
  return searchBusinesses(parsed.data, await getLocale())
}

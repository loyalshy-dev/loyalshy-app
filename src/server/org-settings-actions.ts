"use server"

import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { addDays } from "date-fns"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"
import { sanitizeText } from "@/lib/sanitize"
import { validateTemplateConfig } from "@/lib/pass-config"
import { checkTemplateLimit, checkPassTypeAllowed } from "@/server/billing-actions"
import { computeDesignHash, computeTextColor } from "@/lib/wallet/card-design"
import type { PatternStyle, ProgressStyle, LabelFormat, SocialLinks } from "@/lib/wallet/card-design"
import type { DesignCardType } from "@/types/pass-types"

// ─── Types ─────────────────────────────────────────────────

export type TemplateWithDesign = {
  id: string
  name: string
  passType: string
  config: unknown
  termsAndConditions: string | null
  status: string
  startsAt: Date
  endsAt: Date | null
  createdAt: Date
  passInstanceCount: number
  passDesign: {
    cardType: DesignCardType
    showStrip: boolean
    primaryColor: string | null
    secondaryColor: string | null
    textColor: string | null
    stripImageUrl: string | null
    stripImageApple: string | null
    stripImageGoogle: string | null
    patternStyle: PatternStyle
    progressStyle: ProgressStyle
    labelFormat: LabelFormat
    customProgressLabel: string | null
    generatedStripApple: string | null
    generatedStripGoogle: string | null
    palettePreset: string | null
    templateId: string | null
    businessHours: string | null
    mapAddress: string | null
    mapLatitude: number | null
    mapLongitude: number | null
    socialLinks: SocialLinks
    customMessage: string | null
    designHash: string
  } | null
}

// ─── Schemas ────────────────────────────────────────────────

const updateProfileSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1, "Organization name is required").max(100),
  address: z.string().max(200).optional().default(""),
  phone: z.string().max(30).optional().default(""),
  website: z.string().url("Invalid URL").max(200).or(z.literal("")).optional().default(""),
  timezone: z.string().min(1),
})

const updatePassTemplateSchema = z.object({
  organizationId: z.string().min(1),
  templateId: z.string().min(1),
  name: z.string().min(1, "Template name is required").max(100),
  termsAndConditions: z.string().max(5000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  resetProgress: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

const savePassDesignSchema = z.object({
  templateId: z.string().min(1),
  cardType: z.enum(["STAMP", "COUPON"]).optional().default("STAMP"),
  showStrip: z.boolean(),
  primaryColor: z.string().max(20).optional().default(""),
  secondaryColor: z.string().max(20).optional().default(""),
  textColor: z.string().max(20).optional().default(""),
  labelColor: z.string().max(20).nullable().optional(),
  autoTextColor: z.boolean().optional().default(false),
  patternStyle: z.enum(["NONE", "DOTS", "WAVES", "GEOMETRIC", "CHEVRON", "CROSSHATCH", "DIAMONDS", "CONFETTI", "SOLID_PRIMARY", "SOLID_SECONDARY", "STAMP_GRID"]),
  progressStyle: z.enum(["NUMBERS", "CIRCLES", "SQUARES", "STARS", "STAMPS", "PERCENTAGE", "REMAINING"]).optional().default("NUMBERS"),
  labelFormat: z.enum(["UPPERCASE", "TITLE_CASE", "LOWERCASE"]).optional().default("UPPERCASE"),
  customProgressLabel: z.string().max(30).optional().default(""),
  palettePreset: z.string().max(30).nullable().optional(),
  templateId2: z.string().max(50).nullable().optional(),
  businessHours: z.string().max(1000).optional().default(""),
  mapAddress: z.string().max(500).optional().default(""),
  mapLatitude: z.number().min(-90).max(90).nullable().optional(),
  mapLongitude: z.number().min(-180).max(180).nullable().optional(),
  socialLinks: z.object({
    instagram: z.string().max(200).optional().default(""),
    facebook: z.string().max(200).optional().default(""),
    tiktok: z.string().max(200).optional().default(""),
    x: z.string().max(200).optional().default(""),
  }).optional(),
  customMessage: z.string().max(2000).optional().default(""),
  stripOpacity: z.number().min(0).max(1).optional().default(1),
  stripGrayscale: z.boolean().optional().default(false),
  stripColor1: z.string().max(20).nullable().optional(),
  stripColor2: z.string().max(20).nullable().optional(),
  stripFill: z.enum(["flat", "gradient"]).optional().default("gradient"),
  patternColor: z.string().max(20).nullable().optional(),
  stripImagePosition: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }).optional(),
  stripImageZoom: z.number().min(1).max(3).optional(),
  logoAppleZoom: z.number().min(0.5).max(3).optional(),
  logoGoogleZoom: z.number().min(0.5).max(3).optional(),
  useStampGrid: z.boolean().optional().default(false),
  stampFilledColor: z.string().max(20).nullable().optional(),
  headerFields: z.array(z.string().max(30)).max(3).nullable().optional(),
  secondaryFields: z.array(z.string().max(30)).max(4).nullable().optional(),
  fields: z.array(z.string().max(30)).max(6).nullable().optional(),
  fieldLabels: z.record(z.string().max(30), z.string().max(50)).nullable().optional(),
  locationMessage: z.string().max(200).optional().default(""),
  showPrimaryField: z.boolean().optional().default(true),
  stampGridConfig: z.object({
    stampIcon: z.string().max(50),
    customStampIconUrl: z.string().nullable().optional(),
    rewardIcon: z.string().max(10),
    customRewardIconUrl: z.string().nullable().optional(),
    customEmptyIconUrl: z.string().nullable().optional(),
    useUniformIcon: z.boolean().optional(),
    emptyNumberColor: z.string().max(20).nullable().optional(),
    emptyNumberScale: z.number().min(0.2).max(0.6).optional(),
    stampShape: z.enum(["circle", "rounded-square", "square"]),
    filledStyle: z.enum(["icon", "icon-with-border", "solid"]),
    stampIconScale: z.number().min(0.4).max(0.9).optional(),
    useStripBackground: z.boolean().optional(),
    emptySlotOpacity: z.number().min(0.1).max(1).optional(),
    emptySlotColor: z.string().max(20).nullable().optional(),
    emptySlotBg: z.string().max(20).nullable().optional(),
    rewardSlotColor: z.string().max(20).nullable().optional(),
    rewardSlotBg: z.string().max(20).nullable().optional(),
  }).optional(),
})

const PASS_TYPE_ENUM = ["STAMP_CARD", "COUPON"] as const

const createPassTemplateSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1, "Template name is required").max(100),
  passType: z.enum(PASS_TYPE_ENUM).optional().default("STAMP_CARD"),
  config: z.record(z.string(), z.unknown()).optional().default({}),
}).superRefine((data, ctx) => {
  if (data.config && Object.keys(data.config).length > 0) {
    const result = validateTemplateConfig(data.passType, data.config)
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid config for ${data.passType}: ${result.error}`,
        path: ["config"],
      })
    }
  }
})

// ─── Get Settings Data ──────────────────────────────────────

export async function getSettingsData() {
  const t = await getTranslations("serverErrors")
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { error: t("noOrganization") }
  }

  await assertOrganizationRole(organization.id, "owner")

  // Fetch all settings data in parallel
  const [rawTemplates, members, pendingInvitations, walletPassCount] = await Promise.all([
    db.passTemplate.findMany({
      where: { organizationId: organization.id },
      include: {
        passDesign: true,
        _count: {
          select: { passInstances: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.member.findMany({
      where: { organizationId: organization.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.staffInvitation.findMany({
      where: {
        organizationId: organization.id,
        accepted: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.passInstance.count({
      where: {
        passTemplate: { organizationId: organization.id },
        walletProvider: { not: "NONE" },
      },
    }),
  ])

  const templates: TemplateWithDesign[] = rawTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    passType: t.passType,
    config: t.config,
    termsAndConditions: t.termsAndConditions,
    status: t.status,
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    createdAt: t.createdAt,
    passInstanceCount: t._count.passInstances,
    passDesign: t.passDesign
      ? {
          cardType: t.passDesign.cardType as DesignCardType,
          showStrip: t.passDesign.showStrip,
          primaryColor: t.passDesign.primaryColor,
          secondaryColor: t.passDesign.secondaryColor,
          textColor: t.passDesign.textColor,
          stripImageUrl: t.passDesign.stripImageUrl,
          stripImageApple: t.passDesign.stripImageApple,
          stripImageGoogle: t.passDesign.stripImageGoogle,
          patternStyle: t.passDesign.patternStyle as PatternStyle,
          progressStyle: t.passDesign.progressStyle as ProgressStyle,
          labelFormat: t.passDesign.labelFormat as LabelFormat,
          customProgressLabel: t.passDesign.customProgressLabel,
          generatedStripApple: t.passDesign.generatedStripApple,
          generatedStripGoogle: t.passDesign.generatedStripGoogle,
          palettePreset: t.passDesign.palettePreset,
          templateId: t.passDesign.templateId,
          businessHours: t.passDesign.businessHours,
          mapAddress: t.passDesign.mapAddress,
          mapLatitude: t.passDesign.mapLatitude,
          mapLongitude: t.passDesign.mapLongitude,
          socialLinks: t.passDesign.socialLinks as SocialLinks,
          customMessage: t.passDesign.customMessage,
          designHash: t.passDesign.designHash,
        }
      : null,
  }))

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      brandColor: organization.brandColor,
      secondaryColor: organization.secondaryColor,
      address: organization.address,
      phone: organization.phone,
      website: organization.website,
      timezone: organization.timezone,
      plan: organization.plan,
      subscriptionStatus: organization.subscriptionStatus,
      settings: (organization.settings as Record<string, unknown>) ?? {},
    },
    templates,
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
      user: m.user,
    })),
    pendingInvitations: pendingInvitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
    })),
    walletPassCount,
  }
}

// ─── Update Organization Profile ──────────────────────────────

export async function updateOrganizationProfile(input: z.infer<typeof updateProfileSchema>) {
  const parsed = updateProfileSchema.parse(input)
  await assertOrganizationRole(parsed.organizationId, "owner")

  await db.organization.update({
    where: { id: parsed.organizationId },
    data: {
      name: sanitizeText(parsed.name, 100),
      address: parsed.address ? sanitizeText(parsed.address, 200) || null : null,
      phone: parsed.phone ? sanitizeText(parsed.phone, 30) || null : null,
      website: parsed.website || null,
      timezone: parsed.timezone,
    },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Create Pass Template ─────────────────────────────────

export async function createPassTemplate(input: z.infer<typeof createPassTemplateSchema>) {
  const t = await getTranslations("serverErrors")
  const parsed = createPassTemplateSchema.parse(input)
  await assertOrganizationRole(parsed.organizationId, "owner")

  // Plan template limit applies to ACTIVE programs only (enforced in activateTemplate /
  // reactivateTemplate). Drafts and archives are unrestricted.

  // Enforce allowed pass types for current plan
  const typeAllowed = await checkPassTypeAllowed(parsed.organizationId, parsed.passType)
  if (!typeAllowed) {
    return { error: t("passTypeNotAllowed") }
  }

  const defaultCardType = parsed.passType === "COUPON" ? "COUPON" : "STAMP"

  // For stamp cards, seed a random preset strip image + enable the stamp grid
  // so the user lands on a finished-looking card instead of a blank one.
  let stripUrls: { stripImageUrl: string; stripImageApple: string; stripImageGoogle: string } | null = null
  let editorConfig: Record<string, unknown> = {}
  if (parsed.passType === "STAMP_CARD") {
    editorConfig = { useStampGrid: true }
    stripUrls = await pickRandomStripPreset()
  }

  const template = await db.passTemplate.create({
    data: {
      organizationId: parsed.organizationId,
      name: sanitizeText(parsed.name, 100),
      passType: parsed.passType,
      config: JSON.parse(JSON.stringify(parsed.config ?? {})),
      status: "DRAFT",
      passDesign: {
        create: {
          cardType: defaultCardType,
          showStrip: true,
          patternStyle: "NONE",
          progressStyle: "NUMBERS",
          labelFormat: "UPPERCASE",
          designHash: "",
          editorConfig: editorConfig as Prisma.InputJsonValue,
          ...(stripUrls ?? {}),
        },
      },
    },
    include: { passDesign: true },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/programs")
  return { success: true, templateId: template.id }
}

// Strip image presets shipped in /public/strip-images/. Kept in sync with
// the studio's StripPanel preset list.
const STRIP_PRESETS: { id: string; ext: string; mime: string }[] = [
  { id: "burger", ext: "webp", mime: "image/webp" },
  { id: "caffe-beans", ext: "webp", mime: "image/webp" },
  { id: "pizza", ext: "webp", mime: "image/webp" },
  { id: "club", ext: "webp", mime: "image/webp" },
  { id: "gym", ext: "jpg", mime: "image/jpeg" },
]

async function pickRandomStripPreset(): Promise<
  { stripImageUrl: string; stripImageApple: string; stripImageGoogle: string } | null
> {
  const preset = STRIP_PRESETS[Math.floor(Math.random() * STRIP_PRESETS.length)]
  try {
    const { readFile } = await import("node:fs/promises")
    const path = await import("node:path")
    const filePath = path.join(process.cwd(), "public", "strip-images", `${preset.id}.${preset.ext}`)
    const originalBuffer = await readFile(filePath)

    const { uploadFile } = await import("@/lib/storage")
    const { processUploadedStripImage } = await import("@/lib/wallet/strip-image")
    const { appleBuffer, googleBuffer } = await processUploadedStripImage(originalBuffer)

    const ts = Date.now()
    const [originalUrl, appleUrl, googleUrl] = await Promise.all([
      uploadFile(originalBuffer, `strip-images/preset-${preset.id}-${ts}.${preset.ext}`, preset.mime),
      uploadFile(appleBuffer, `strip-images/preset-${preset.id}-apple-${ts}.png`, "image/png"),
      uploadFile(googleBuffer, `strip-images/preset-${preset.id}-google-${ts}.png`, "image/png"),
    ])
    return { stripImageUrl: originalUrl, stripImageApple: appleUrl, stripImageGoogle: googleUrl }
  } catch {
    // R2 / sharp / fs failure — fall back to a blank strip rather than blocking
    // template creation.
    return null
  }
}

// ─── Archive Pass Template ────────────────────────────────

export async function archivePassTemplate(organizationId: string, templateId: string) {
  const t = await getTranslations("serverErrors")
  await assertOrganizationRole(organizationId, "owner")

  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true, status: true },
  })

  if (!template || template.organizationId !== organizationId) {
    return { error: t("templateNotFound") }
  }

  if (template.status === "ARCHIVED") {
    return { error: t("templateAlreadyArchived") }
  }

  await db.$transaction(async (tx) => {
    await tx.passTemplate.update({
      where: { id: templateId },
      data: { status: "ARCHIVED" },
    })

    // Revoke all ACTIVE pass instances for this template
    await tx.passInstance.updateMany({
      where: {
        passTemplateId: templateId,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
      },
    })
  })

  // Trigger wallet updates for affected pass instances
  if (process.env.TRIGGER_SECRET_KEY) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-all-passes", {
          organizationId,
          templateId,
          reason: "TEMPLATE_ARCHIVED",
        })
      )
      .catch((err: unknown) =>
        console.error("Failed to trigger bulk pass update:", err instanceof Error ? err.message : "Unknown error")
      )
  } else {
    import("@/lib/wallet/google/update-pass")
      .then(async ({ notifyGooglePassUpdate }) => {
        const instances = await db.passInstance.findMany({
          where: { passTemplateId: templateId, walletProvider: "GOOGLE" },
          select: { id: true },
        })
        await Promise.allSettled(instances.map((pi) => notifyGooglePassUpdate(pi.id)))
      })
      .catch((err: unknown) =>
        console.error("Direct Google pass update failed:", err instanceof Error ? err.message : "Unknown error")
      )
    import("@/lib/wallet/apple/update-pass")
      .then(async ({ notifyApplePassUpdate }) => {
        const instances = await db.passInstance.findMany({
          where: { passTemplateId: templateId, walletProvider: "APPLE" },
          select: { id: true },
        })
        await Promise.allSettled(instances.map((pi) => notifyApplePassUpdate(pi.id)))
      })
      .catch((err: unknown) =>
        console.error("Direct Apple pass update failed:", err instanceof Error ? err.message : "Unknown error")
      )
  }

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/programs")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function activateTemplate(organizationId: string, templateId: string) {
  const t = await getTranslations("serverErrors")
  await assertOrganizationRole(organizationId, "owner")

  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true, status: true },
  })

  if (!template || template.organizationId !== organizationId) {
    return { error: t("templateNotFound") }
  }

  if (template.status === "ACTIVE") {
    return { error: t("templateAlreadyActive") }
  }

  if (template.status === "ARCHIVED") {
    return { error: t("cannotActivateArchived") }
  }

  await db.passTemplate.update({
    where: { id: templateId },
    data: { status: "ACTIVE" },
  })

  revalidatePath("/dashboard/programs")
  revalidatePath(`/dashboard/programs/${templateId}`)
  return { success: true }
}

// ─── Reactivate Template ────────────────────────────────────

export async function reactivateTemplate(organizationId: string, templateId: string) {
  const t = await getTranslations("serverErrors")
  await assertOrganizationRole(organizationId, "owner")

  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true, status: true },
  })

  if (!template || template.organizationId !== organizationId) {
    return { error: t("templateNotFound") }
  }

  if (template.status !== "ARCHIVED") {
    return { error: t("onlyArchivedReactivate") }
  }

  const templateCheck = await checkTemplateLimit(organizationId)
  if (!templateCheck.allowed) {
    return { error: t("templateLimitReached", { limit: templateCheck.limit }) }
  }

  await db.$transaction(async (tx) => {
    await tx.passTemplate.update({
      where: { id: templateId },
      data: { status: "ACTIVE" },
    })

    // Reactivate all REVOKED pass instances
    await tx.passInstance.updateMany({
      where: {
        passTemplateId: templateId,
        status: "REVOKED",
      },
      data: {
        status: "ACTIVE",
      },
    })
  })

  // Trigger wallet updates
  if (process.env.TRIGGER_SECRET_KEY) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-all-passes", {
          organizationId,
          templateId,
          reason: "TEMPLATE_REACTIVATED",
        })
      )
      .catch((err: unknown) =>
        console.error("Failed to trigger bulk pass update:", err instanceof Error ? err.message : "Unknown error")
      )
  } else {
    import("@/lib/wallet/google/update-pass")
      .then(async ({ notifyGooglePassUpdate }) => {
        const instances = await db.passInstance.findMany({
          where: { passTemplateId: templateId, walletProvider: "GOOGLE", status: "ACTIVE" },
          select: { id: true },
        })
        await Promise.allSettled(instances.map((pi) => notifyGooglePassUpdate(pi.id)))
      })
      .catch((err: unknown) =>
        console.error("Direct Google pass update failed:", err instanceof Error ? err.message : "Unknown error")
      )
    import("@/lib/wallet/apple/update-pass")
      .then(async ({ notifyApplePassUpdate }) => {
        const instances = await db.passInstance.findMany({
          where: { passTemplateId: templateId, walletProvider: "APPLE", status: "ACTIVE" },
          select: { id: true },
        })
        await Promise.allSettled(instances.map((pi) => notifyApplePassUpdate(pi.id)))
      })
      .catch((err: unknown) =>
        console.error("Direct Apple pass update failed:", err instanceof Error ? err.message : "Unknown error")
      )
  }

  revalidatePath("/dashboard/programs")
  revalidatePath(`/dashboard/programs/${templateId}`)
  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Delete Template ────────────────────────────────────────

export type TemplateDeleteCounts = {
  passInstances: number
  interactions: number
  rewards: number
}

export async function deleteTemplate(
  organizationId: string,
  templateId: string,
  confirmName: string
): Promise<{ error: string; counts?: TemplateDeleteCounts } | { success: true }> {
  const t = await getTranslations("serverErrors")
  await assertOrganizationRole(organizationId, "owner")

  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: {
      organizationId: true,
      name: true,
      _count: {
        select: {
          passInstances: true,
          interactions: true,
          rewards: true,
        },
      },
    },
  })

  if (!template || template.organizationId !== organizationId) {
    return { error: t("templateNotFound") }
  }

  if (confirmName !== template.name) {
    return {
      error: t("templateNameMismatch"),
      counts: {
        passInstances: template._count.passInstances,
        interactions: template._count.interactions,
        rewards: template._count.rewards,
      },
    }
  }

  // Hard delete — Prisma cascade handles pass instances, interactions, rewards, passDesign
  await db.passTemplate.delete({ where: { id: templateId } })

  revalidatePath("/dashboard/programs")
  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Save Pass Design ──────────────────────────────────────

export async function savePassDesign(input: z.infer<typeof savePassDesignSchema>) {
  const t = await getTranslations("serverErrors")
  let parsed: z.infer<typeof savePassDesignSchema>
  try {
    parsed = savePassDesignSchema.parse(input)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: t("validationFailed", { issues: err.issues.map((e: { message: string }) => e.message).join(", ") }) }
    }
    return { error: t("invalidDesignData") }
  }

  // Look up the template to get the organizationId for auth check
  const template = await db.passTemplate.findUnique({
    where: { id: parsed.templateId },
    select: { organizationId: true, id: true },
  })

  if (!template) {
    return { error: t("templateNotFound") }
  }

  await assertOrganizationRole(template.organizationId, "owner")

  const primaryColor = parsed.primaryColor || null
  const secondaryColor = parsed.secondaryColor || null
  const textColor = parsed.autoTextColor && primaryColor
    ? computeTextColor(primaryColor)
    : (parsed.textColor || null)

  let generatedStripApple: string | null = null
  let generatedStripGoogle: string | null = null

  const designTemplateId = parsed.templateId2 ?? null

  // Build editorConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorConfig: Record<string, any> = {}
  if (parsed.useStampGrid) editorConfig.useStampGrid = true
  if (parsed.stampGridConfig) editorConfig.stampGridConfig = parsed.stampGridConfig
  if (parsed.stripOpacity !== undefined && parsed.stripOpacity !== 1) editorConfig.stripOpacity = parsed.stripOpacity
  if (parsed.stripGrayscale) editorConfig.stripGrayscale = true
  if (parsed.stripColor1) editorConfig.stripColor1 = parsed.stripColor1
  if (parsed.stripColor2) editorConfig.stripColor2 = parsed.stripColor2
  if (parsed.stripFill && parsed.stripFill !== "gradient") editorConfig.stripFill = parsed.stripFill
  if (parsed.patternColor) editorConfig.patternColor = parsed.patternColor
  if (parsed.stripImagePosition && (parsed.stripImagePosition.x !== 0.5 || parsed.stripImagePosition.y !== 0.5)) {
    editorConfig.stripImagePosition = parsed.stripImagePosition
  }
  if (parsed.stripImageZoom && parsed.stripImageZoom !== 1) editorConfig.stripImageZoom = parsed.stripImageZoom
  if (parsed.logoAppleZoom && parsed.logoAppleZoom !== 1) editorConfig.logoAppleZoom = parsed.logoAppleZoom
  if (parsed.logoGoogleZoom && parsed.logoGoogleZoom !== 1) editorConfig.logoGoogleZoom = parsed.logoGoogleZoom
  if (parsed.labelColor) editorConfig.labelColor = parsed.labelColor
  if (parsed.stampFilledColor) editorConfig.stampFilledColor = parsed.stampFilledColor
  if (parsed.headerFields != null) editorConfig.headerFields = parsed.headerFields
  if (parsed.secondaryFields != null) editorConfig.secondaryFields = parsed.secondaryFields
  if (parsed.fields != null) editorConfig.fields = parsed.fields
  if (parsed.fieldLabels != null) editorConfig.fieldLabels = parsed.fieldLabels
  if (parsed.locationMessage) editorConfig.locationMessage = parsed.locationMessage
  if (parsed.showPrimaryField === false) editorConfig.showPrimaryField = false

  const stripPrimary = parsed.stripColor1 || primaryColor
  const stripSecondary = parsed.patternColor || parsed.stripColor2 || secondaryColor

  if (parsed.patternStyle !== "NONE" && stripPrimary) {
    try {
      const { generateStripImage, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } =
        await import("@/lib/wallet/strip-image")
      const { uploadFile } = await import("@/lib/storage")

      const secondary = stripSecondary ?? "#ffffff"

      const [appleBuffer, googleBuffer] = await Promise.all([
        generateStripImage({
          primaryColor: stripPrimary,
          secondaryColor: secondary,
          patternStyle: parsed.patternStyle as PatternStyle,
          width: APPLE_STRIP_WIDTH,
          height: APPLE_STRIP_HEIGHT,
        }),
        generateStripImage({
          primaryColor: stripPrimary,
          secondaryColor: secondary,
          patternStyle: parsed.patternStyle as PatternStyle,
          width: GOOGLE_HERO_WIDTH,
          height: GOOGLE_HERO_HEIGHT,
        }),
      ])

      const [appleUrl, googleUrl] = await Promise.all([
        uploadFile(appleBuffer, `strip-images/${parsed.templateId}/generated-apple-${Date.now()}.png`, "image/png"),
        uploadFile(googleBuffer, `strip-images/${parsed.templateId}/generated-google-${Date.now()}.png`, "image/png"),
      ])

      generatedStripApple = appleUrl
      generatedStripGoogle = googleUrl
    } catch {
      // Blob token not configured — skip strip image upload
    }
  }

  const socialLinks = {
    instagram: parsed.socialLinks?.instagram || undefined,
    facebook: parsed.socialLinks?.facebook || undefined,
    tiktok: parsed.socialLinks?.tiktok || undefined,
    x: parsed.socialLinks?.x || undefined,
  }

  const existingDesign = await db.passDesign.findUnique({
    where: { passTemplateId: parsed.templateId },
    select: {
      designHash: true,
      generatedStripApple: true,
      generatedStripGoogle: true,
      stripImageApple: true,
      stripImageGoogle: true,
      stripImageUrl: true,
      editorConfig: true,
      mapAddress: true,
    },
  })

  // Re-crop strip image when position/zoom changed
  let reCroppedApple: string | null = null
  let reCroppedGoogle: string | null = null
  const newPos = parsed.stripImagePosition ?? { x: 0.5, y: 0.5 }
  const newZoom = parsed.stripImageZoom ?? 1
  if (existingDesign?.stripImageUrl && !existingDesign.stripImageUrl.startsWith("data:")) {
    const oldFilters = existingDesign.editorConfig ? (existingDesign.editorConfig as Record<string, unknown>) : {}
    const oldPos = (oldFilters.stripImagePosition as { x: number; y: number } | undefined) ?? { x: 0.5, y: 0.5 }
    const oldZoom = (oldFilters.stripImageZoom as number | undefined) ?? 1
    const posChanged = Math.abs(newPos.x - oldPos.x) > 0.001 || Math.abs(newPos.y - oldPos.y) > 0.001
    const zoomChanged = Math.abs(newZoom - oldZoom) > 0.001

    if (posChanged || zoomChanged) {
      try {
        const { cropStripImageWithPosition, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } =
          await import("@/lib/wallet/strip-image")
        const { uploadFile, deleteFiles } = await import("@/lib/storage")

        const imgRes = await fetch(existingDesign.stripImageUrl)
        if (imgRes.ok) {
          const originalBuffer = Buffer.from(await imgRes.arrayBuffer())
          const [appleBuffer, googleBuffer] = await Promise.all([
            cropStripImageWithPosition(originalBuffer, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, newPos, newZoom),
            cropStripImageWithPosition(originalBuffer, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT, newPos, newZoom),
          ])
          const [appleUrl, googleUrl] = await Promise.all([
            uploadFile(appleBuffer, `strip-images/${parsed.templateId}/apple-${Date.now()}.png`, "image/png"),
            uploadFile(googleBuffer, `strip-images/${parsed.templateId}/google-${Date.now()}.png`, "image/png"),
          ])
          reCroppedApple = appleUrl
          reCroppedGoogle = googleUrl
          await deleteFiles([existingDesign.stripImageApple, existingDesign.stripImageGoogle])
        }
      } catch {
        // Skip re-crop
      }
    }
  }

  // holderPhotoUrl is now per-instance (stored in PassInstance.data), not template-level

  const newHash = computeDesignHash({
    showStrip: parsed.showStrip,
    primaryColor,
    secondaryColor,
    textColor,
    stripImageApple: reCroppedApple ?? existingDesign?.stripImageApple ?? null,
    stripImageGoogle: reCroppedGoogle ?? existingDesign?.stripImageGoogle ?? null,
    patternStyle: parsed.patternStyle,
    progressStyle: parsed.progressStyle,
    labelFormat: parsed.labelFormat,
    customProgressLabel: parsed.customProgressLabel || null,
    generatedStripApple,
    generatedStripGoogle,
    businessHours: parsed.businessHours || null,
    mapAddress: parsed.mapAddress || null,
    socialLinks,
    customMessage: parsed.customMessage || null,
    editorConfig,
  })

  if (generatedStripApple && existingDesign?.generatedStripApple) {
    const { deleteFiles } = await import("@/lib/storage")
    await deleteFiles([existingDesign.generatedStripApple, existingDesign.generatedStripGoogle])
  }

  const isStampGrid = parsed.useStampGrid

  await db.passDesign.upsert({
    where: { passTemplateId: parsed.templateId },
    create: {
      passTemplateId: parsed.templateId,
      cardType: parsed.cardType,
      showStrip: parsed.showStrip,
      primaryColor,
      secondaryColor,
      textColor,
      patternStyle: parsed.patternStyle,
      progressStyle: parsed.progressStyle,
      labelFormat: parsed.labelFormat,
      customProgressLabel: parsed.customProgressLabel || null,
      generatedStripApple: isStampGrid ? null : generatedStripApple,
      generatedStripGoogle: isStampGrid ? null : generatedStripGoogle,
      palettePreset: parsed.palettePreset ?? null,
      templateId: designTemplateId,
      businessHours: parsed.businessHours || null,
      mapAddress: parsed.mapAddress || null,
      socialLinks,
      customMessage: parsed.customMessage || null,
      designHash: newHash,
      editorConfig,
    },
    update: {
      cardType: parsed.cardType,
      showStrip: parsed.showStrip,
      primaryColor,
      secondaryColor,
      textColor,
      patternStyle: parsed.patternStyle,
      progressStyle: parsed.progressStyle,
      labelFormat: parsed.labelFormat,
      customProgressLabel: parsed.customProgressLabel || null,
      ...(isStampGrid
        ? { generatedStripApple: null, generatedStripGoogle: null }
        : generatedStripApple ? { generatedStripApple, generatedStripGoogle } : {}),
      ...(reCroppedApple ? { stripImageApple: reCroppedApple, stripImageGoogle: reCroppedGoogle } : {}),
      palettePreset: parsed.palettePreset ?? null,
      templateId: designTemplateId,
      businessHours: parsed.businessHours || null,
      mapAddress: parsed.mapAddress || null,
      socialLinks,
      customMessage: parsed.customMessage || null,
      designHash: newHash,
      editorConfig,
    },
  })

  // Update coordinates: use client-provided coords (from autocomplete) or fall back to server geocoding
  const newMapAddress = parsed.mapAddress || null
  const oldMapAddress = existingDesign?.mapAddress ?? null
  const clientLat = parsed.mapLatitude ?? null
  const clientLng = parsed.mapLongitude ?? null

  if (clientLat != null && clientLng != null) {
    // Client provided coordinates from place autocomplete — use directly
    await db.passDesign.update({
      where: { passTemplateId: parsed.templateId },
      data: { mapLatitude: clientLat, mapLongitude: clientLng },
    })
  } else if (newMapAddress !== oldMapAddress) {
    if (newMapAddress) {
      // Fall back to server-side geocoding
      try {
        const { geocodeAddress } = await import("@/lib/geocoding")
        const coords = await geocodeAddress(newMapAddress)
        await db.passDesign.update({
          where: { passTemplateId: parsed.templateId },
          data: {
            mapLatitude: coords?.lat ?? null,
            mapLongitude: coords?.lng ?? null,
          },
        })
      } catch {
        // Geocoding failure never blocks save
      }
    } else {
      await db.passDesign.update({
        where: { passTemplateId: parsed.templateId },
        data: { mapLatitude: null, mapLongitude: null },
      })
    }
  }

  // Sync colors back to Organization for brand consistency
  if (primaryColor || secondaryColor) {
    await db.organization.update({
      where: { id: template.organizationId },
      data: {
        ...(primaryColor ? { brandColor: primaryColor } : {}),
        ...(secondaryColor ? { secondaryColor } : {}),
      },
    })
  }

  // If design hash changed, trigger bulk pass update
  const hashChanged = existingDesign?.designHash !== newHash
  if (hashChanged) {
    if (process.env.TRIGGER_SECRET_KEY) {
      import("@trigger.dev/sdk")
        .then(({ tasks }) =>
          tasks.trigger("update-all-passes", {
            organizationId: template.organizationId,
            templateId: parsed.templateId,
            reason: "DESIGN_CHANGE",
          })
        )
        .catch((err: unknown) =>
          console.error("Failed to trigger bulk pass update:", err instanceof Error ? err.message : "Unknown error")
        )
    } else {
      import("@/lib/wallet/google/update-pass")
        .then(async ({ notifyGooglePassUpdate }) => {
          const instances = await db.passInstance.findMany({
            where: { passTemplateId: parsed.templateId, walletProvider: "GOOGLE", status: "ACTIVE" },
            select: { id: true },
          })
          await Promise.allSettled(instances.map((pi) => notifyGooglePassUpdate(pi.id)))
        })
        .catch((err: unknown) =>
          console.error("Direct Google pass update failed:", err instanceof Error ? err.message : "Unknown error")
        )
      import("@/lib/wallet/apple/update-pass")
        .then(async ({ notifyApplePassUpdate }) => {
          const instances = await db.passInstance.findMany({
            where: { passTemplateId: parsed.templateId, walletProvider: "APPLE", status: "ACTIVE" },
            select: { id: true },
          })
          await Promise.allSettled(instances.map((pi) => notifyApplePassUpdate(pi.id)))
        })
        .catch((err: unknown) =>
          console.error("Direct Apple pass update failed:", err instanceof Error ? err.message : "Unknown error")
        )
    }
  }

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/programs")
  revalidatePath("/dashboard")
  const slug = (await db.organization.findUnique({ where: { id: template.organizationId }, select: { slug: true } }))?.slug
  if (slug) {
    revalidatePath(`/join/${slug}`)
  }
  return { success: true, hashChanged }
}

// ─── Upload Strip Image ──────────────────────────────────────

export async function uploadStripImage(formData: FormData) {
  const t = await getTranslations("serverErrors")
  const templateId = formData.get("templateId") as string
  const file = formData.get("file") as File

  if (!templateId || !file) {
    return { error: t("missingFields") }
  }

  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true },
  })

  if (!template) {
    return { error: t("templateNotFound") }
  }

  await assertOrganizationRole(template.organizationId, "owner")

  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) return { error: t("fileTooLarge5MB") }

  const validTypes = ["image/png", "image/jpeg", "image/webp"]
  if (!validTypes.includes(file.type)) return { error: t("invalidFileType") }

  const originalBuffer = Buffer.from(await file.arrayBuffer())

  const currentDesign = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { editorConfig: true },
  })
  const cfg = currentDesign?.editorConfig as Record<string, unknown> | null
  const position = cfg?.stripImagePosition as { x: number; y: number } | undefined
  const zoom = cfg?.stripImageZoom as number | undefined

  let originalUrl: string
  let appleUrl: string
  let googleUrl: string

  try {
    const { uploadFile, deleteFiles } = await import("@/lib/storage")
    const { processUploadedStripImage } = await import("@/lib/wallet/strip-image")

    const ext = file.name.split(".").pop() ?? "png"
    const uploadedOriginalUrl = await uploadFile(originalBuffer, `strip-images/${templateId}/original-${Date.now()}.${ext}`, file.type)
    const { appleBuffer, googleBuffer } = await processUploadedStripImage(originalBuffer, position, zoom)

    const [uploadedAppleUrl, uploadedGoogleUrl] = await Promise.all([
      uploadFile(appleBuffer, `strip-images/${templateId}/apple-${Date.now()}.png`, "image/png"),
      uploadFile(googleBuffer, `strip-images/${templateId}/google-${Date.now()}.png`, "image/png"),
    ])

    const existing = await db.passDesign.findUnique({
      where: { passTemplateId: templateId },
      select: { stripImageUrl: true, stripImageApple: true, stripImageGoogle: true },
    })
    if (existing) {
      await deleteFiles([existing.stripImageUrl, existing.stripImageApple, existing.stripImageGoogle])
    }

    originalUrl = uploadedOriginalUrl
    appleUrl = uploadedAppleUrl
    googleUrl = uploadedGoogleUrl
  } catch {
    const dataUri = `data:${file.type};base64,${originalBuffer.toString("base64")}`
    originalUrl = dataUri
    appleUrl = dataUri
    googleUrl = dataUri
  }

  await db.passDesign.upsert({
    where: { passTemplateId: templateId },
    create: { passTemplateId: templateId, stripImageUrl: originalUrl, stripImageApple: appleUrl, stripImageGoogle: googleUrl },
    update: { stripImageUrl: originalUrl, stripImageApple: appleUrl, stripImageGoogle: googleUrl },
  })

  revalidatePath(`/dashboard/programs/${templateId}`)
  return { success: true, originalUrl, appleUrl, googleUrl }
}

// ─── Delete Strip Image ─────────────────────────────────────

export async function deleteStripImage(templateId: string) {
  const t = await getTranslations("serverErrors")
  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true },
  })

  if (!template) return { error: t("templateNotFound") }

  await assertOrganizationRole(template.organizationId, "owner")

  const existing = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { stripImageUrl: true, stripImageApple: true, stripImageGoogle: true },
  })

  if (existing) {
    const toDelete = [existing.stripImageUrl, existing.stripImageApple, existing.stripImageGoogle].filter(Boolean) as string[]
    if (toDelete.length > 0) {
      const { deleteFiles } = await import("@/lib/storage")
      await deleteFiles(toDelete)
    }

    await db.passDesign.update({
      where: { passTemplateId: templateId },
      data: { stripImageUrl: null, stripImageApple: null, stripImageGoogle: null },
    })
  }

  revalidatePath("/dashboard/settings")
  return { success: true }
}

// ─── Generic Stamp Icon Upload/Delete ─────────────────────────

type StampIconSlot = "customStampIconUrl" | "customRewardIconUrl" | "customEmptyIconUrl"

async function uploadStampIconGeneric(formData: FormData, slot: StampIconSlot) {
  const t = await getTranslations("serverErrors")
  const templateId = formData.get("templateId") as string
  const file = formData.get("file") as File

  if (!templateId || !file) return { error: t("missingFields") }

  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true },
  })

  if (!template) return { error: t("templateNotFound") }

  await assertOrganizationRole(template.organizationId, "owner")

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) return { error: t("fileTooLarge2MB") }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) return { error: t("invalidFileTypeSvg") }

  const existing = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { editorConfig: true },
  })

  const rawBuffer = Buffer.from(await file.arrayBuffer())
  let processedBuffer: Buffer = rawBuffer
  let processedType = file.type
  if (file.type !== "image/svg+xml") {
    try {
      const { default: sharp } = await import("sharp")
      processedBuffer = await sharp(rawBuffer).trim().png().toBuffer()
      processedType = "image/png"
    } catch { /* use original */ }
  }

  const slotLabel = slot.replace("custom", "").replace("Url", "").toLowerCase()
  let iconUrl: string
  try {
    const { uploadFile, deleteFile } = await import("@/lib/storage")
    if (existing?.editorConfig && typeof existing.editorConfig === "object") {
      const cfg = existing.editorConfig as Record<string, unknown>
      const stampCfg = cfg.stampGridConfig as Record<string, unknown> | undefined
      const oldUrl = stampCfg?.[slot]
      if (typeof oldUrl === "string") await deleteFile(oldUrl)
    }
    const ext = processedType === "image/png" ? "png" : (file.name.split(".").pop() ?? "png")
    iconUrl = await uploadFile(processedBuffer, `stamp-icons/${templateId}/${slotLabel}-${Date.now()}.${ext}`, processedType)
  } catch {
    iconUrl = `data:${processedType};base64,${processedBuffer.toString("base64")}`
  }

  const editorCfg = (existing?.editorConfig && typeof existing.editorConfig === "object" ? existing.editorConfig : {}) as Record<string, unknown>
  const stampGridConfig = (editorCfg.stampGridConfig && typeof editorCfg.stampGridConfig === "object" ? editorCfg.stampGridConfig : {}) as Record<string, unknown>

  await db.passDesign.update({
    where: { passTemplateId: templateId },
    data: { editorConfig: { ...editorCfg, stampGridConfig: { ...stampGridConfig, [slot]: iconUrl } } as object },
  })

  revalidatePath("/dashboard/programs")
  return { success: true, url: iconUrl }
}

async function deleteStampIconGeneric(templateId: string, slot: StampIconSlot) {
  const t = await getTranslations("serverErrors")
  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true },
  })

  if (!template) return { error: t("templateNotFound") }

  await assertOrganizationRole(template.organizationId, "owner")

  const existing = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { editorConfig: true },
  })

  if (existing?.editorConfig && typeof existing.editorConfig === "object") {
    const editorCfg = existing.editorConfig as Record<string, unknown>
    const stampGridConfig = (editorCfg.stampGridConfig && typeof editorCfg.stampGridConfig === "object" ? editorCfg.stampGridConfig : {}) as Record<string, unknown>
    const oldUrl = stampGridConfig[slot]
    if (typeof oldUrl === "string") {
      const { deleteFile } = await import("@/lib/storage")
      await deleteFile(oldUrl)
    }
    await db.passDesign.update({
      where: { passTemplateId: templateId },
      data: { editorConfig: { ...editorCfg, stampGridConfig: { ...stampGridConfig, [slot]: null } } as object },
    })
  }

  revalidatePath("/dashboard/programs")
  return { success: true }
}

export async function uploadStampIcon(formData: FormData) {
  return uploadStampIconGeneric(formData, "customStampIconUrl")
}
export async function deleteStampIcon(templateId: string) {
  return deleteStampIconGeneric(templateId, "customStampIconUrl")
}
export async function uploadRewardIcon(formData: FormData) {
  return uploadStampIconGeneric(formData, "customRewardIconUrl")
}
export async function deleteRewardIcon(templateId: string) {
  return deleteStampIconGeneric(templateId, "customRewardIconUrl")
}
export async function uploadEmptyIcon(formData: FormData) {
  return uploadStampIconGeneric(formData, "customEmptyIconUrl")
}
export async function deleteEmptyIcon(templateId: string) {
  return deleteStampIconGeneric(templateId, "customEmptyIconUrl")
}

// ─── Holder Photo Upload (Membership) ───────────────────────

export async function uploadHolderPhoto(formData: FormData) {
  const t = await getTranslations("serverErrors")
  const templateId = formData.get("templateId") as string
  const file = formData.get("file") as File

  if (!templateId || !file) return { error: t("missingFields") }

  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true },
  })
  if (!template) return { error: t("templateNotFound") }
  await assertOrganizationRole(template.organizationId, "owner")

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) return { error: t("fileTooLarge2MB") }

  const validTypes = ["image/png", "image/jpeg", "image/webp"]
  if (!validTypes.includes(file.type)) return { error: t("invalidFileType") }

  const rawBuffer = Buffer.from(await file.arrayBuffer())
  let processedBuffer: Buffer = rawBuffer
  try {
    const { default: sharp } = await import("sharp")
    processedBuffer = await sharp(rawBuffer)
      .resize(256, 256, { fit: "cover" })
      .png()
      .toBuffer()
  } catch { /* use original */ }

  let url: string
  try {
    const { uploadFile, deleteFile } = await import("@/lib/storage")
    // Delete old photo if exists
    const existing = await db.passDesign.findUnique({
      where: { passTemplateId: templateId },
      select: { editorConfig: true },
    })
    if (existing?.editorConfig && typeof existing.editorConfig === "object") {
      const cfg = existing.editorConfig as Record<string, unknown>
      if (typeof cfg.holderPhotoUrl === "string") await deleteFile(cfg.holderPhotoUrl)
    }
    url = await uploadFile(processedBuffer, `holder-photos/${templateId}/${Date.now()}.png`, "image/png")
  } catch {
    url = `data:image/png;base64,${processedBuffer.toString("base64")}`
  }

  // Store in editorConfig
  const existing = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { editorConfig: true },
  })
  const editorCfg = (existing?.editorConfig && typeof existing.editorConfig === "object" ? existing.editorConfig : {}) as Record<string, unknown>
  await db.passDesign.update({
    where: { passTemplateId: templateId },
    data: { editorConfig: { ...editorCfg, holderPhotoUrl: url } as object },
  })

  revalidatePath("/dashboard/programs")
  return { success: true, url }
}

export async function deleteHolderPhoto(templateId: string) {
  const t = await getTranslations("serverErrors")
  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true },
  })
  if (!template) return { error: t("templateNotFound") }
  await assertOrganizationRole(template.organizationId, "owner")

  const existing = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { editorConfig: true },
  })

  if (existing?.editorConfig && typeof existing.editorConfig === "object") {
    const editorCfg = existing.editorConfig as Record<string, unknown>
    if (typeof editorCfg.holderPhotoUrl === "string") {
      const { deleteFile } = await import("@/lib/storage")
      await deleteFile(editorCfg.holderPhotoUrl)
    }
    await db.passDesign.update({
      where: { passTemplateId: templateId },
      data: { editorConfig: { ...editorCfg, holderPhotoUrl: null } as object },
    })
  }

  revalidatePath("/dashboard/programs")
  return { success: true }
}

// ─── Logo Processing Constants ──────────────────────────────

const APPLE_LOGO_WIDTH = 320
const APPLE_LOGO_HEIGHT = 100
const GOOGLE_LOGO_SIZE = 660

// ─── Logo Processing Helpers ────────────────────────────────

async function processLogoForApple(sourceBuffer: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp")
  return sharp(sourceBuffer)
    .resize(APPLE_LOGO_WIDTH, APPLE_LOGO_HEIGHT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function processLogoForGoogle(sourceBuffer: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp")
  const contentSize = Math.round(GOOGLE_LOGO_SIZE * 0.70)
  const resized = await sharp(sourceBuffer)
    .resize(contentSize, contentSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer()
  const margin = Math.round((GOOGLE_LOGO_SIZE - contentSize) / 2)
  return sharp({ create: { width: GOOGLE_LOGO_SIZE, height: GOOGLE_LOGO_SIZE, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .composite([{ input: resized, left: margin, top: margin }])
    .png()
    .toBuffer()
}

async function uploadBuffer(buffer: Buffer, path: string, contentType: string): Promise<string> {
  const { uploadFile } = await import("@/lib/storage")
  return uploadFile(buffer, path, contentType)
}

async function deleteBlob(url: string | null | undefined) {
  const { deleteFile } = await import("@/lib/storage")
  return deleteFile(url)
}

// ─── Upload Organization Logo ─────────────────────────────────

export async function uploadOrganizationLogo(formData: FormData) {
  const t = await getTranslations("serverErrors")
  const organizationId = formData.get("organizationId") as string
  const file = formData.get("file") as File

  if (!organizationId || !file) return { error: t("missingFields") }

  await assertOrganizationRole(organizationId, "owner")

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) return { error: t("fileTooLarge2MB") }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) return { error: t("invalidFileTypeSvg") }

  const old = await db.organization.findUnique({
    where: { id: organizationId },
    select: { logo: true, logoApple: true, logoGoogle: true },
  })
  await Promise.all([deleteBlob(old?.logo), deleteBlob(old?.logoApple), deleteBlob(old?.logoGoogle)])

  const sourceBuffer = Buffer.from(await file.arrayBuffer())
  const logoUrl = await uploadBuffer(sourceBuffer, `logos/${organizationId}/source/${file.name}`, file.type)

  let appleUrl: string
  let googleUrl: string

  if (file.type === "image/svg+xml") {
    appleUrl = logoUrl
    googleUrl = logoUrl
  } else {
    const [appleBuf, googleBuf] = await Promise.all([processLogoForApple(sourceBuffer), processLogoForGoogle(sourceBuffer)])
    const [aUrl, gUrl] = await Promise.all([
      uploadBuffer(appleBuf, `logos/${organizationId}/apple/logo.png`, "image/png"),
      uploadBuffer(googleBuf, `logos/${organizationId}/google/logo.png`, "image/png"),
    ])
    appleUrl = aUrl
    googleUrl = gUrl
  }

  await db.organization.update({
    where: { id: organizationId },
    data: { logo: logoUrl, logoApple: appleUrl, logoGoogle: googleUrl },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/programs")
  return { success: true, url: logoUrl, appleUrl, googleUrl }
}

// ─── Delete Organization Logo ─────────────────────────────────

export async function deleteOrganizationLogo(organizationId: string) {
  await assertOrganizationRole(organizationId, "owner")

  const old = await db.organization.findUnique({
    where: { id: organizationId },
    select: { logo: true, logoApple: true, logoGoogle: true },
  })

  await Promise.all([deleteBlob(old?.logo), deleteBlob(old?.logoApple), deleteBlob(old?.logoGoogle)])

  await db.organization.update({
    where: { id: organizationId },
    data: { logo: null, logoApple: null, logoGoogle: null },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/programs")
  return { success: true }
}

// ─── Upload Program Logo ──────────────────────────────────────

export async function uploadProgramLogo(formData: FormData) {
  const t = await getTranslations("serverErrors")
  const organizationId = formData.get("organizationId") as string
  const templateId = formData.get("templateId") as string
  const file = formData.get("file") as File

  if (!organizationId || !templateId || !file) return { error: t("missingFields") }

  await assertOrganizationRole(organizationId, "owner")

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) return { error: t("fileTooLarge2MB") }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) return { error: t("invalidFileTypeSvg") }

  // Delete old program logos
  const old = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { logoUrl: true, logoAppleUrl: true, logoGoogleUrl: true },
  })
  await Promise.all([deleteBlob(old?.logoUrl), deleteBlob(old?.logoAppleUrl), deleteBlob(old?.logoGoogleUrl)])

  const sourceBuffer = Buffer.from(await file.arrayBuffer())
  const logoUrl = await uploadBuffer(sourceBuffer, `logos/${organizationId}/${templateId}/source/${file.name}`, file.type)

  let appleUrl: string
  let googleUrl: string

  if (file.type === "image/svg+xml") {
    appleUrl = logoUrl
    googleUrl = logoUrl
  } else {
    const [appleBuf, googleBuf] = await Promise.all([processLogoForApple(sourceBuffer), processLogoForGoogle(sourceBuffer)])
    const [aUrl, gUrl] = await Promise.all([
      uploadBuffer(appleBuf, `logos/${organizationId}/${templateId}/apple/logo.png`, "image/png"),
      uploadBuffer(googleBuf, `logos/${organizationId}/${templateId}/google/logo.png`, "image/png"),
    ])
    appleUrl = aUrl
    googleUrl = gUrl
  }

  await db.passDesign.upsert({
    where: { passTemplateId: templateId },
    create: { passTemplateId: templateId, logoUrl, logoAppleUrl: appleUrl, logoGoogleUrl: googleUrl },
    update: { logoUrl, logoAppleUrl: appleUrl, logoGoogleUrl: googleUrl },
  })

  revalidatePath(`/dashboard/programs/${templateId}`)
  return { success: true, url: logoUrl, appleUrl, googleUrl }
}

// ─── Delete Program Logo ──────────────────────────────────────

export async function deleteProgramLogo(organizationId: string, templateId: string) {
  await assertOrganizationRole(organizationId, "owner")

  const old = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { logoUrl: true, logoAppleUrl: true, logoGoogleUrl: true },
  })

  await Promise.all([deleteBlob(old?.logoUrl), deleteBlob(old?.logoAppleUrl), deleteBlob(old?.logoGoogleUrl)])

  await db.passDesign.update({
    where: { passTemplateId: templateId },
    data: { logoUrl: null, logoAppleUrl: null, logoGoogleUrl: null },
  })

  revalidatePath(`/dashboard/programs/${templateId}`)
  return { success: true }
}

// ─── Upload Program Platform Logo ─────────────────────────────

export async function uploadProgramPlatformLogo(formData: FormData) {
  const t = await getTranslations("serverErrors")
  const organizationId = formData.get("organizationId") as string
  const templateId = formData.get("templateId") as string
  const platform = formData.get("platform") as "apple" | "google" | null
  const file = formData.get("file") as File

  if (!organizationId || !templateId || !file || !platform) return { error: t("missingFields") }
  await assertOrganizationRole(organizationId, "owner")

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) return { error: t("fileTooLarge2MB") }

  const sourceBuffer = Buffer.from(await file.arrayBuffer())
  const field = platform === "apple" ? "logoAppleUrl" : "logoGoogleUrl"

  const url = await uploadBuffer(
    sourceBuffer,
    `logos/${organizationId}/${templateId}/${platform}/logo-override.png`,
    file.type
  )

  await db.passDesign.update({ where: { passTemplateId: templateId }, data: { [field]: url } })
  revalidatePath(`/dashboard/programs/${templateId}`)
  return { success: true, url }
}

// ─── Reset Program Platform Logo ──────────────────────────────

export async function resetProgramPlatformLogo(organizationId: string, templateId: string, platform: "apple" | "google") {
  await assertOrganizationRole(organizationId, "owner")

  const design = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { logoUrl: true },
  })

  // Re-derive platform logo from source
  const sourceUrl = design?.logoUrl ?? null
  const field = platform === "apple" ? "logoAppleUrl" : "logoGoogleUrl"
  await db.passDesign.update({ where: { passTemplateId: templateId }, data: { [field]: sourceUrl } })

  revalidatePath(`/dashboard/programs/${templateId}`)
  return { success: true, url: sourceUrl }
}

// ─── Use Organization Logo for Program ────────────────────────

export async function useOrgLogoForProgram(organizationId: string, templateId: string) {
  await assertOrganizationRole(organizationId, "owner")

  // Clear program-level logos so it falls back to org
  const old = await db.passDesign.findUnique({
    where: { passTemplateId: templateId },
    select: { logoUrl: true, logoAppleUrl: true, logoGoogleUrl: true },
  })
  await Promise.all([deleteBlob(old?.logoUrl), deleteBlob(old?.logoAppleUrl), deleteBlob(old?.logoGoogleUrl)])

  await db.passDesign.update({
    where: { passTemplateId: templateId },
    data: { logoUrl: null, logoAppleUrl: null, logoGoogleUrl: null },
  })

  revalidatePath(`/dashboard/programs/${templateId}`)
  return { success: true }
}

// ─── Update Minigame Config ───────────────────────────────────

const updateMinigameConfigSchema = z.object({
  organizationId: z.string(),
  templateId: z.string(),
  enabled: z.boolean(),
  gameType: z.enum(["scratch", "slots", "wheel"]).optional(),
  prizes: z.array(z.object({ name: z.string(), weight: z.number() })).optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
})

export async function updateMinigameConfig(input: z.infer<typeof updateMinigameConfigSchema>) {
  const t = await getTranslations("serverErrors")
  const parsed = updateMinigameConfigSchema.parse(input)
  await assertOrganizationRole(parsed.organizationId, "owner")

  const template = await db.passTemplate.findUnique({
    where: { id: parsed.templateId },
    select: { organizationId: true, config: true },
  })

  if (!template || template.organizationId !== parsed.organizationId) {
    return { error: t("templateNotFound") }
  }

  const existingConfig = (template.config as Record<string, unknown>) ?? {}
  const minigame: Record<string, unknown> = {
    enabled: parsed.enabled,
    ...(parsed.gameType ? { gameType: parsed.gameType } : {}),
    ...(parsed.prizes ? { prizes: parsed.prizes } : {}),
    ...(parsed.primaryColor ? { primaryColor: parsed.primaryColor } : {}),
    ...(parsed.accentColor ? { accentColor: parsed.accentColor } : {}),
  }

  await db.passTemplate.update({
    where: { id: parsed.templateId },
    data: { config: JSON.parse(JSON.stringify({ ...existingConfig, minigame })) },
  })

  revalidatePath(`/dashboard/programs/${parsed.templateId}`)

  return { success: true }
}

// ─── Update Pass Template Settings ───────────────────────────

export async function updatePassTemplate(input: z.infer<typeof updatePassTemplateSchema>) {
  const t = await getTranslations("serverErrors")
  const parsed = updatePassTemplateSchema.parse(input)
  await assertOrganizationRole(parsed.organizationId, "owner")

  const template = await db.passTemplate.findUnique({
    where: { id: parsed.templateId },
    select: { organizationId: true, config: true, passType: true },
  })

  if (!template || template.organizationId !== parsed.organizationId) {
    return { error: t("templateNotFound") }
  }

  // Validate config against the template's pass type
  if (parsed.config && Object.keys(parsed.config).length > 0) {
    const configResult = validateTemplateConfig(template.passType, parsed.config)
    if (!configResult.success) {
      return { error: `Invalid config: ${configResult.error}` }
    }
  }

  const updateData: Record<string, unknown> = {
    name: sanitizeText(parsed.name, 100),
  }
  if (parsed.termsAndConditions !== undefined) updateData.termsAndConditions = parsed.termsAndConditions
  if (parsed.status) updateData.status = parsed.status
  if (parsed.startsAt) updateData.startsAt = parsed.startsAt
  if (parsed.endsAt !== undefined) updateData.endsAt = parsed.endsAt
  if (parsed.config) updateData.config = JSON.parse(JSON.stringify(parsed.config))

  await db.passTemplate.update({
    where: { id: parsed.templateId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: updateData as any,
  })

  revalidatePath("/dashboard/programs")
  revalidatePath(`/dashboard/programs/${parsed.templateId}`)

  return { success: true }
}

// ─── Extract Palette from Logo URL ───────────────────────────

export async function extractPaletteFromLogoUrl(organizationId: string, logoUrl?: string) {
  const t = await getTranslations("serverErrors")
  await assertOrganizationRole(organizationId, "owner")

  // Use provided logoUrl (program logo) or fall back to organization logo
  let sourceUrl = logoUrl
  if (!sourceUrl) {
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { logo: true },
    })
    sourceUrl = organization?.logo ?? undefined
  }

  if (!sourceUrl) return { error: t("noLogoUploaded") }

  try {
    const { extractPaletteFromBuffer } = await import("@/lib/color-extraction")
    let sourceBuffer: Buffer
    if (sourceUrl.startsWith("data:")) {
      const base64 = sourceUrl.split(",")[1]
      sourceBuffer = Buffer.from(base64, "base64")
    } else {
      const res = await fetch(sourceUrl)
      if (!res.ok) return { error: t("failedFetchLogo") }
      sourceBuffer = Buffer.from(await res.arrayBuffer())
    }

    const palette = await extractPaletteFromBuffer(sourceBuffer)
    return { success: true, palette }
  } catch {
    return { error: t("failedExtractColors") }
  }
}

// ─── Platform-Specific Logo Upload ───────────────────────────

export async function uploadPlatformLogo(formData: FormData) {
  const t = await getTranslations("serverErrors")
  const organizationId = formData.get("organizationId") as string
  const platform = formData.get("platform") as "apple" | "google" | null
  const file = formData.get("file") as File

  if (!organizationId || !file || !platform) return { error: t("missingFields") }
  await assertOrganizationRole(organizationId, "owner")

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) return { error: t("fileTooLarge2MB") }

  const sourceBuffer = Buffer.from(await file.arrayBuffer())
  const field = platform === "apple" ? "logoApple" : "logoGoogle"

  const url = await uploadBuffer(
    sourceBuffer,
    `logos/${organizationId}/${platform}/logo-override.png`,
    file.type
  )

  await db.organization.update({ where: { id: organizationId }, data: { [field]: url } })
  revalidatePath("/dashboard/settings")
  return { success: true, url }
}

export async function resetPlatformLogo(organizationId: string, platform: "apple" | "google") {
  await assertOrganizationRole(organizationId, "owner")

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { logo: true },
  })

  // Re-derive platform logo from source
  const sourceUrl = org?.logo ?? null
  const field = platform === "apple" ? "logoApple" : "logoGoogle"
  await db.organization.update({ where: { id: organizationId }, data: { [field]: sourceUrl } })

  revalidatePath("/dashboard/settings")
  return { success: true, url: sourceUrl }
}

export async function deletePlatformLogo(organizationId: string, platform: "apple" | "google") {
  await assertOrganizationRole(organizationId, "owner")

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { logoApple: true, logoGoogle: true },
  })

  const url = platform === "apple" ? org?.logoApple : org?.logoGoogle
  if (url) await deleteBlob(url)

  const field = platform === "apple" ? "logoApple" : "logoGoogle"
  await db.organization.update({ where: { id: organizationId }, data: { [field]: null } })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/programs")
  return { success: true }
}

// ─── Team Management ─────────────────────────────────────────

export async function inviteTeamMember(input: {
  organizationId: string
  email: string
  role: "owner" | "staff"
}) {
  const { sendStaffInvitation } = await import("@/server/auth-actions")
  return sendStaffInvitation(input)
}

export async function removeTeamMember(organizationId: string, memberId: string) {
  const t = await getTranslations("serverErrors")
  const { session } = await assertOrganizationRole(organizationId, "owner")

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { organizationId: true, userId: true, role: true },
  })

  if (!member || member.organizationId !== organizationId) {
    return { error: t("memberNotFound") }
  }

  // Prevent self-removal
  if (member.userId === session.user.id) {
    return { error: t("cannotRemoveSelf") }
  }

  // Prevent removing the last owner
  if (member.role === "owner") {
    const ownerCount = await db.member.count({
      where: { organizationId, role: "owner" },
    })
    if (ownerCount <= 1) {
      return { error: t("cannotRemoveLastOwner") }
    }
  }

  await db.member.delete({ where: { id: memberId } })

  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function changeTeamMemberRole(
  organizationId: string,
  memberId: string,
  newRole: "owner" | "member"
) {
  const t = await getTranslations("serverErrors")
  const { session } = await assertOrganizationRole(organizationId, "owner")

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { organizationId: true, userId: true, role: true },
  })

  if (!member || member.organizationId !== organizationId) {
    return { error: t("memberNotFound") }
  }

  if (member.role === newRole) {
    return { error: t("memberAlreadyRole") }
  }

  // Prevent demoting yourself
  if (member.userId === session.user.id) {
    return { error: t("cannotChangeOwnRole") }
  }

  // Prevent demoting the last owner
  if (member.role === "owner" && newRole === "member") {
    const ownerCount = await db.member.count({
      where: { organizationId, role: "owner" },
    })
    if (ownerCount <= 1) {
      return { error: t("cannotDemoteLastOwner") }
    }
  }

  await db.member.update({
    where: { id: memberId },
    data: { role: newRole },
  })

  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function cancelInvitation(organizationId: string, invitationId: string) {
  const t = await getTranslations("serverErrors")
  await assertOrganizationRole(organizationId, "owner")

  const invitation = await db.staffInvitation.findUnique({
    where: { id: invitationId },
    select: { organizationId: true },
  })

  if (!invitation || invitation.organizationId !== organizationId) {
    return { error: t("invitationNotFound") }
  }

  await db.staffInvitation.delete({ where: { id: invitationId } })

  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function resendInvitation(organizationId: string, invitationId: string) {
  const t = await getTranslations("serverErrors")
  await assertOrganizationRole(organizationId, "owner")

  const invitation = await db.staffInvitation.findUnique({
    where: { id: invitationId },
    select: {
      organizationId: true,
      email: true,
      role: true,
      token: true,
      organization: { select: { name: true } },
    },
  })

  if (!invitation || invitation.organizationId !== organizationId) {
    return { error: t("invitationNotFound") }
  }

  // Extend expiry by 7 days
  await db.staffInvitation.update({
    where: { id: invitationId },
    data: { expiresAt: addDays(new Date(), 7) },
  })

  // Re-send the email
  const { sendInvitationEmail } = await import("@/server/auth-actions")
  const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${invitation.token}`

  await sendInvitationEmail({
    email: invitation.email,
    organizationName: invitation.organization.name,
    role: invitation.role === "OWNER" ? "owner" : "staff",
    inviteUrl,
  })

  revalidatePath("/dashboard/settings")
  return { success: true }
}

// ─── Media Library (uploaded logos + strip images) ────────────

export type MediaLibraryItem = {
  url: string
  type: "logo" | "strip"
  programName: string | null
}

export async function getOrgMediaLibrary(organizationId: string) {
  await assertOrganizationRole(organizationId, "owner")

  const [org, designs] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { logo: true, logoApple: true, logoGoogle: true },
    }),
    db.passDesign.findMany({
      where: { passTemplate: { organizationId } },
      select: {
        logoUrl: true,
        stripImageUrl: true,
        passTemplate: { select: { name: true } },
      },
    }),
  ])

  const seen = new Set<string>()
  const items: MediaLibraryItem[] = []

  function add(url: string | null | undefined, type: "logo" | "strip", programName: string | null) {
    if (!url || seen.has(url)) return
    seen.add(url)
    items.push({ url, type, programName })
  }

  // Organization logos
  add(org?.logo, "logo", null)
  add(org?.logoApple, "logo", null)
  add(org?.logoGoogle, "logo", null)

  // Per-program media
  for (const d of designs) {
    add(d.logoUrl, "logo", d.passTemplate.name)
    add(d.stripImageUrl, "strip", d.passTemplate.name)
  }

  return { items }
}

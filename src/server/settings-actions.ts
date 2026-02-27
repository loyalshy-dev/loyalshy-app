"use server"

import { z } from "zod"
import crypto from "crypto"
import { revalidatePath } from "next/cache"
import { addDays } from "date-fns"
import { db } from "@/lib/db"
import { assertRestaurantRole, getRestaurantForUser } from "@/lib/dal"
import { sanitizeText } from "@/lib/sanitize"
import { computeDesignHash, computeTextColor } from "@/lib/wallet/card-design"
import type { CardShape, PatternStyle, ProgressStyle, FontFamily, LabelFormat, SocialLinks } from "@/lib/wallet/card-design"

// ─── Types ─────────────────────────────────────────────────

export type ProgramWithDesign = {
  id: string
  name: string
  visitsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
  termsAndConditions: string | null
  status: string
  startsAt: Date
  endsAt: Date | null
  createdAt: Date
  enrollmentCount: number
  cardDesign: {
    shape: CardShape
    primaryColor: string | null
    secondaryColor: string | null
    textColor: string | null
    stripImageUrl: string | null
    stripImageApple: string | null
    stripImageGoogle: string | null
    patternStyle: PatternStyle
    progressStyle: ProgressStyle
    fontFamily: FontFamily
    labelFormat: LabelFormat
    customProgressLabel: string | null
    generatedStripApple: string | null
    generatedStripGoogle: string | null
    palettePreset: string | null
    templateId: string | null
    businessHours: string | null
    mapAddress: string | null
    socialLinks: SocialLinks
    customMessage: string | null
    designHash: string
  } | null
}

// ─── Schemas ────────────────────────────────────────────────

const updateProfileSchema = z.object({
  restaurantId: z.string().min(1),
  name: z.string().min(1, "Restaurant name is required").max(100),
  address: z.string().max(200).optional().default(""),
  phone: z.string().max(30).optional().default(""),
  website: z.string().url("Invalid URL").max(200).or(z.literal("")).optional().default(""),
  timezone: z.string().min(1),
})

const updateLoyaltyProgramSchema = z.object({
  restaurantId: z.string().min(1),
  programId: z.string().min(1),
  name: z.string().min(1, "Program name is required").max(100),
  visitsRequired: z.number().int().min(3).max(30),
  rewardDescription: z.string().min(1, "Reward description is required").max(200),
  rewardExpiryDays: z.number().int().min(0).max(365),
  termsAndConditions: z.string().max(5000).optional().default(""),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  resetProgress: z.boolean().optional().default(false),
})

const inviteTeamMemberSchema = z.object({
  restaurantId: z.string().min(1),
  email: z.string().email("Invalid email"),
  role: z.enum(["owner", "staff"]),
})

const saveCardDesignSchema = z.object({
  programId: z.string().min(1),
  shape: z.enum(["CLEAN", "SHOWCASE", "INFO_RICH"]),
  primaryColor: z.string().max(20).optional().default(""),
  secondaryColor: z.string().max(20).optional().default(""),
  textColor: z.string().max(20).optional().default(""),
  autoTextColor: z.boolean().optional().default(true),
  patternStyle: z.enum(["NONE", "DOTS", "WAVES", "GEOMETRIC", "CHEVRON", "CROSSHATCH", "DIAMONDS", "CONFETTI", "SOLID_PRIMARY", "SOLID_SECONDARY"]),
  progressStyle: z.enum(["NUMBERS", "CIRCLES", "SQUARES", "STARS", "STAMPS", "PERCENTAGE", "REMAINING"]).optional().default("NUMBERS"),
  fontFamily: z.enum(["SANS", "SERIF", "ROUNDED", "MONO"]).optional().default("SANS"),
  labelFormat: z.enum(["UPPERCASE", "TITLE_CASE", "LOWERCASE"]).optional().default("UPPERCASE"),
  customProgressLabel: z.string().max(30).optional().default(""),
  palettePreset: z.string().max(30).nullable().optional(),
  templateId: z.string().max(50).nullable().optional(),
  businessHours: z.string().max(1000).optional().default(""),
  mapAddress: z.string().max(500).optional().default(""),
  socialLinks: z.object({
    instagram: z.string().max(200).optional().default(""),
    facebook: z.string().max(200).optional().default(""),
    tiktok: z.string().max(200).optional().default(""),
    x: z.string().max(200).optional().default(""),
  }).optional(),
  customMessage: z.string().max(2000).optional().default(""),
})

const createLoyaltyProgramSchema = z.object({
  restaurantId: z.string().min(1),
  name: z.string().min(1, "Program name is required").max(100),
  visitsRequired: z.number().int().min(3).max(30).optional().default(10),
  rewardDescription: z.string().min(1, "Reward description is required").max(200),
  rewardExpiryDays: z.number().int().min(0).max(365).optional().default(90),
})

// ─── Get Settings Data ──────────────────────────────────────

export async function getSettingsData() {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) {
    return { error: "No restaurant found" }
  }

  await assertRestaurantRole(restaurant.id, "owner")

  // Fetch ALL programs for this restaurant, including card designs and enrollment counts
  const rawPrograms = await db.loyaltyProgram.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      cardDesign: true,
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const programs: ProgramWithDesign[] = rawPrograms.map((p) => ({
    id: p.id,
    name: p.name,
    visitsRequired: p.visitsRequired,
    rewardDescription: p.rewardDescription,
    rewardExpiryDays: p.rewardExpiryDays,
    termsAndConditions: p.termsAndConditions,
    status: p.status,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    createdAt: p.createdAt,
    enrollmentCount: p._count.enrollments,
    cardDesign: p.cardDesign
      ? {
          shape: p.cardDesign.shape as CardShape,
          primaryColor: p.cardDesign.primaryColor,
          secondaryColor: p.cardDesign.secondaryColor,
          textColor: p.cardDesign.textColor,
          stripImageUrl: p.cardDesign.stripImageUrl,
          stripImageApple: p.cardDesign.stripImageApple,
          stripImageGoogle: p.cardDesign.stripImageGoogle,
          patternStyle: p.cardDesign.patternStyle as PatternStyle,
          progressStyle: p.cardDesign.progressStyle as ProgressStyle,
          fontFamily: p.cardDesign.fontFamily as FontFamily,
          labelFormat: p.cardDesign.labelFormat as LabelFormat,
          customProgressLabel: p.cardDesign.customProgressLabel,
          generatedStripApple: p.cardDesign.generatedStripApple,
          generatedStripGoogle: p.cardDesign.generatedStripGoogle,
          palettePreset: p.cardDesign.palettePreset,
          templateId: p.cardDesign.templateId,
          businessHours: p.cardDesign.businessHours,
          mapAddress: p.cardDesign.mapAddress,
          socialLinks: p.cardDesign.socialLinks as SocialLinks,
          customMessage: p.cardDesign.customMessage,
          designHash: p.cardDesign.designHash,
        }
      : null,
  }))

  // Get team members via org
  const org = await db.organization.findUnique({
    where: { slug: restaurant.slug },
    include: {
      members: {
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
      },
    },
  })

  const members = org?.members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    createdAt: m.createdAt,
    user: m.user,
  })) ?? []

  // Get pending invitations
  const pendingInvitations = await db.staffInvitation.findMany({
    where: {
      restaurantId: restaurant.id,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  // Count enrollments with wallet passes (not customers)
  const walletPassCount = await db.enrollment.count({
    where: {
      loyaltyProgram: { restaurantId: restaurant.id },
      walletPassType: { not: "NONE" },
    },
  })

  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      logo: restaurant.logo,
      brandColor: restaurant.brandColor,
      secondaryColor: restaurant.secondaryColor,
      address: restaurant.address,
      phone: restaurant.phone,
      website: restaurant.website,
      timezone: restaurant.timezone,
      plan: restaurant.plan,
      subscriptionStatus: restaurant.subscriptionStatus,
    },
    programs,
    members,
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

// ─── Update Restaurant Profile ──────────────────────────────

export async function updateRestaurantProfile(input: z.infer<typeof updateProfileSchema>) {
  const parsed = updateProfileSchema.parse(input)
  await assertRestaurantRole(parsed.restaurantId, "owner")

  await db.restaurant.update({
    where: { id: parsed.restaurantId },
    data: {
      name: sanitizeText(parsed.name, 100),
      address: parsed.address ? sanitizeText(parsed.address, 200) || null : null,
      phone: parsed.phone ? sanitizeText(parsed.phone, 30) || null : null,
      website: parsed.website || null,
      timezone: parsed.timezone,
    },
  })

  // Also update the organization name to stay in sync
  const restaurant = await db.restaurant.findUnique({
    where: { id: parsed.restaurantId },
    select: { slug: true },
  })
  if (restaurant) {
    await db.organization.updateMany({
      where: { slug: restaurant.slug },
      data: { name: parsed.name },
    })
  }

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Create Loyalty Program ─────────────────────────────────

export async function createLoyaltyProgram(input: z.infer<typeof createLoyaltyProgramSchema>) {
  const parsed = createLoyaltyProgramSchema.parse(input)
  await assertRestaurantRole(parsed.restaurantId, "owner")

  // Create the program with a default card design
  const program = await db.loyaltyProgram.create({
    data: {
      restaurantId: parsed.restaurantId,
      name: sanitizeText(parsed.name, 100),
      visitsRequired: parsed.visitsRequired,
      rewardDescription: parsed.rewardDescription,
      rewardExpiryDays: parsed.rewardExpiryDays,
      status: "DRAFT",
      cardDesign: {
        create: {
          shape: "CLEAN",
          patternStyle: "NONE",
          progressStyle: "NUMBERS",
          fontFamily: "SANS",
          labelFormat: "UPPERCASE",
          designHash: "",
        },
      },
    },
    include: { cardDesign: true },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/programs")
  return { success: true, programId: program.id }
}

// ─── Archive Loyalty Program ────────────────────────────────

export async function archiveLoyaltyProgram(restaurantId: string, programId: string) {
  await assertRestaurantRole(restaurantId, "owner")

  // Verify program belongs to this restaurant
  const program = await db.loyaltyProgram.findUnique({
    where: { id: programId },
    select: { restaurantId: true, status: true },
  })

  if (!program || program.restaurantId !== restaurantId) {
    return { error: "Loyalty program not found" }
  }

  if (program.status === "ARCHIVED") {
    return { error: "Program is already archived" }
  }

  await db.$transaction(async (tx) => {
    // Set program to ARCHIVED
    await tx.loyaltyProgram.update({
      where: { id: programId },
      data: { status: "ARCHIVED" },
    })

    // Freeze all ACTIVE enrollments for this program
    await tx.enrollment.updateMany({
      where: {
        loyaltyProgramId: programId,
        status: "ACTIVE",
      },
      data: {
        status: "FROZEN",
        frozenAt: new Date(),
      },
    })
  })

  // Trigger wallet updates for affected enrollments
  import("@trigger.dev/sdk")
    .then(({ tasks }) =>
      tasks.trigger("update-all-passes", {
        restaurantId,
        programId,
        reason: "PROGRAM_ARCHIVED",
      })
    )
    .catch((err: unknown) =>
      console.error("Failed to trigger bulk pass update:", err instanceof Error ? err.message : "Unknown error")
    )

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/programs")
  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Save Card Design ──────────────────────────────────────

export async function saveCardDesign(input: z.infer<typeof saveCardDesignSchema>) {
  const parsed = saveCardDesignSchema.parse(input)

  // Look up the program to get the restaurantId for auth check
  const program = await db.loyaltyProgram.findUnique({
    where: { id: parsed.programId },
    select: { restaurantId: true, id: true },
  })

  if (!program) {
    return { error: "Loyalty program not found" }
  }

  await assertRestaurantRole(program.restaurantId, "owner")

  const primaryColor = parsed.primaryColor || null
  const secondaryColor = parsed.secondaryColor || null
  const textColor = parsed.autoTextColor && primaryColor
    ? computeTextColor(primaryColor)
    : (parsed.textColor || null)

  // Generate strip images if pattern is not NONE or if template has strip design
  let generatedStripApple: string | null = null
  let generatedStripGoogle: string | null = null

  const templateId = parsed.templateId ?? null

  // Check if a template with strip design is being applied
  if (templateId) {
    const { getTemplateById } = await import("@/lib/wallet/card-templates")
    const template = getTemplateById(templateId)
    if (template && template.stripDesign.type !== "none") {
      const { generateTemplateStripImage, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } =
        await import("@/lib/wallet/strip-image")
      const { put } = await import("@vercel/blob")

      const [appleBuffer, googleBuffer] = await Promise.all([
        generateTemplateStripImage(template.stripDesign, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, primaryColor ?? undefined, secondaryColor ?? undefined),
        generateTemplateStripImage(template.stripDesign, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT, primaryColor ?? undefined, secondaryColor ?? undefined),
      ])

      if (appleBuffer && googleBuffer) {
        const [appleBlob, googleBlob] = await Promise.all([
          put(`strip-images/${parsed.programId}/template-apple-${Date.now()}.png`, appleBuffer, {
            access: "public",
            addRandomSuffix: true,
          }),
          put(`strip-images/${parsed.programId}/template-google-${Date.now()}.png`, googleBuffer, {
            access: "public",
            addRandomSuffix: true,
          }),
        ])
        generatedStripApple = appleBlob.url
        generatedStripGoogle = googleBlob.url
      }
    }
  } else if (parsed.patternStyle !== "NONE" && primaryColor) {
    const { generateStripImage, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } =
      await import("@/lib/wallet/strip-image")
    const { put } = await import("@vercel/blob")

    const secondary = secondaryColor ?? "#ffffff"

    const [appleBuffer, googleBuffer] = await Promise.all([
      generateStripImage({
        primaryColor,
        secondaryColor: secondary,
        patternStyle: parsed.patternStyle as PatternStyle,
        width: APPLE_STRIP_WIDTH,
        height: APPLE_STRIP_HEIGHT,
      }),
      generateStripImage({
        primaryColor,
        secondaryColor: secondary,
        patternStyle: parsed.patternStyle as PatternStyle,
        width: GOOGLE_HERO_WIDTH,
        height: GOOGLE_HERO_HEIGHT,
      }),
    ])

    const [appleBlob, googleBlob] = await Promise.all([
      put(`strip-images/${parsed.programId}/generated-apple-${Date.now()}.png`, appleBuffer, {
        access: "public",
        addRandomSuffix: true,
      }),
      put(`strip-images/${parsed.programId}/generated-google-${Date.now()}.png`, googleBuffer, {
        access: "public",
        addRandomSuffix: true,
      }),
    ])

    generatedStripApple = appleBlob.url
    generatedStripGoogle = googleBlob.url
  }

  const socialLinks = {
    instagram: parsed.socialLinks?.instagram || undefined,
    facebook: parsed.socialLinks?.facebook || undefined,
    tiktok: parsed.socialLinks?.tiktok || undefined,
    x: parsed.socialLinks?.x || undefined,
  }

  // Compute design hash
  const existingDesign = await db.cardDesign.findUnique({
    where: { loyaltyProgramId: parsed.programId },
    select: {
      designHash: true,
      generatedStripApple: true,
      generatedStripGoogle: true,
      stripImageApple: true,
      stripImageGoogle: true,
    },
  })

  const newHash = computeDesignHash({
    shape: parsed.shape,
    primaryColor,
    secondaryColor,
    textColor,
    stripImageApple: existingDesign?.stripImageApple ?? null,
    stripImageGoogle: existingDesign?.stripImageGoogle ?? null,
    patternStyle: parsed.patternStyle,
    progressStyle: parsed.progressStyle,
    fontFamily: parsed.fontFamily,
    labelFormat: parsed.labelFormat,
    customProgressLabel: parsed.customProgressLabel || null,
    generatedStripApple,
    generatedStripGoogle,
    businessHours: parsed.businessHours || null,
    mapAddress: parsed.mapAddress || null,
    socialLinks,
    customMessage: parsed.customMessage || null,
  })

  // Delete old generated strip images if we're replacing them
  if (generatedStripApple && existingDesign?.generatedStripApple) {
    try {
      const { del } = await import("@vercel/blob")
      await del([existingDesign.generatedStripApple, existingDesign.generatedStripGoogle!].filter(Boolean))
    } catch {
      // Old blobs may not exist
    }
  }

  // Upsert card design by loyaltyProgramId
  await db.cardDesign.upsert({
    where: { loyaltyProgramId: parsed.programId },
    create: {
      loyaltyProgramId: parsed.programId,
      shape: parsed.shape,
      primaryColor,
      secondaryColor,
      textColor,
      patternStyle: parsed.patternStyle,
      progressStyle: parsed.progressStyle,
      fontFamily: parsed.fontFamily,
      labelFormat: parsed.labelFormat,
      customProgressLabel: parsed.customProgressLabel || null,
      generatedStripApple,
      generatedStripGoogle,
      palettePreset: parsed.palettePreset ?? null,
      templateId,
      businessHours: parsed.businessHours || null,
      mapAddress: parsed.mapAddress || null,
      socialLinks,
      customMessage: parsed.customMessage || null,
      designHash: newHash,
    },
    update: {
      shape: parsed.shape,
      primaryColor,
      secondaryColor,
      textColor,
      patternStyle: parsed.patternStyle,
      progressStyle: parsed.progressStyle,
      fontFamily: parsed.fontFamily,
      labelFormat: parsed.labelFormat,
      customProgressLabel: parsed.customProgressLabel || null,
      ...(generatedStripApple ? { generatedStripApple, generatedStripGoogle } : {}),
      palettePreset: parsed.palettePreset ?? null,
      templateId,
      businessHours: parsed.businessHours || null,
      mapAddress: parsed.mapAddress || null,
      socialLinks,
      customMessage: parsed.customMessage || null,
      designHash: newHash,
    },
  })

  // Sync colors back to Restaurant for brand consistency
  if (primaryColor || secondaryColor) {
    await db.restaurant.update({
      where: { id: program.restaurantId },
      data: {
        ...(primaryColor ? { brandColor: primaryColor } : {}),
        ...(secondaryColor ? { secondaryColor } : {}),
      },
    })
  }

  // If design hash changed, trigger bulk pass update for this program's enrollments only
  const hashChanged = existingDesign?.designHash !== newHash
  if (hashChanged) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-all-passes", {
          restaurantId: program.restaurantId,
          programId: parsed.programId,
          reason: "DESIGN_CHANGE",
        })
      )
      .catch((err: unknown) =>
        console.error("Failed to trigger bulk pass update:", err instanceof Error ? err.message : "Unknown error")
      )
  }

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/programs")
  revalidatePath("/dashboard")
  const slug = (await db.restaurant.findUnique({ where: { id: program.restaurantId }, select: { slug: true } }))?.slug
  if (slug) {
    revalidatePath(`/join/${slug}`)
  }
  return { success: true, hashChanged }
}

// ─── Upload Strip Image ──────────────────────────────────────

export async function uploadStripImage(formData: FormData) {
  const programId = formData.get("programId") as string
  const file = formData.get("file") as File

  if (!programId || !file) {
    return { error: "Missing program ID or file" }
  }

  // Look up the program to get restaurantId for auth check
  const program = await db.loyaltyProgram.findUnique({
    where: { id: programId },
    select: { restaurantId: true },
  })

  if (!program) {
    return { error: "Loyalty program not found" }
  }

  await assertRestaurantRole(program.restaurantId, "owner")

  // Validate file
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return { error: "File must be under 5MB" }
  }

  const validTypes = ["image/png", "image/jpeg", "image/webp"]
  if (!validTypes.includes(file.type)) {
    return { error: "File must be PNG, JPEG, or WebP" }
  }

  const { put, del } = await import("@vercel/blob")
  const { processUploadedStripImage } = await import("@/lib/wallet/strip-image")

  // Upload original
  const originalBlob = await put(
    `strip-images/${programId}/original-${Date.now()}.${file.name.split(".").pop()}`,
    file,
    { access: "public", addRandomSuffix: true }
  )

  // Crop to Apple and Google dimensions
  const originalBuffer = Buffer.from(await file.arrayBuffer())
  const { appleBuffer, googleBuffer } = await processUploadedStripImage(originalBuffer)

  const [appleBlob, googleBlob] = await Promise.all([
    put(`strip-images/${programId}/apple-${Date.now()}.png`, appleBuffer, {
      access: "public",
      addRandomSuffix: true,
    }),
    put(`strip-images/${programId}/google-${Date.now()}.png`, googleBuffer, {
      access: "public",
      addRandomSuffix: true,
    }),
  ])

  // Delete old strip images
  const existing = await db.cardDesign.findUnique({
    where: { loyaltyProgramId: programId },
    select: { stripImageUrl: true, stripImageApple: true, stripImageGoogle: true },
  })
  if (existing) {
    const toDelete = [existing.stripImageUrl, existing.stripImageApple, existing.stripImageGoogle].filter(Boolean) as string[]
    if (toDelete.length > 0) {
      try { await del(toDelete) } catch { /* old blobs may not exist */ }
    }
  }

  // Update card design with new strip image URLs
  await db.cardDesign.upsert({
    where: { loyaltyProgramId: programId },
    create: {
      loyaltyProgramId: programId,
      stripImageUrl: originalBlob.url,
      stripImageApple: appleBlob.url,
      stripImageGoogle: googleBlob.url,
    },
    update: {
      stripImageUrl: originalBlob.url,
      stripImageApple: appleBlob.url,
      stripImageGoogle: googleBlob.url,
    },
  })

  revalidatePath("/dashboard/settings")
  return {
    success: true,
    originalUrl: originalBlob.url,
    appleUrl: appleBlob.url,
    googleUrl: googleBlob.url,
  }
}

// ─── Delete Strip Image ─────────────────────────────────────

export async function deleteStripImage(programId: string) {
  // Look up the program to get restaurantId for auth check
  const program = await db.loyaltyProgram.findUnique({
    where: { id: programId },
    select: { restaurantId: true },
  })

  if (!program) {
    return { error: "Loyalty program not found" }
  }

  await assertRestaurantRole(program.restaurantId, "owner")

  const existing = await db.cardDesign.findUnique({
    where: { loyaltyProgramId: programId },
    select: { stripImageUrl: true, stripImageApple: true, stripImageGoogle: true },
  })

  if (existing) {
    const toDelete = [existing.stripImageUrl, existing.stripImageApple, existing.stripImageGoogle].filter(Boolean) as string[]
    if (toDelete.length > 0) {
      try {
        const { del } = await import("@vercel/blob")
        await del(toDelete)
      } catch { /* ok */ }
    }

    await db.cardDesign.update({
      where: { loyaltyProgramId: programId },
      data: {
        stripImageUrl: null,
        stripImageApple: null,
        stripImageGoogle: null,
      },
    })
  }

  revalidatePath("/dashboard/settings")
  return { success: true }
}

// ─── Upload Restaurant Logo ─────────────────────────────────

export async function uploadRestaurantLogo(formData: FormData) {
  const restaurantId = formData.get("restaurantId") as string
  const file = formData.get("file") as File

  if (!restaurantId || !file) {
    return { error: "Missing restaurant ID or file" }
  }

  await assertRestaurantRole(restaurantId, "owner")

  // Validate file
  const maxSize = 2 * 1024 * 1024 // 2MB
  if (file.size > maxSize) {
    return { error: "File must be under 2MB" }
  }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) {
    return { error: "File must be PNG, JPEG, WebP, or SVG" }
  }

  // Upload to Vercel Blob
  const { put } = await import("@vercel/blob")
  const blob = await put(`logos/${restaurantId}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  })

  // Delete old logo if exists
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { logo: true },
  })
  if (restaurant?.logo) {
    try {
      const { del } = await import("@vercel/blob")
      await del(restaurant.logo)
    } catch {
      // Old logo may not exist in blob storage
    }
  }

  // Update restaurant with new logo URL
  await db.restaurant.update({
    where: { id: restaurantId },
    data: { logo: blob.url },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { success: true, url: blob.url }
}

// ─── Delete Restaurant Logo ─────────────────────────────────

export async function deleteRestaurantLogo(restaurantId: string) {
  await assertRestaurantRole(restaurantId, "owner")

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { logo: true },
  })

  if (restaurant?.logo) {
    try {
      const { del } = await import("@vercel/blob")
      await del(restaurant.logo)
    } catch {
      // Blob may not exist
    }
  }

  await db.restaurant.update({
    where: { id: restaurantId },
    data: { logo: null },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Update Loyalty Program ─────────────────────────────────

export async function updateLoyaltyProgram(input: z.infer<typeof updateLoyaltyProgramSchema>) {
  const parsed = updateLoyaltyProgramSchema.parse(input)
  await assertRestaurantRole(parsed.restaurantId, "owner")

  // Check if visitsRequired changed and resetProgress is requested
  const currentProgram = await db.loyaltyProgram.findUnique({
    where: { id: parsed.programId },
  })

  if (!currentProgram || currentProgram.restaurantId !== parsed.restaurantId) {
    return { error: "Loyalty program not found" }
  }

  const visitsChanged = currentProgram.visitsRequired !== parsed.visitsRequired

  await db.$transaction(async (tx) => {
    // Update loyalty program
    await tx.loyaltyProgram.update({
      where: { id: parsed.programId },
      data: {
        name: sanitizeText(parsed.name, 100),
        visitsRequired: parsed.visitsRequired,
        rewardDescription: parsed.rewardDescription,
        rewardExpiryDays: parsed.rewardExpiryDays,
        termsAndConditions: parsed.termsAndConditions || null,
        status: parsed.status,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt ?? null,
      },
    })

    // If visits required changed and user wants to reset progress,
    // update Enrollment.currentCycleVisits instead of Customer.currentCycleVisits
    if (visitsChanged && parsed.resetProgress) {
      await tx.enrollment.updateMany({
        where: { loyaltyProgramId: parsed.programId },
        data: { currentCycleVisits: 0 },
      })
    }
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/programs")
  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Get Team Members ───────────────────────────────────────

export async function getTeamMembers(restaurantId: string) {
  await assertRestaurantRole(restaurantId, "owner")

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
  })

  if (!restaurant) {
    return { members: [], pendingInvitations: [] }
  }

  const org = await db.organization.findUnique({
    where: { slug: restaurant.slug },
    include: {
      members: {
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
      },
    },
  })

  const pendingInvitations = await db.staffInvitation.findMany({
    where: {
      restaurantId,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  return {
    members: org?.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
      user: m.user,
    })) ?? [],
    pendingInvitations: pendingInvitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
    })),
  }
}

// ─── Invite Team Member ─────────────────────────────────────

export async function inviteTeamMember(input: z.infer<typeof inviteTeamMemberSchema>) {
  const parsed = inviteTeamMemberSchema.parse(input)
  await assertRestaurantRole(parsed.restaurantId, "owner")

  // Check plan staff limit
  const { checkStaffLimit } = await import("@/server/billing-actions")
  const limitCheck = await checkStaffLimit(parsed.restaurantId)
  if (!limitCheck.allowed) {
    return {
      error: `You've reached the ${limitCheck.limit} team member limit for your plan. Upgrade to invite more staff.`,
    }
  }

  // Check for existing pending invitation
  const existing = await db.staffInvitation.findFirst({
    where: {
      restaurantId: parsed.restaurantId,
      email: parsed.email,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
  })

  if (existing) {
    return { error: "An invitation has already been sent to this email" }
  }

  // Check if user is already a member
  const restaurant = await db.restaurant.findUnique({
    where: { id: parsed.restaurantId },
    include: { users: { where: { email: parsed.email } } },
  })

  if (restaurant?.users.length) {
    return { error: "This user is already a team member" }
  }

  // Generate invitation token
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = addDays(new Date(), 7)

  await db.staffInvitation.create({
    data: {
      restaurantId: parsed.restaurantId,
      email: parsed.email,
      role: parsed.role === "owner" ? "OWNER" : "STAFF",
      token,
      expiresAt,
    },
  })

  // Dispatch invitation email via Trigger.dev
  const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${token}`

  import("@trigger.dev/sdk")
    .then(({ tasks }) =>
      tasks.trigger("send-invitation-email", {
        email: parsed.email,
        restaurantName: restaurant?.name ?? "A restaurant",
        role: parsed.role,
        inviteUrl,
      })
    )
    .catch((err: unknown) => console.error("Email dispatch failed:", err instanceof Error ? err.message : "Unknown error"))

  revalidatePath("/dashboard/settings")
  return { success: true }
}

// ─── Remove Team Member ─────────────────────────────────────

export async function removeTeamMember(restaurantId: string, memberId: string) {
  const { session } = await assertRestaurantRole(restaurantId, "owner")

  const member = await db.member.findUnique({
    where: { id: memberId },
    include: { user: true },
  })

  if (!member) {
    return { error: "Member not found" }
  }

  // Don't allow removing yourself
  if (member.userId === session.user.id) {
    return { error: "You cannot remove yourself" }
  }

  await db.$transaction([
    db.member.delete({ where: { id: memberId } }),
    db.user.update({
      where: { id: member.userId },
      data: { restaurantId: null },
    }),
  ])

  revalidatePath("/dashboard/settings")
  return { success: true }
}

// ─── Cancel Invitation ──────────────────────────────────────

export async function cancelInvitation(restaurantId: string, invitationId: string) {
  await assertRestaurantRole(restaurantId, "owner")

  await db.staffInvitation.delete({
    where: { id: invitationId },
  })

  revalidatePath("/dashboard/settings")
  return { success: true }
}

// ─── Resend Invitation ──────────────────────────────────────

export async function resendInvitation(restaurantId: string, invitationId: string) {
  await assertRestaurantRole(restaurantId, "owner")

  const invitation = await db.staffInvitation.findUnique({
    where: { id: invitationId },
    include: { restaurant: true },
  })

  if (!invitation || invitation.restaurantId !== restaurantId) {
    return { error: "Invitation not found" }
  }

  // Generate new token and extend expiry
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = addDays(new Date(), 7)

  await db.staffInvitation.update({
    where: { id: invitationId },
    data: { token, expiresAt },
  })

  const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${token}`

  import("@trigger.dev/sdk")
    .then(({ tasks }) =>
      tasks.trigger("send-invitation-email", {
        email: invitation.email,
        restaurantName: invitation.restaurant.name,
        role: invitation.role === "OWNER" ? "owner" : "staff",
        inviteUrl,
      })
    )
    .catch((err: unknown) => console.error("Email dispatch failed:", err instanceof Error ? err.message : "Unknown error"))

  revalidatePath("/dashboard/settings")
  return { success: true }
}

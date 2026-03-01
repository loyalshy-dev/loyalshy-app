"use server"

import { z } from "zod"
import crypto from "crypto"
import { revalidatePath } from "next/cache"
import { addDays } from "date-fns"
import { db } from "@/lib/db"
import { assertRestaurantRole, getRestaurantForUser } from "@/lib/dal"
import { sanitizeText } from "@/lib/sanitize"
import { checkProgramLimit } from "@/server/billing-actions"
import { computeDesignHash, computeTextColor } from "@/lib/wallet/card-design"
import type { CardType, CardShape, PatternStyle, ProgressStyle, FontFamily, LabelFormat, SocialLinks } from "@/lib/wallet/card-design"

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
    cardType: CardType
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
    mapLatitude: number | null
    mapLongitude: number | null
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
  cardType: z.enum(["STAMP", "POINTS", "TIER", "COUPON"]).optional().default("STAMP"),
  shape: z.enum(["CLEAN", "SHOWCASE", "INFO_RICH"]),
  primaryColor: z.string().max(20).optional().default(""),
  secondaryColor: z.string().max(20).optional().default(""),
  textColor: z.string().max(20).optional().default(""),
  autoTextColor: z.boolean().optional().default(false),
  patternStyle: z.enum(["NONE", "DOTS", "WAVES", "GEOMETRIC", "CHEVRON", "CROSSHATCH", "DIAMONDS", "CONFETTI", "SOLID_PRIMARY", "SOLID_SECONDARY", "STAMP_GRID"]),
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
  useStampGrid: z.boolean().optional().default(false),
  stampGridConfig: z.object({
    stampIcon: z.string().max(50),
    customStampIconUrl: z.string().nullable().optional(),
    rewardIcon: z.string().max(10),
    stampShape: z.enum(["circle", "rounded-square", "square"]),
    filledStyle: z.enum(["icon", "icon-with-border", "solid"]),
    useStripBackground: z.boolean().optional(),
  }).optional(),
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
          cardType: p.cardDesign.cardType as CardType,
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
          mapLatitude: p.cardDesign.mapLatitude,
          mapLongitude: p.cardDesign.mapLongitude,
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

  // Enforce plan program limit
  const programCheck = await checkProgramLimit(parsed.restaurantId)
  if (!programCheck.allowed) {
    return { error: `Program limit reached (${programCheck.limit}). Upgrade your plan to create more programs.` }
  }

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
  let parsed: z.infer<typeof saveCardDesignSchema>
  try {
    parsed = saveCardDesignSchema.parse(input)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: `Validation failed: ${err.issues.map((e: { message: string }) => e.message).join(", ")}` }
    }
    return { error: "Invalid design data" }
  }

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

  // Build editorConfig — store stampGridConfig, image filters, stamp grid toggle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorConfig: Record<string, any> = {}
  if (parsed.useStampGrid) {
    editorConfig.useStampGrid = true
  }
  if (parsed.stampGridConfig) {
    editorConfig.stampGridConfig = parsed.stampGridConfig
  }
  if (parsed.stripOpacity !== undefined && parsed.stripOpacity !== 1) {
    editorConfig.stripOpacity = parsed.stripOpacity
  }
  if (parsed.stripGrayscale) {
    editorConfig.stripGrayscale = true
  }
  if (parsed.stripColor1) {
    editorConfig.stripColor1 = parsed.stripColor1
  }
  if (parsed.stripColor2) {
    editorConfig.stripColor2 = parsed.stripColor2
  }
  if (parsed.stripFill && parsed.stripFill !== "gradient") {
    editorConfig.stripFill = parsed.stripFill
  }
  if (parsed.patternColor) {
    editorConfig.patternColor = parsed.patternColor
  }
  if (parsed.stripImagePosition && (parsed.stripImagePosition.x !== 0.5 || parsed.stripImagePosition.y !== 0.5)) {
    editorConfig.stripImagePosition = parsed.stripImagePosition
  }
  if (parsed.stripImageZoom && parsed.stripImageZoom !== 1) {
    editorConfig.stripImageZoom = parsed.stripImageZoom
  }

  // Generate pattern-based strip images when pattern is not NONE.
  // When stamp grid is active, strips are generated dynamically per-enrollment.
  // Strip image generation + Blob upload is optional — skip gracefully
  // when BLOB_READ_WRITE_TOKEN is not configured (e.g. local development).
  // Use strip-specific colors for pattern generation (fall back to card colors)
  const stripPrimary = parsed.stripColor1 || primaryColor
  const stripSecondary = parsed.patternColor || parsed.stripColor2 || secondaryColor

  if (parsed.patternStyle !== "NONE" && stripPrimary) {
    try {
      const { generateStripImage, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } =
        await import("@/lib/wallet/strip-image")
      const { put } = await import("@vercel/blob")

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

  // Compute design hash
  const existingDesign = await db.cardDesign.findUnique({
    where: { loyaltyProgramId: parsed.programId },
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

  // Re-crop strip image when position/zoom changed and a strip image exists
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
        const { put, del } = await import("@vercel/blob")

        const imgRes = await fetch(existingDesign.stripImageUrl)
        if (imgRes.ok) {
          const originalBuffer = Buffer.from(await imgRes.arrayBuffer())
          const [appleBuffer, googleBuffer] = await Promise.all([
            cropStripImageWithPosition(originalBuffer, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, newPos, newZoom),
            cropStripImageWithPosition(originalBuffer, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT, newPos, newZoom),
          ])
          const [appleBlob, googleBlob] = await Promise.all([
            put(`strip-images/${parsed.programId}/apple-${Date.now()}.png`, appleBuffer, { access: "public", addRandomSuffix: true }),
            put(`strip-images/${parsed.programId}/google-${Date.now()}.png`, googleBuffer, { access: "public", addRandomSuffix: true }),
          ])
          reCroppedApple = appleBlob.url
          reCroppedGoogle = googleBlob.url

          // Delete old crops
          const oldCrops = [existingDesign.stripImageApple, existingDesign.stripImageGoogle].filter(Boolean) as string[]
          if (oldCrops.length > 0) {
            try { await del(oldCrops) } catch { /* old blobs may not exist */ }
          }
        }
      } catch {
        // Blob token not configured or fetch failed — skip re-crop
      }
    }
  }

  const newHash = computeDesignHash({
    shape: parsed.shape,
    primaryColor,
    secondaryColor,
    textColor,
    stripImageApple: reCroppedApple ?? existingDesign?.stripImageApple ?? null,
    stripImageGoogle: reCroppedGoogle ?? existingDesign?.stripImageGoogle ?? null,
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
    editorConfig,
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

  // For stamp grid, clear static generated strips (they're generated dynamically)
  const isStampGrid = parsed.useStampGrid

  // Upsert card design by loyaltyProgramId
  await db.cardDesign.upsert({
    where: { loyaltyProgramId: parsed.programId },
    create: {
      loyaltyProgramId: parsed.programId,
      cardType: parsed.cardType,
      shape: parsed.shape,
      primaryColor,
      secondaryColor,
      textColor,
      patternStyle: parsed.patternStyle,
      progressStyle: parsed.progressStyle,
      fontFamily: parsed.fontFamily,
      labelFormat: parsed.labelFormat,
      customProgressLabel: parsed.customProgressLabel || null,
      generatedStripApple: isStampGrid ? null : generatedStripApple,
      generatedStripGoogle: isStampGrid ? null : generatedStripGoogle,
      palettePreset: parsed.palettePreset ?? null,
      templateId,
      businessHours: parsed.businessHours || null,
      mapAddress: parsed.mapAddress || null,
      socialLinks,
      customMessage: parsed.customMessage || null,
      designHash: newHash,
      editorConfig,
    },
    update: {
      cardType: parsed.cardType,
      shape: parsed.shape,
      primaryColor,
      secondaryColor,
      textColor,
      patternStyle: parsed.patternStyle,
      progressStyle: parsed.progressStyle,
      fontFamily: parsed.fontFamily,
      labelFormat: parsed.labelFormat,
      customProgressLabel: parsed.customProgressLabel || null,
      ...(isStampGrid
        ? { generatedStripApple: null, generatedStripGoogle: null }
        : generatedStripApple ? { generatedStripApple, generatedStripGoogle } : {}),
      ...(reCroppedApple ? { stripImageApple: reCroppedApple, stripImageGoogle: reCroppedGoogle } : {}),
      palettePreset: parsed.palettePreset ?? null,
      templateId,
      businessHours: parsed.businessHours || null,
      mapAddress: parsed.mapAddress || null,
      socialLinks,
      customMessage: parsed.customMessage || null,
      designHash: newHash,
      editorConfig,
    },
  })

  // Geocode address if it changed
  const newMapAddress = parsed.mapAddress || null
  const oldMapAddress = existingDesign?.mapAddress ?? null
  if (newMapAddress !== oldMapAddress) {
    if (newMapAddress) {
      try {
        const { geocodeAddress } = await import("@/lib/geocoding")
        const coords = await geocodeAddress(newMapAddress)
        await db.cardDesign.update({
          where: { loyaltyProgramId: parsed.programId },
          data: {
            mapLatitude: coords?.lat ?? null,
            mapLongitude: coords?.lng ?? null,
          },
        })
      } catch {
        // Geocoding failure never blocks save — coordinates remain null
      }
    } else {
      // Address cleared — remove coordinates
      await db.cardDesign.update({
        where: { loyaltyProgramId: parsed.programId },
        data: { mapLatitude: null, mapLongitude: null },
      })
    }
  }

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

  const originalBuffer = Buffer.from(await file.arrayBuffer())

  // Read current position/zoom from editorConfig for crop
  const currentDesign = await db.cardDesign.findUnique({
    where: { loyaltyProgramId: programId },
    select: { editorConfig: true },
  })
  const cfg = currentDesign?.editorConfig as Record<string, unknown> | null
  const position = cfg?.stripImagePosition as { x: number; y: number } | undefined
  const zoom = cfg?.stripImageZoom as number | undefined

  let originalUrl: string
  let appleUrl: string
  let googleUrl: string

  try {
    const { put, del } = await import("@vercel/blob")
    const { processUploadedStripImage } = await import("@/lib/wallet/strip-image")

    // Upload original
    const originalBlob = await put(
      `strip-images/${programId}/original-${Date.now()}.${file.name.split(".").pop()}`,
      file,
      { access: "public", addRandomSuffix: true }
    )

    // Crop to Apple and Google dimensions (with position/zoom if set)
    const { appleBuffer, googleBuffer } = await processUploadedStripImage(originalBuffer, position, zoom)

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

    originalUrl = originalBlob.url
    appleUrl = appleBlob.url
    googleUrl = googleBlob.url
  } catch {
    // BLOB_READ_WRITE_TOKEN not configured — use data URI fallback for local dev
    const dataUri = `data:${file.type};base64,${originalBuffer.toString("base64")}`
    originalUrl = dataUri
    appleUrl = dataUri
    googleUrl = dataUri
  }

  // Update card design with new strip image URLs
  await db.cardDesign.upsert({
    where: { loyaltyProgramId: programId },
    create: {
      loyaltyProgramId: programId,
      stripImageUrl: originalUrl,
      stripImageApple: appleUrl,
      stripImageGoogle: googleUrl,
    },
    update: {
      stripImageUrl: originalUrl,
      stripImageApple: appleUrl,
      stripImageGoogle: googleUrl,
    },
  })

  revalidatePath("/dashboard/settings")
  return {
    success: true,
    originalUrl,
    appleUrl,
    googleUrl,
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

// ─── Upload Custom Stamp Icon ────────────────────────────────

export async function uploadStampIcon(formData: FormData) {
  const programId = formData.get("programId") as string
  const file = formData.get("file") as File

  if (!programId || !file) {
    return { error: "Missing program ID or file" }
  }

  const program = await db.loyaltyProgram.findUnique({
    where: { id: programId },
    select: { restaurantId: true },
  })

  if (!program) {
    return { error: "Loyalty program not found" }
  }

  await assertRestaurantRole(program.restaurantId, "owner")

  // Validate file
  const maxSize = 2 * 1024 * 1024 // 2MB
  if (file.size > maxSize) {
    return { error: "File must be under 2MB" }
  }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) {
    return { error: "File must be PNG, JPEG, WebP, or SVG" }
  }

  // Look up existing editorConfig for cleanup + merge
  const existing = await db.cardDesign.findUnique({
    where: { loyaltyProgramId: programId },
    select: { editorConfig: true },
  })

  // Auto-trim transparent whitespace for raster images
  const rawBuffer = Buffer.from(await file.arrayBuffer())
  let processedBuffer: Buffer = rawBuffer
  let processedType = file.type
  if (file.type !== "image/svg+xml") {
    try {
      const { default: sharp } = await import("sharp")
      processedBuffer = await sharp(rawBuffer).trim().png().toBuffer()
      processedType = "image/png"
    } catch {
      // trim failed (e.g. fully opaque image) — use original
    }
  }

  let blobUrl: string
  try {
    const { put, del } = await import("@vercel/blob")

    // Delete old stamp icon blob if one exists
    if (existing?.editorConfig && typeof existing.editorConfig === "object") {
      const cfg = existing.editorConfig as Record<string, unknown>
      const stampCfg = cfg.stampGridConfig as Record<string, unknown> | undefined
      const oldUrl = stampCfg?.customStampIconUrl
      if (typeof oldUrl === "string") {
        try { await del(oldUrl) } catch { /* old blob may not exist */ }
      }
    }

    const ext = processedType === "image/png" ? "png" : (file.name.split(".").pop() ?? "png")
    const blob = await put(
      `stamp-icons/${programId}/stamp-${Date.now()}.${ext}`,
      processedBuffer,
      { access: "public", addRandomSuffix: true }
    )
    blobUrl = blob.url
  } catch {
    // BLOB_READ_WRITE_TOKEN not configured — use local object URL fallback
    // In local dev, store a data URI so the preview still works
    blobUrl = `data:${processedType};base64,${processedBuffer.toString("base64")}`
  }

  // Update editorConfig with the new custom stamp icon URL
  const editorConfig = (existing?.editorConfig && typeof existing.editorConfig === "object"
    ? existing.editorConfig
    : {}) as Record<string, unknown>

  const stampGridConfig = (editorConfig.stampGridConfig && typeof editorConfig.stampGridConfig === "object"
    ? editorConfig.stampGridConfig
    : {}) as Record<string, unknown>

  await db.cardDesign.update({
    where: { loyaltyProgramId: programId },
    data: {
      editorConfig: {
        ...editorConfig,
        stampGridConfig: { ...stampGridConfig, customStampIconUrl: blobUrl },
      },
    },
  })

  revalidatePath("/dashboard/programs")
  return { success: true, url: blobUrl }
}

// ─── Delete Custom Stamp Icon ────────────────────────────────

export async function deleteStampIcon(programId: string) {
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
    select: { editorConfig: true },
  })

  if (existing?.editorConfig && typeof existing.editorConfig === "object") {
    const editorConfig = existing.editorConfig as Record<string, unknown>
    const stampGridConfig = (editorConfig.stampGridConfig && typeof editorConfig.stampGridConfig === "object"
      ? editorConfig.stampGridConfig
      : {}) as Record<string, unknown>

    const oldUrl = stampGridConfig.customStampIconUrl
    if (typeof oldUrl === "string") {
      try {
        const { del } = await import("@vercel/blob")
        await del(oldUrl)
      } catch { /* ok */ }
    }

    await db.cardDesign.update({
      where: { loyaltyProgramId: programId },
      data: {
        editorConfig: {
          ...editorConfig,
          stampGridConfig: { ...stampGridConfig, customStampIconUrl: null },
        },
      },
    })
  }

  revalidatePath("/dashboard/programs")
  return { success: true }
}

// ─── Logo Processing Constants ──────────────────────────────

// Apple Wallet: wide rectangle, 160×50pt → 320×100px @2x
const APPLE_LOGO_WIDTH = 320
const APPLE_LOGO_HEIGHT = 100

// Google Wallet: circular mask, 660–840px square with ~15% safe margin
const GOOGLE_LOGO_SIZE = 660

// ─── Logo Processing Helpers ────────────────────────────────

async function processLogoForApple(sourceBuffer: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp")

  // Get source dimensions
  const meta = await sharp(sourceBuffer).metadata()
  const srcW = meta.width ?? 1
  const srcH = meta.height ?? 1

  // Fit the logo inside the Apple rectangle, centered, transparent background
  // Use "contain" so we never crop — just center-fit with padding
  return sharp(sourceBuffer)
    .resize(APPLE_LOGO_WIDTH, APPLE_LOGO_HEIGHT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

async function processLogoForGoogle(sourceBuffer: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp")

  // Get source dimensions
  const meta = await sharp(sourceBuffer).metadata()
  const srcW = meta.width ?? 1
  const srcH = meta.height ?? 1

  // For Google, we need a square with ~15% margin so the artwork
  // doesn't clip when the circle mask is applied.
  // Content area = 70% of the square, centered
  const contentSize = Math.round(GOOGLE_LOGO_SIZE * 0.70)

  // First resize source to fit inside the content area
  const resized = await sharp(sourceBuffer)
    .resize(contentSize, contentSize, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer()

  // Then composite onto a full-size transparent square
  const margin = Math.round((GOOGLE_LOGO_SIZE - contentSize) / 2)
  return sharp({
    create: {
      width: GOOGLE_LOGO_SIZE,
      height: GOOGLE_LOGO_SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: margin, top: margin }])
    .png()
    .toBuffer()
}

async function uploadBuffer(
  buffer: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  try {
    const { put } = await import("@vercel/blob")
    const blob = await put(path, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    })
    return blob.url
  } catch {
    // BLOB_READ_WRITE_TOKEN not configured — data URI fallback for local dev
    return `data:${contentType};base64,${buffer.toString("base64")}`
  }
}

async function deleteBlob(url: string | null | undefined) {
  if (!url || url.startsWith("data:")) return
  try {
    const { del } = await import("@vercel/blob")
    await del(url)
  } catch {
    // Blob may not exist
  }
}

// ─── Upload Restaurant Logo ─────────────────────────────────
// Single upload → stores source + auto-generates Apple and Google versions

export async function uploadRestaurantLogo(formData: FormData) {
  const restaurantId = formData.get("restaurantId") as string
  const file = formData.get("file") as File

  if (!restaurantId || !file) {
    return { error: "Missing restaurant ID or file" }
  }

  await assertRestaurantRole(restaurantId, "owner")

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: "File must be under 2MB" }
  }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) {
    return { error: "File must be PNG, JPEG, WebP, or SVG" }
  }

  // Delete old logos
  const old = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { logo: true, logoApple: true, logoGoogle: true },
  })
  await Promise.all([
    deleteBlob(old?.logo),
    deleteBlob(old?.logoApple),
    deleteBlob(old?.logoGoogle),
  ])

  const sourceBuffer = Buffer.from(await file.arrayBuffer())

  // Upload source logo
  const logoUrl = await uploadBuffer(
    sourceBuffer,
    `logos/${restaurantId}/source/${file.name}`,
    file.type
  )

  // Auto-generate platform-optimized versions (skip for SVG — pass through)
  let appleUrl: string
  let googleUrl: string

  if (file.type === "image/svg+xml") {
    // SVG: use source as-is for both (wallets handle SVG rendering)
    appleUrl = logoUrl
    googleUrl = logoUrl
  } else {
    const [appleBuf, googleBuf] = await Promise.all([
      processLogoForApple(sourceBuffer),
      processLogoForGoogle(sourceBuffer),
    ])

    const [aUrl, gUrl] = await Promise.all([
      uploadBuffer(appleBuf, `logos/${restaurantId}/apple/logo.png`, "image/png"),
      uploadBuffer(googleBuf, `logos/${restaurantId}/google/logo.png`, "image/png"),
    ])
    appleUrl = aUrl
    googleUrl = gUrl
  }

  await db.restaurant.update({
    where: { id: restaurantId },
    data: { logo: logoUrl, logoApple: appleUrl, logoGoogle: googleUrl },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/programs")
  return { success: true, url: logoUrl, appleUrl, googleUrl }
}

// ─── Delete Restaurant Logo ─────────────────────────────────

export async function deleteRestaurantLogo(restaurantId: string) {
  await assertRestaurantRole(restaurantId, "owner")

  const old = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { logo: true, logoApple: true, logoGoogle: true },
  })

  await Promise.all([
    deleteBlob(old?.logo),
    deleteBlob(old?.logoApple),
    deleteBlob(old?.logoGoogle),
  ])

  await db.restaurant.update({
    where: { id: restaurantId },
    data: { logo: null, logoApple: null, logoGoogle: null },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/programs")
  return { success: true }
}

// ─── Upload Platform Logo Override (Apple / Google) ─────────
// Manual override for one platform — replaces the auto-generated version

export async function uploadPlatformLogo(formData: FormData) {
  const restaurantId = formData.get("restaurantId") as string
  const platform = formData.get("platform") as string
  const file = formData.get("file") as File

  if (!restaurantId || !file || !platform) {
    return { error: "Missing restaurant ID, platform, or file" }
  }

  if (platform !== "apple" && platform !== "google") {
    return { error: "Platform must be 'apple' or 'google'" }
  }

  await assertRestaurantRole(restaurantId, "owner")

  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: "File must be under 2MB" }
  }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) {
    return { error: "File must be PNG, JPEG, WebP, or SVG" }
  }

  const column = platform === "apple" ? "logoApple" : "logoGoogle"

  // Delete old platform logo
  const old = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { [column]: true },
  })
  const oldUrl = (old as Record<string, unknown>)?.[column] as string | null
  await deleteBlob(oldUrl)

  const sourceBuffer = Buffer.from(await file.arrayBuffer())

  // Process for the target platform (optimize even manual overrides)
  let processedUrl: string
  if (file.type === "image/svg+xml") {
    processedUrl = await uploadBuffer(
      sourceBuffer,
      `logos/${restaurantId}/${platform}/override.svg`,
      file.type
    )
  } else {
    const processedBuf = platform === "apple"
      ? await processLogoForApple(sourceBuffer)
      : await processLogoForGoogle(sourceBuffer)
    processedUrl = await uploadBuffer(
      processedBuf,
      `logos/${restaurantId}/${platform}/override.png`,
      "image/png"
    )
  }

  await db.restaurant.update({
    where: { id: restaurantId },
    data: { [column]: processedUrl },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/programs")
  return { success: true, url: processedUrl }
}

// ─── Reset Platform Logo to Auto-Generated ──────────────────
// Removes the manual override and re-generates from the source logo

export async function resetPlatformLogo(restaurantId: string, platform: "apple" | "google") {
  await assertRestaurantRole(restaurantId, "owner")

  const column = platform === "apple" ? "logoApple" : "logoGoogle"

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { logo: true, logoApple: true, logoGoogle: true },
  })

  if (!restaurant?.logo) {
    return { error: "No source logo to regenerate from" }
  }

  // Delete old platform logo
  const oldUrl = platform === "apple" ? restaurant.logoApple : restaurant.logoGoogle
  await deleteBlob(oldUrl)

  // Re-generate from source
  const sourceLogo = restaurant.logo
  let newUrl: string
  if (sourceLogo.startsWith("data:image/svg")) {
    newUrl = sourceLogo
  } else {
    // Fetch source buffer
    let sourceBuffer: Buffer
    if (sourceLogo.startsWith("data:")) {
      const base64 = sourceLogo.split(",")[1]
      sourceBuffer = Buffer.from(base64, "base64")
    } else {
      const res = await fetch(sourceLogo)
      if (!res.ok) return { error: "Failed to fetch source logo" }
      sourceBuffer = Buffer.from(await res.arrayBuffer())
    }

    const processedBuf = platform === "apple"
      ? await processLogoForApple(sourceBuffer)
      : await processLogoForGoogle(sourceBuffer)
    newUrl = await uploadBuffer(
      processedBuf,
      `logos/${restaurantId}/${platform}/auto.png`,
      "image/png"
    )
  }

  await db.restaurant.update({
    where: { id: restaurantId },
    data: { [column]: newUrl },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/programs")
  return { success: true, url: newUrl }
}

// ─── Extract Palette from Logo URL ───────────────────────────

export async function extractPaletteFromLogoUrl(restaurantId: string) {
  await assertRestaurantRole(restaurantId, "owner")

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { logo: true },
  })

  if (!restaurant?.logo) {
    return { error: "No logo uploaded" }
  }

  try {
    const { extractPaletteFromBuffer } = await import("@/lib/color-extraction")

    let sourceBuffer: Buffer
    if (restaurant.logo.startsWith("data:")) {
      const base64 = restaurant.logo.split(",")[1]
      sourceBuffer = Buffer.from(base64, "base64")
    } else {
      const res = await fetch(restaurant.logo)
      if (!res.ok) return { error: "Failed to fetch logo" }
      sourceBuffer = Buffer.from(await res.arrayBuffer())
    }

    const palette = await extractPaletteFromBuffer(sourceBuffer)
    return { success: true, palette }
  } catch {
    return { error: "Failed to extract colors" }
  }
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

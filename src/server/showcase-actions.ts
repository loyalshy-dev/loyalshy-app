"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertSuperAdmin } from "@/lib/dal"
import { computeTextColor } from "@/lib/wallet/card-design"
import type { PatternStyle } from "@/lib/wallet/card-design"

// ─── Schemas ─────────────────────────────────────────────────

const MAX_SHOWCASE_CARDS = 5

const metadataSchema = z.object({
  organizationName: z.string().min(1).max(100),
  customerName: z.string().min(1).max(100),
  memberSince: z.string().min(1).max(50),
  // Stamp/Points fields
  currentVisits: z.number().int().min(0).max(100).optional().default(5),
  totalVisits: z.number().int().min(1).max(100).optional().default(10),
  rewardDescription: z.string().max(200).optional().default(""),
  // Coupon fields
  discountText: z.string().max(100).optional().default(""),
  couponCode: z.string().max(50).optional().default(""),
  validUntil: z.string().max(50).optional().default(""),
  // Membership fields
  tierName: z.string().max(100).optional().default(""),
  benefits: z.string().max(200).optional().default(""),
})

export type ShowcaseMetadata = z.infer<typeof metadataSchema>

const saveDesignSchema = z.object({
  id: z.string().min(1),
  cardType: z.enum(["STAMP", "POINTS", "TIER", "COUPON", "PREPAID", "GIFT_CARD", "TICKET", "ACCESS", "TRANSIT", "BUSINESS_ID", "GENERIC"]).optional().default("STAMP"),
  showStrip: z.boolean(),
  primaryColor: z.string().max(20).optional().default(""),
  secondaryColor: z.string().max(20).optional().default(""),
  textColor: z.string().max(20).optional().default(""),
  autoTextColor: z.boolean().optional().default(false),
  patternStyle: z.enum(["NONE", "DOTS", "WAVES", "GEOMETRIC", "CHEVRON", "CROSSHATCH", "DIAMONDS", "CONFETTI", "SOLID_PRIMARY", "SOLID_SECONDARY", "STAMP_GRID"]),
  progressStyle: z.enum(["NUMBERS", "CIRCLES", "SQUARES", "STARS", "STAMPS", "PERCENTAGE", "REMAINING"]).optional().default("NUMBERS"),
  labelFormat: z.enum(["UPPERCASE", "TITLE_CASE", "LOWERCASE"]).optional().default("UPPERCASE"),
  customProgressLabel: z.string().max(30).optional().default(""),
  palettePreset: z.string().max(30).nullable().optional(),
  templateId: z.string().max(50).nullable().optional(),
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

// ─── Public: Get showcase cards for landing page ─────────────

export async function getPublicShowcaseCards() {
  const cards = await db.showcaseCard.findMany({
    orderBy: { sortOrder: "asc" },
  })
  return cards
}

// ─── Admin: Get all showcase cards ───────────────────────────

export async function getShowcaseCards() {
  await assertSuperAdmin()
  const cards = await db.showcaseCard.findMany({
    orderBy: { sortOrder: "asc" },
  })
  return cards
}

// ─── Admin: Create showcase card ─────────────────────────────

const CARD_TYPE_MAP: Record<string, string> = {
  STAMP_CARD: "STAMP", COUPON: "COUPON", MEMBERSHIP: "TIER",
  POINTS: "POINTS", PREPAID: "PREPAID", GIFT_CARD: "GIFT_CARD",
  TICKET: "TICKET", ACCESS: "ACCESS", TRANSIT: "TRANSIT",
  BUSINESS_ID: "BUSINESS_ID",
}

export async function createShowcaseCard(
  rawMetadata: ShowcaseMetadata,
  programType: string = "STAMP_CARD",
) {
  await assertSuperAdmin()

  const metadata = metadataSchema.parse(rawMetadata)

  const count = await db.showcaseCard.count()
  if (count >= MAX_SHOWCASE_CARDS) {
    return { error: `Maximum of ${MAX_SHOWCASE_CARDS} showcase cards allowed` }
  }

  const cardType = CARD_TYPE_MAP[programType] ?? "STAMP"

  const defaultDesign = {
    cardType,
    showStrip: true,
    primaryColor: cardType === "COUPON" ? "#7c3aed" : cardType === "TIER" ? "#b45309" : "#1a1a2e",
    secondaryColor: "#ffffff",
    textColor: "#ffffff",
    patternStyle: "NONE",
    progressStyle: "NUMBERS",
    labelFormat: "UPPERCASE",
  }

  const card = await db.showcaseCard.create({
    data: {
      designData: defaultDesign,
      metadata,
      sortOrder: count,
    },
  })

  revalidatePath("/admin/showcase")
  return { success: true, card }
}

// ─── Admin: Update showcase card metadata ────────────────────

export async function updateShowcaseCardMetadata(id: string, rawMetadata: ShowcaseMetadata) {
  await assertSuperAdmin()

  const metadata = metadataSchema.parse(rawMetadata)

  await db.showcaseCard.update({
    where: { id },
    data: { metadata },
  })

  revalidatePath("/admin/showcase")
  revalidatePath("/")
  return { success: true }
}

// ─── Admin: Delete showcase card ─────────────────────────────

export async function deleteShowcaseCard(id: string) {
  await assertSuperAdmin()

  // Delete strip images if any
  const card = await db.showcaseCard.findUnique({ where: { id } })
  if (!card) return { error: "Card not found" }

  const designData = card.designData as Record<string, unknown>
  if (designData.stripImageUrl && typeof designData.stripImageUrl === "string") {
    try {
      const { deleteFiles } = await import("@/lib/storage")
      await deleteFiles([
        designData.stripImageUrl as string,
        designData.stripImageApple as string | undefined,
        designData.stripImageGoogle as string | undefined,
        designData.generatedStripApple as string | undefined,
        designData.generatedStripGoogle as string | undefined,
      ])
    } catch {
      // Storage cleanup failure is non-fatal
    }
  }

  await db.showcaseCard.delete({ where: { id } })

  // Re-compact sort order
  const remaining = await db.showcaseCard.findMany({ orderBy: { sortOrder: "asc" } })
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].sortOrder !== i) {
      await db.showcaseCard.update({ where: { id: remaining[i].id }, data: { sortOrder: i } })
    }
  }

  revalidatePath("/admin/showcase")
  revalidatePath("/")
  return { success: true }
}

// ─── Admin: Reorder showcase cards ───────────────────────────

export async function reorderShowcaseCards(orderedIds: string[]) {
  await assertSuperAdmin()

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.showcaseCard.update({ where: { id }, data: { sortOrder: index } })
    )
  )

  revalidatePath("/admin/showcase")
  revalidatePath("/")
  return { success: true }
}

// ─── Admin: Save showcase card design ────────────────────────

export async function saveShowcaseCardDesign(input: z.infer<typeof saveDesignSchema>) {
  await assertSuperAdmin()

  let parsed: z.infer<typeof saveDesignSchema>
  try {
    parsed = saveDesignSchema.parse(input)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: `Validation failed: ${err.issues.map((e: { message: string }) => e.message).join(", ")}` }
    }
    return { error: "Invalid design data" }
  }

  const card = await db.showcaseCard.findUnique({ where: { id: parsed.id } })
  if (!card) return { error: "Showcase card not found" }

  const primaryColor = parsed.primaryColor || null
  const secondaryColor = parsed.secondaryColor || null
  const textColor = parsed.autoTextColor && primaryColor
    ? computeTextColor(primaryColor)
    : (parsed.textColor || null)

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
  if (parsed.stripImageZoom && parsed.stripImageZoom !== 1) {
    editorConfig.stripImageZoom = parsed.stripImageZoom
  }

  // Generate pattern-based strip images
  let generatedStripApple: string | null = null
  let generatedStripGoogle: string | null = null
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
        uploadFile(appleBuffer, `strip-images/showcase/${parsed.id}/generated-apple-${Date.now()}.png`, "image/png"),
        uploadFile(googleBuffer, `strip-images/showcase/${parsed.id}/generated-google-${Date.now()}.png`, "image/png"),
      ])

      generatedStripApple = appleUrl
      generatedStripGoogle = googleUrl
    } catch {
      // R2 not configured — skip
    }
  }

  // Delete old generated strips
  const existingDesign = card.designData as Record<string, unknown>
  if (generatedStripApple && existingDesign.generatedStripApple) {
    try {
      const { deleteFiles } = await import("@/lib/storage")
      await deleteFiles([existingDesign.generatedStripApple as string, existingDesign.generatedStripGoogle as string])
    } catch {
      // Non-fatal
    }
  }

  // Re-crop strip image when position/zoom changed
  let reCroppedApple: string | null = null
  let reCroppedGoogle: string | null = null
  const newPos = parsed.stripImagePosition ?? { x: 0.5, y: 0.5 }
  const newZoom = parsed.stripImageZoom ?? 1
  const existingStripUrl = existingDesign.stripImageUrl as string | null
  if (existingStripUrl && !existingStripUrl.startsWith("data:")) {
    const oldEditorConfig = (existingDesign.editorConfig as Record<string, unknown>) ?? {}
    const oldPos = (oldEditorConfig.stripImagePosition as { x: number; y: number } | undefined) ?? { x: 0.5, y: 0.5 }
    const oldZoom = (oldEditorConfig.stripImageZoom as number | undefined) ?? 1
    const posChanged = Math.abs(newPos.x - oldPos.x) > 0.001 || Math.abs(newPos.y - oldPos.y) > 0.001
    const zoomChanged = Math.abs(newZoom - oldZoom) > 0.001

    if (posChanged || zoomChanged) {
      try {
        const { cropStripImageWithPosition, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } =
          await import("@/lib/wallet/strip-image")
        const { uploadFile, deleteFiles } = await import("@/lib/storage")

        const imgRes = await fetch(existingStripUrl)
        if (imgRes.ok) {
          const originalBuffer = Buffer.from(await imgRes.arrayBuffer())
          const [appleBuffer, googleBuffer] = await Promise.all([
            cropStripImageWithPosition(originalBuffer, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, newPos, newZoom),
            cropStripImageWithPosition(originalBuffer, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT, newPos, newZoom),
          ])
          const [appleUrl, googleUrl] = await Promise.all([
            uploadFile(appleBuffer, `strip-images/showcase/${parsed.id}/apple-${Date.now()}.png`, "image/png"),
            uploadFile(googleBuffer, `strip-images/showcase/${parsed.id}/google-${Date.now()}.png`, "image/png"),
          ])
          reCroppedApple = appleUrl
          reCroppedGoogle = googleUrl

          await deleteFiles([existingDesign.stripImageApple as string, existingDesign.stripImageGoogle as string])
        }
      } catch {
        // Non-fatal
      }
    }
  }

  const isStampGrid = parsed.useStampGrid

  const designData: Record<string, unknown> = {
    cardType: parsed.cardType,
    showStrip: parsed.showStrip,
    primaryColor,
    secondaryColor,
    textColor,
    patternStyle: parsed.patternStyle,
    progressStyle: parsed.progressStyle,
    labelFormat: parsed.labelFormat,
    customProgressLabel: parsed.customProgressLabel || null,
    palettePreset: parsed.palettePreset ?? null,
    templateId: parsed.templateId ?? null,
    stripImageUrl: existingStripUrl ?? null,
    stripImageApple: reCroppedApple ?? (existingDesign.stripImageApple as string | null) ?? null,
    stripImageGoogle: reCroppedGoogle ?? (existingDesign.stripImageGoogle as string | null) ?? null,
    generatedStripApple: isStampGrid ? null : (generatedStripApple ?? (existingDesign.generatedStripApple as string | null) ?? null),
    generatedStripGoogle: isStampGrid ? null : (generatedStripGoogle ?? (existingDesign.generatedStripGoogle as string | null) ?? null),
    editorConfig,
  }

  await db.showcaseCard.update({
    where: { id: parsed.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { designData: designData as any },
  })

  revalidatePath("/admin/showcase")
  revalidatePath("/")
  return { success: true }
}

// ─── Admin: Upload strip image for showcase card ─────────────

export async function uploadShowcaseStripImage(formData: FormData) {
  await assertSuperAdmin()

  const id = formData.get("showcaseCardId") as string
  const file = formData.get("file") as File

  if (!id || !file) return { error: "Missing required fields" }

  if (file.size > 5 * 1024 * 1024) return { error: "File too large (max 5MB)" }

  const validTypes = ["image/png", "image/jpeg", "image/webp"]
  if (!validTypes.includes(file.type)) return { error: "Invalid file type" }

  const card = await db.showcaseCard.findUnique({ where: { id } })
  if (!card) return { error: "Showcase card not found" }

  try {
    const { cropStripImageWithPosition, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } =
      await import("@/lib/wallet/strip-image")
    const { uploadFile } = await import("@/lib/storage")

    const buffer = Buffer.from(await file.arrayBuffer())
    const designData = card.designData as Record<string, unknown>
    const editorCfg = (designData.editorConfig as Record<string, unknown>) ?? {}
    const pos = (editorCfg.stripImagePosition as { x: number; y: number }) ?? { x: 0.5, y: 0.5 }
    const zoom = (editorCfg.stripImageZoom as number) ?? 1

    const [appleBuffer, googleBuffer] = await Promise.all([
      cropStripImageWithPosition(buffer, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, pos, zoom),
      cropStripImageWithPosition(buffer, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT, pos, zoom),
    ])

    const ts = Date.now()
    const [originalUrl, appleUrl, googleUrl] = await Promise.all([
      uploadFile(buffer, `strip-images/showcase/${id}/original-${ts}.png`, "image/png"),
      uploadFile(appleBuffer, `strip-images/showcase/${id}/apple-${ts}.png`, "image/png"),
      uploadFile(googleBuffer, `strip-images/showcase/${id}/google-${ts}.png`, "image/png"),
    ])

    const newDesignData = {
      ...designData,
      stripImageUrl: originalUrl,
      stripImageApple: appleUrl,
      stripImageGoogle: googleUrl,
    }

    await db.showcaseCard.update({
      where: { id },
      data: { designData: newDesignData },
    })

    revalidatePath("/admin/showcase")
    return { success: true, originalUrl, appleUrl, googleUrl }
  } catch {
    return { error: "Failed to upload strip image" }
  }
}

// ─── Admin: Delete strip image for showcase card ─────────────

export async function deleteShowcaseStripImage(id: string) {
  await assertSuperAdmin()

  const card = await db.showcaseCard.findUnique({ where: { id } })
  if (!card) return { error: "Showcase card not found" }

  const designData = card.designData as Record<string, unknown>

  try {
    const { deleteFiles } = await import("@/lib/storage")
    await deleteFiles([
      designData.stripImageUrl as string | undefined,
      designData.stripImageApple as string | undefined,
      designData.stripImageGoogle as string | undefined,
    ])
  } catch {
    // Non-fatal
  }

  const newDesignData = {
    ...designData,
    stripImageUrl: null,
    stripImageApple: null,
    stripImageGoogle: null,
  }

  await db.showcaseCard.update({
    where: { id },
    data: { designData: newDesignData },
  })

  revalidatePath("/admin/showcase")
  return { success: true }
}

// ─── Admin: Upload stamp icon for showcase card ──────────────

export async function uploadShowcaseStampIcon(formData: FormData) {
  await assertSuperAdmin()

  const id = formData.get("showcaseCardId") as string
  const file = formData.get("file") as File

  if (!id || !file) return { error: "Missing required fields" }

  if (file.size > 2 * 1024 * 1024) return { error: "File too large (max 2MB)" }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) return { error: "Invalid file type" }

  const card = await db.showcaseCard.findUnique({ where: { id } })
  if (!card) return { error: "Showcase card not found" }

  try {
    const { uploadFile } = await import("@/lib/storage")
    const buffer = Buffer.from(await file.arrayBuffer())

    const url = await uploadFile(buffer, `stamp-icons/showcase/${id}/${Date.now()}.png`, file.type)

    return { success: true, url }
  } catch {
    return { error: "Failed to upload stamp icon" }
  }
}

// ─── Admin: Delete stamp icon for showcase card ──────────────

export async function deleteShowcaseStampIcon(id: string) {
  await assertSuperAdmin()

  const card = await db.showcaseCard.findUnique({ where: { id } })
  if (!card) return { error: "Showcase card not found" }

  const designData = card.designData as Record<string, unknown>
  const editorConfig = (designData.editorConfig as Record<string, unknown>) ?? {}
  const stampGridConfig = (editorConfig.stampGridConfig as Record<string, unknown>) ?? {}
  const iconUrl = stampGridConfig.customStampIconUrl as string | null | undefined

  if (iconUrl) {
    try {
      const { deleteFile } = await import("@/lib/storage")
      await deleteFile(iconUrl)
    } catch {
      // Storage cleanup failure is non-fatal
    }
  }

  return { success: true }
}

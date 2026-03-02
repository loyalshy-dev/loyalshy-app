import "server-only"

import { PKPass } from "passkit-generator"
import { getAppleCertificates } from "./certificates"
import { getPassColors } from "./colors"
import { getIconBuffers } from "./icons"
import {
  PASS_TYPE_IDENTIFIER,
  TEAM_IDENTIFIER,
  ORGANIZATION_NAME,
  WEB_SERVICE_BASE_URL,
} from "./constants"
import type { CardDesignData, CardShape } from "../card-design"
import { getFieldLayout, formatProgressValue, formatLabel, parseStampGridConfig, parseStripFilters } from "../card-design"

// ─── Types ──────────────────────────────────────────────────

export type PassGenerationInput = {
  serialNumber: string
  authenticationToken: string
  customerName: string
  customerEmail: string | null
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  memberSince: Date
  hasAvailableReward: boolean
  restaurantName: string
  restaurantLogo: string | null
  restaurantLogoApple: string | null
  brandColor: string | null
  secondaryColor: string | null
  rewardDescription: string
  rewardExpiryDays: number
  termsAndConditions: string | null
  restaurantPhone: string | null
  restaurantWebsite: string | null
  // Program name for multi-program display
  programName?: string
  // Card design fields
  cardDesign?: CardDesignData | null
}

// ─── Generate Pass ──────────────────────────────────────────

export async function generateApplePass(
  input: PassGenerationInput
): Promise<Buffer> {
  const certs = getAppleCertificates()

  const design = input.cardDesign
  const shape: CardShape = design?.shape ?? "CLEAN"
  const textColor = design?.textColor ?? null
  const layout = getFieldLayout(shape)

  // Determine strip image: dynamic stamp grid or static URL
  let stripImageUrl: string | null = null
  let stampGridStripBuffer: Buffer | null = null

  const stripFilters = design ? parseStripFilters(design.editorConfig) : { stripOpacity: 1, stripGrayscale: false, useStampGrid: false, stripColor1: null, stripColor2: null }
  // Stamp grid: check editorConfig flag or legacy patternStyle column
  const isStampGrid = stripFilters.useStampGrid || design?.patternStyle === "STAMP_GRID"

  // Effective strip colors (independent from card background)
  const stripPrimary = stripFilters.stripColor1 ?? design?.primaryColor ?? input.brandColor ?? "#1a1a2e"
  const stripSecondary = stripFilters.stripColor2 ?? design?.secondaryColor ?? input.secondaryColor ?? "#ffffff"

  if (layout.apple.useStrip && isStampGrid && design) {
    // Generate stamp grid strip image dynamically for this enrollment
    const { generateStampGridImage, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT } = await import("../strip-image")
    const stampGridConfig = parseStampGridConfig(design.editorConfig)
    stampGridStripBuffer = await generateStampGridImage({
      currentVisits: input.currentCycleVisits,
      totalVisits: input.visitsRequired,
      hasReward: input.hasAvailableReward,
      config: stampGridConfig,
      primaryColor: stripPrimary,
      secondaryColor: stripSecondary,
      textColor: design.textColor,
      width: APPLE_STRIP_WIDTH,
      height: APPLE_STRIP_HEIGHT,
      stripImageUrl: design.stripImageApple,
      stripOpacity: stripFilters.stripOpacity,
      stripGrayscale: stripFilters.stripGrayscale,
    })
  } else if (layout.apple.useStrip) {
    const rawUrl = design?.stripImageApple ?? design?.generatedStripApple ?? null
    // Apply filters to static strip images if needed
    if (rawUrl && (stripFilters.stripOpacity < 1 || stripFilters.stripGrayscale)) {
      const { default: sharp } = await import("sharp")
      const { APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT } = await import("../strip-image")
      const res = await fetch(rawUrl)
      if (res.ok) {
        let pipeline = sharp(Buffer.from(await res.arrayBuffer()))
          .resize(APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, { fit: "cover", position: "centre" })
        if (stripFilters.stripGrayscale) pipeline = pipeline.greyscale()
        if (stripFilters.stripOpacity < 1) {
          // Reduce alpha then flatten onto primary color background
          const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
          for (let i = 3; i < data.length; i += 4) {
            data[i] = Math.round(data[i] * stripFilters.stripOpacity)
          }
          const transparentStrip = await sharp(data, {
            raw: { width: info.width, height: info.height, channels: 4 },
          }).png().toBuffer()
          const bgColor = stripPrimary
          const bg = await sharp({ create: { width: APPLE_STRIP_WIDTH, height: APPLE_STRIP_HEIGHT, channels: 4, background: bgColor } }).png().toBuffer()
          stampGridStripBuffer = await sharp(bg)
            .composite([{ input: transparentStrip }])
            .png()
            .toBuffer()
        } else {
          stampGridStripBuffer = await pipeline.png().toBuffer()
        }
      } else {
        stripImageUrl = rawUrl
      }
    } else {
      stripImageUrl = rawUrl
    }
  }

  const icons = await getIconBuffers(input.restaurantLogoApple ?? input.restaurantLogo, stripImageUrl)

  // If we have a dynamically generated stamp grid buffer, inject it directly
  if (stampGridStripBuffer) {
    icons["strip.png"] = stampGridStripBuffer
    icons["strip@2x.png"] = stampGridStripBuffer
    icons["strip@3x.png"] = stampGridStripBuffer
  }
  const colors = getPassColors(
    design?.primaryColor ?? input.brandColor,
    design?.secondaryColor ?? input.secondaryColor,
    textColor
  )

  // Use program name in description if provided
  const passDescription = input.programName
    ? `${input.programName} Loyalty Card`
    : `${input.restaurantName} Loyalty Card`

  const pass = new PKPass(icons, certs, {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_IDENTIFIER,
    teamIdentifier: TEAM_IDENTIFIER,
    organizationName: ORGANIZATION_NAME,
    serialNumber: input.serialNumber,
    description: passDescription,
    authenticationToken: input.authenticationToken,
    webServiceURL: `${WEB_SERVICE_BASE_URL}/api/wallet/apple`,
    backgroundColor: colors.backgroundColor,
    foregroundColor: colors.foregroundColor,
    labelColor: colors.labelColor,
    logoText: input.restaurantName,
    sharingProhibited: true,
  })

  // Use storeCard for loyalty cards (supports strip images)
  pass.type = "storeCard"

  // Apple Watch notes:
  // - Strip images are NOT displayed on Apple Watch — only back fields and text fields render.
  // - Back fields are accessible via the (i) button on Watch.
  // - Keep important info in text fields (primary/secondary/auxiliary), not just the strip.

  // ── Barcode: QR code encoding the walletPassId (auth token) ──
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: input.authenticationToken,
    messageEncoding: "iso-8859-1",
  })

  // ── Build fields based on shape layout ──
  const progressStyle = design?.progressStyle ?? "NUMBERS"
  const labelFmt = design?.labelFormat ?? "UPPERCASE"
  const progressValue = formatProgressValue(
    input.currentCycleVisits,
    input.visitsRequired,
    progressStyle,
    input.hasAvailableReward
  )

  const progressLabel = design?.customProgressLabel
    ? design.customProgressLabel
    : input.hasAvailableReward ? "STATUS" : "PROGRESS"

  const memberSinceFormatted = input.memberSince.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })

  // Field data map — all labels go through formatLabel
  const fieldData: Record<string, { key: string; label: string; value: string }> = {
    restaurant: { key: "restaurant", label: formatLabel("RESTAURANT", labelFmt), value: input.restaurantName },
    memberNumber: { key: "memberNumber", label: formatLabel("MEMBER", labelFmt), value: `#${input.totalVisits}` },
    progress: { key: "progress", label: formatLabel(progressLabel, labelFmt), value: progressValue },
    nextReward: { key: "nextReward", label: formatLabel("NEXT REWARD", labelFmt), value: input.rewardDescription },
    totalVisits: { key: "totalVisits", label: formatLabel("TOTAL VISITS", labelFmt), value: `${input.totalVisits}` },
    memberSince: { key: "memberSince", label: formatLabel("MEMBER SINCE", labelFmt), value: memberSinceFormatted },
    customerName: { key: "customerName", label: formatLabel("NAME", labelFmt), value: input.customerName },
  }

  // Populate header fields
  for (const fieldId of layout.apple.header) {
    const f = fieldData[fieldId]
    if (f) pass.headerFields.push(f)
  }

  // Populate primary fields
  for (const fieldId of layout.apple.primary) {
    const f = fieldData[fieldId]
    if (f) pass.primaryFields.push(f)
  }

  // Populate secondary fields
  for (const fieldId of layout.apple.secondary) {
    const f = fieldData[fieldId]
    if (f) pass.secondaryFields.push(f)
  }

  // Populate auxiliary fields
  for (const fieldId of layout.apple.auxiliary) {
    const f = fieldData[fieldId]
    if (f) pass.auxiliaryFields.push(f)
  }

  // ── Back fields: Program info, T&C, contact, card design extras ──

  // If programName is provided, add a "Program" back field
  if (input.programName) {
    pass.backFields.push({
      key: "program",
      label: "Program",
      value: input.programName,
    })
  }

  pass.backFields.push(
    {
      key: "programInfo",
      label: "Loyalty Program",
      value: `Earn a reward after every ${input.visitsRequired} visits! Your reward: ${input.rewardDescription}. Rewards expire ${input.rewardExpiryDays} days after being earned.`,
    },
    {
      key: "currentProgress",
      label: "Current Progress",
      value: `${input.currentCycleVisits} of ${input.visitsRequired} visits completed this cycle. ${input.totalVisits} total visits.`,
    }
  )

  if (input.termsAndConditions) {
    pass.backFields.push({
      key: "terms",
      label: "Terms & Conditions",
      value: input.termsAndConditions,
    })
  }

  // Always include contact info — Apple HIG requires a way to reach the business
  {
    const contactParts: string[] = []
    if (input.restaurantPhone) contactParts.push(input.restaurantPhone)
    if (input.restaurantWebsite) contactParts.push(input.restaurantWebsite)
    if (contactParts.length === 0) {
      contactParts.push(input.restaurantName)
      contactParts.push("https://loyalshy.com")
    }
    pass.backFields.push({
      key: "contact",
      label: "Contact",
      value: contactParts.join("\n"),
    })
  }

  // Card design back-of-pass content
  if (design?.businessHours) {
    pass.backFields.push({
      key: "businessHours",
      label: "Business Hours",
      value: design.businessHours,
    })
  }

  if (design?.mapAddress) {
    pass.backFields.push({
      key: "mapAddress",
      label: "Address",
      value: design.mapAddress,
    })
  }

  if (design?.customMessage) {
    pass.backFields.push({
      key: "customMessage",
      label: "Message",
      value: design.customMessage,
    })
  }

  const socialParts: string[] = []
  if (design?.socialLinks.instagram) socialParts.push(`Instagram: ${design.socialLinks.instagram}`)
  if (design?.socialLinks.facebook) socialParts.push(`Facebook: ${design.socialLinks.facebook}`)
  if (design?.socialLinks.tiktok) socialParts.push(`TikTok: ${design.socialLinks.tiktok}`)
  if (design?.socialLinks.x) socialParts.push(`X: ${design.socialLinks.x}`)
  if (socialParts.length > 0) {
    pass.backFields.push({
      key: "socials",
      label: "Social Media",
      value: socialParts.join("\n"),
    })
  }

  pass.backFields.push({
    key: "poweredBy",
    label: "Powered By",
    value: "Loyalshy — Digital Loyalty Cards\nhttps://loyalshy.com",
  })

  // Location relevance — shows pass on lock screen when near the restaurant
  if (design?.mapLatitude != null && design?.mapLongitude != null) {
    pass.setLocations({
      latitude: design.mapLatitude,
      longitude: design.mapLongitude,
      relevantText: `You're near ${input.restaurantName}`,
    })
  }

  return pass.getAsBuffer()
}

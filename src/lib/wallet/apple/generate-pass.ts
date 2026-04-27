import "server-only"

import { PKPass } from "passkit-generator"
import { getAppleCertificates } from "./certificates"
import { getPassColors } from "./colors"
import { getIconBuffers } from "./icons"
import {
  PASS_TYPE_IDENTIFIER,
  TEAM_IDENTIFIER,
  WEB_SERVICE_BASE_URL,
} from "./constants"
import type { CardDesignData, CardType } from "../card-design"
import { formatProgressValue, formatLabel, parseStampGridConfig, parseStripFilters, getFieldConfig, splitFieldsForApple } from "../card-design"
import { parseCouponConfig, formatCouponValue } from "../../pass-config"

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
  organizationName: string
  organizationLogo: string | null
  organizationLogoApple: string | null
  organizationLogoGoogle: string | null
  brandColor: string | null
  secondaryColor: string | null
  rewardDescription: string
  rewardExpiryDays: number
  termsAndConditions: string | null
  organizationPhone: string | null
  organizationWebsite: string | null
  // Sequential member number (per organization)
  memberNumber?: number
  // Program name for multi-program display
  programName?: string
  // Card design fields
  cardDesign?: CardDesignData | null
  // Program type + config for type-specific pass content
  programType?: string
  programConfig?: unknown
  // Pass instance + org slug for generating card page links (prize reveal)
  passInstanceId?: string
  organizationSlug?: string
  // Whether there is an unrevealed prize to reveal
  hasUnrevealedPrize?: boolean
}

// ─── Generate Pass ──────────────────────────────────────────

export async function generateApplePass(
  input: PassGenerationInput
): Promise<Buffer> {
  const certs = getAppleCertificates()

  const design = input.cardDesign
  const showStrip = design?.showStrip ?? false
  const textColor = design?.textColor ?? null
  const cardType: CardType | undefined = design?.cardType as CardType | undefined

  // Determine strip image: dynamic stamp grid or static URL
  let stripImageUrl: string | null = null
  let stampGridStripBuffer: Buffer | null = null

  const stripFilters = design ? parseStripFilters(design.editorConfig) : parseStripFilters(null)
  // Stamp grid: check editorConfig flag or legacy patternStyle column
  const isStampGrid = stripFilters.useStampGrid || design?.patternStyle === "STAMP_GRID"

  // Effective strip colors (independent from card background)
  const stripPrimary = stripFilters.stripColor1 ?? design?.primaryColor ?? input.brandColor ?? "#1a1a2e"
  const stripSecondary = stripFilters.stripColor2 ?? design?.secondaryColor ?? input.secondaryColor ?? "#ffffff"

  const isStampType = cardType === "STAMP"
  if (showStrip && isStampGrid && design && isStampType) {
    // Generate stamp grid strip image dynamically for this enrollment
    const { generateStampGridImage, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT } = await import("../strip-image")
    const stampGridConfig = parseStampGridConfig(design.editorConfig)
    stampGridStripBuffer = await generateStampGridImage({
      currentVisits: input.currentCycleVisits,
      totalVisits: input.visitsRequired,
      hasReward: input.hasAvailableReward,
      config: stampGridConfig,
      primaryColor: stripPrimary,
      secondaryColor: stripFilters.stampFilledColor ?? stripSecondary,
      textColor: design.textColor,
      width: APPLE_STRIP_WIDTH,
      height: APPLE_STRIP_HEIGHT,
      stripImageUrl: design.stripImageApple,
      stripOpacity: stripFilters.stripOpacity,
      stripGrayscale: stripFilters.stripGrayscale,
      stripImagePosition: stripFilters.stripImagePosition,
      stripImageZoom: stripFilters.stripImageZoom,
    })
  } else if (showStrip && !isStampGrid && design && isStampType) {
    // Non-stamp-grid progress: bake progress text into strip image for consistent rendering
    const progressStyle = (design.progressStyle ?? "NUMBERS") as import("../card-design").ProgressStyle
    const { generateProgressStripImage, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT } = await import("../strip-image")
    const progressLabel = design.customProgressLabel
      ? design.customProgressLabel
      : input.hasAvailableReward ? "STATUS" : "PROGRESS"
    const labelFmt = (design.labelFormat ?? "UPPERCASE") as import("../card-design").LabelFormat
    const { formatLabel: fmtLabel } = await import("../card-design")
    const colors = getPassColors(
      design.primaryColor ?? input.brandColor,
      design.secondaryColor ?? input.secondaryColor,
      design.textColor,
      stripFilters.labelColor
    )
    stampGridStripBuffer = await generateProgressStripImage({
      currentVisits: input.currentCycleVisits,
      totalVisits: input.visitsRequired,
      hasReward: input.hasAvailableReward,
      progressStyle,
      progressLabel: fmtLabel(progressLabel, labelFmt),
      primaryColor: stripPrimary,
      secondaryColor: stripSecondary,
      textColor: colors.foregroundColor,
      labelColor: colors.labelColor,
      width: APPLE_STRIP_WIDTH,
      height: APPLE_STRIP_HEIGHT,
      stripImageUrl: design.stripImageApple,
      stripOpacity: stripFilters.stripOpacity,
      stripGrayscale: stripFilters.stripGrayscale,
      stripImagePosition: stripFilters.stripImagePosition,
      stripImageZoom: stripFilters.stripImageZoom,
    })
  } else if (showStrip) {
    const rawUrl = design?.stripImageApple ?? design?.generatedStripApple ?? null
    const hasPositionZoom = stripFilters.stripImageZoom !== 1 || stripFilters.stripImagePosition.x !== 0.5 || stripFilters.stripImagePosition.y !== 0.5
    // Apply filters/position/zoom to static strip images if needed
    if (rawUrl && (stripFilters.stripOpacity < 1 || stripFilters.stripGrayscale || hasPositionZoom)) {
      const { default: sharp } = await import("sharp")
      const { APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, resizeStripImage } = await import("../strip-image")
      const res = await fetch(rawUrl)
      if (res.ok) {
        const rawBuffer = Buffer.from(await res.arrayBuffer())
        let resized = await resizeStripImage(rawBuffer, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT, stripFilters.stripImagePosition, stripFilters.stripImageZoom)
        if (stripFilters.stripGrayscale) {
          resized = await sharp(resized).greyscale().png().toBuffer()
        }
        if (stripFilters.stripOpacity < 1) {
          // Reduce alpha then flatten onto primary color background
          const { data, info } = await sharp(resized).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
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
          stampGridStripBuffer = resized
        }
      } else {
        stripImageUrl = rawUrl
      }
    } else {
      stripImageUrl = rawUrl
    }
  }

  const icons = await getIconBuffers(
    input.organizationLogoApple ?? input.organizationLogo,
    stripImageUrl,
    stripFilters.logoAppleZoom,
    null,
    null,
  )

  // If we have a dynamically generated strip buffer, inject it directly
  if (stampGridStripBuffer) {
    icons["strip.png"] = stampGridStripBuffer
    icons["strip@2x.png"] = stampGridStripBuffer
    icons["strip@3x.png"] = stampGridStripBuffer
  }

  const colors = getPassColors(
    design?.primaryColor ?? input.brandColor,
    design?.secondaryColor ?? input.secondaryColor,
    textColor,
    stripFilters.labelColor
  )

  // Type-aware pass description
  const passDescription = (() => {
    const name = input.programName ?? input.organizationName
    return input.programType === "COUPON" ? `${name} Coupon` : `${name} Loyalty Card`
  })()

  const pass = new PKPass(icons, certs, {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_IDENTIFIER,
    teamIdentifier: TEAM_IDENTIFIER,
    organizationName: input.organizationName,
    serialNumber: input.serialNumber,
    description: passDescription,
    authenticationToken: input.authenticationToken,
    webServiceURL: `${WEB_SERVICE_BASE_URL}/api/wallet/apple`,
    backgroundColor: colors.backgroundColor,
    foregroundColor: colors.foregroundColor,
    labelColor: colors.labelColor,
    // logoText omitted — logo icon is sufficient, keeps header clean
    sharingProhibited: true,
  })

  // Apple Wallet pass type — STAMP_CARD and COUPON both use storeCard
  pass.type = "storeCard"

  // Apple Watch notes:
  // - Strip images are NOT displayed on Apple Watch — only back fields and text fields render.
  // - Back fields are accessible via the (i) button on Watch.
  // - Keep important info in text fields (primary/secondary/auxiliary), not just the strip.

  // ── Barcode: QR code (encodes the walletPassId/auth token for staff scanning) ──
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

  // Registration timestamps — short for header, full for back
  const pad = (n: number) => String(n).padStart(2, "0")
  const d = input.memberSince
  const registeredAtShort = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const registeredAtFull = `${registeredAtShort} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

  // Parse type-specific config for field data
  const couponConfig = input.programType === "COUPON" ? parseCouponConfig(input.programConfig) : null

  // Custom field labels from editorConfig
  const customLabels = stripFilters.fieldLabels ?? {}
  const lbl = (fieldId: string, defaultLabel: string) => {
    const custom = customLabels[fieldId]
    return formatLabel(custom ?? defaultLabel, labelFmt)
  }

  // Field data map — all labels go through formatLabel with custom label overrides
  const fieldData: Record<string, { key: string; label: string; value: string }> = {
    organization: { key: "organization", label: lbl("organization", "ORG"), value: input.organizationName },
    memberNumber: { key: "memberNumber", label: lbl("memberNumber", "MEMBER #"), value: `${input.memberNumber ?? "—"}` },
    progress: { key: "progress", label: lbl("progress", progressLabel), value: progressValue },
    nextReward: { key: "nextReward", label: lbl("nextReward", "NEXT REWARD"), value: input.rewardDescription },
    totalVisits: { key: "totalVisits", label: lbl("totalVisits", "TOTAL VISITS"), value: `${input.totalVisits}` },
    memberSince: { key: "memberSince", label: lbl("memberSince", "SINCE"), value: memberSinceFormatted },
    registeredAt: { key: "registeredAt", label: lbl("registeredAt", "REGISTERED"), value: registeredAtShort },
    customerName: { key: "customerName", label: lbl("customerName", "NAME"), value: input.customerName },
    // COUPON fields
    discount: couponConfig?.discountType === "freebie"
      ? { key: "discount", label: lbl("discount", "OFFER"), value: couponConfig.couponDescription || "Free item" }
      : { key: "discount", label: lbl("discount", "DISCOUNT"), value: couponConfig ? formatCouponValue(couponConfig) : input.rewardDescription },
    validUntil: { key: "validUntil", label: lbl("validUntil", "VALID UNTIL"), value: couponConfig?.validUntil ? new Date(couponConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
    couponCode: { key: "couponCode", label: lbl("couponCode", "CODE"), value: couponConfig?.couponCode ?? "" },
    // Generic fields
    title: { key: "title", label: lbl("title", "TITLE"), value: input.programName ?? "" },
    description: { key: "description", label: lbl("description", "DESCRIPTION"), value: input.rewardDescription },
    address: { key: "address", label: lbl("address", "ADDRESS"), value: design?.mapAddress ?? "" },
  }

  // User-configurable field layout for all pass types
  // Unified fields list auto-distributes: first 2 → header, rest → secondary
  // Falls back to legacy headerFields/secondaryFields, then per-type defaults
  const fieldConfig = getFieldConfig(input.programType ?? "STAMP_CARD")
  const unifiedFields = stripFilters.fields
    ?? (stripFilters.headerFields || stripFilters.secondaryFields
      ? [...(stripFilters.headerFields ?? fieldConfig.defaultHeader), ...(stripFilters.secondaryFields ?? fieldConfig.defaultSecondary)]
      : null)
    ?? fieldConfig.defaultFields
  const appleSplit = splitFieldsForApple(unifiedFields)
  // When showPrimaryField is on (and not stamp type), second field from the list becomes the primary overlay
  const useDynamicPrimary = showStrip && !isStampType && stripFilters.showPrimaryField && appleSplit.secondary.length > 0
  const appleLayout = {
    header: appleSplit.header,
    primary: isStampType
      ? []
      : useDynamicPrimary
        ? [appleSplit.secondary[0]]
        : [],
    secondary: useDynamicPrimary
      ? appleSplit.secondary.slice(1)
      : appleSplit.secondary,
    auxiliary: appleSplit.auxiliary,
  }

  // Populate header fields
  for (const fieldId of appleLayout.header) {
    const f = fieldData[fieldId]
    if (f) pass.headerFields.push(f)
  }

  // Populate primary fields
  for (const fieldId of appleLayout.primary) {
    const f = fieldData[fieldId]
    if (f) pass.primaryFields.push(f)
  }

  // Populate secondary fields
  for (const fieldId of appleLayout.secondary) {
    const f = fieldData[fieldId]
    if (f) pass.secondaryFields.push(f)
  }

  // Populate auxiliary fields
  for (const fieldId of appleLayout.auxiliary) {
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

  // Type-specific back fields
  if (input.programType === "COUPON" && couponConfig) {
    pass.backFields.push({
      key: "couponDetails",
      label: "Coupon Details",
      value: `${formatCouponValue(couponConfig)}${couponConfig.couponDescription ? ` — ${couponConfig.couponDescription}` : ""}`,
    })
    if (couponConfig.couponCode) {
      pass.backFields.push({
        key: "redemptionCode",
        label: "Redemption Code",
        value: couponConfig.couponCode,
      })
    }
    pass.backFields.push({
      key: "redemptionInstructions",
      label: "How to Redeem",
      value: "Show this pass to staff when placing your order. The coupon will be applied at checkout.",
    })
  } else {
    // STAMP_CARD (default)
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
      },
      {
        key: "memberNumber",
        label: "Member #",
        value: `${input.memberNumber ?? "—"}`,
      },
      {
        key: "memberSince",
        label: "Member Since",
        value: memberSinceFormatted,
      },
      {
        key: "registeredAt",
        label: "Registered",
        value: registeredAtFull,
      }
    )
  }

  // T&C from program or type-specific config
  const termsText = (input.programType === "COUPON" ? couponConfig?.terms : null) ?? input.termsAndConditions
  if (termsText) {
    pass.backFields.push({
      key: "terms",
      label: "Terms & Conditions",
      value: termsText,
    })
  }

  // Always include contact info — Apple HIG requires a way to reach the business
  {
    const contactParts: string[] = []
    if (input.organizationPhone) contactParts.push(input.organizationPhone)
    if (input.organizationWebsite) contactParts.push(input.organizationWebsite)
    if (contactParts.length === 0) {
      contactParts.push(input.organizationName)
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

  {
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
  }

  // Prize reveal link — shown when an unrevealed prize is pending
  if (input.hasUnrevealedPrize && input.passInstanceId && input.organizationSlug) {
    const { signCardAccess } = await import("../../card-access")
    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://www.loyalshy.com"
    const sig = signCardAccess(input.passInstanceId)
    const cardPageUrl = `${baseUrl}/join/${input.organizationSlug}/card/${input.passInstanceId}?sig=${sig}`
    pass.backFields.push({
      key: "revealLink",
      label: "Prize Ready!",
      value: `You have a prize waiting to be revealed! Tap here to play:\n${cardPageUrl}`,
    })
  }

  pass.backFields.push({
    key: "poweredBy",
    label: "Powered By",
    value: "Loyalshy — Digital Loyalty Cards\nhttps://loyalshy.com",
  })

  // Location relevance — shows pass on lock screen when near the organization
  if (design?.mapLatitude != null && design?.mapLongitude != null) {
    const relevantText = stripFilters.locationMessage || `You're near ${input.organizationName}`
    pass.setLocations({
      latitude: design.mapLatitude,
      longitude: design.mapLongitude,
      relevantText,
    })
  }

  return pass.getAsBuffer()
}

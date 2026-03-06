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
import type { CardDesignData, CardType } from "../card-design"
import { getFieldLayout, formatProgressValue, formatLabel, parseStampGridConfig, parseStripFilters } from "../card-design"
import { parseCouponConfig, formatCouponValue, parseMembershipConfig, parsePointsConfig, parsePrepaidConfig, getCheapestCatalogItem } from "../../program-config"

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
  // Program type + config for type-specific pass content
  programType?: string
  programConfig?: unknown
  // Points balance for POINTS program type
  pointsBalance?: number
  // Remaining uses for PREPAID program type
  remainingUses?: number
  // Enrollment + restaurant slug for generating card page links (prize reveal)
  enrollmentId?: string
  restaurantSlug?: string
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
  const layout = getFieldLayout(cardType)

  // Determine strip image: dynamic stamp grid or static URL
  let stripImageUrl: string | null = null
  let stampGridStripBuffer: Buffer | null = null

  const stripFilters = design ? parseStripFilters(design.editorConfig) : { stripOpacity: 1, stripGrayscale: false, useStampGrid: false, stripColor1: null, stripColor2: null }
  // Stamp grid: check editorConfig flag or legacy patternStyle column
  const isStampGrid = stripFilters.useStampGrid || design?.patternStyle === "STAMP_GRID"

  // Effective strip colors (independent from card background)
  const stripPrimary = stripFilters.stripColor1 ?? design?.primaryColor ?? input.brandColor ?? "#1a1a2e"
  const stripSecondary = stripFilters.stripColor2 ?? design?.secondaryColor ?? input.secondaryColor ?? "#ffffff"

  const isStampType = !cardType || cardType === "STAMP" || cardType === "POINTS"
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
      secondaryColor: stripSecondary,
      textColor: design.textColor,
      width: APPLE_STRIP_WIDTH,
      height: APPLE_STRIP_HEIGHT,
      stripImageUrl: design.stripImageApple,
      stripOpacity: stripFilters.stripOpacity,
      stripGrayscale: stripFilters.stripGrayscale,
    })
  } else if (showStrip) {
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

  // Type-aware pass description
  const passDescription = (() => {
    const name = input.programName ?? input.restaurantName
    if (input.programType === "COUPON") return `${name} Coupon`
    if (input.programType === "MEMBERSHIP") return `${name} Membership`
    if (input.programType === "POINTS") return `${name} Points Card`
    if (input.programType === "PREPAID") return `${name} Pass`
    return `${name} Loyalty Card`
  })()

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

  // Parse type-specific config for field data
  const couponConfig = input.programType === "COUPON" ? parseCouponConfig(input.programConfig) : null
  const membershipConfig = input.programType === "MEMBERSHIP" ? parseMembershipConfig(input.programConfig) : null
  const pointsConfig = input.programType === "POINTS" ? parsePointsConfig(input.programConfig) : null
  const prepaidConfig = input.programType === "PREPAID" ? parsePrepaidConfig(input.programConfig) : null
  const cheapestItem = pointsConfig ? getCheapestCatalogItem(pointsConfig) : null

  // Field data map — all labels go through formatLabel
  const fieldData: Record<string, { key: string; label: string; value: string }> = {
    restaurant: { key: "restaurant", label: formatLabel("RESTAURANT", labelFmt), value: input.restaurantName },
    memberNumber: { key: "memberNumber", label: formatLabel("MEMBER", labelFmt), value: `#${input.totalVisits}` },
    progress: { key: "progress", label: formatLabel(progressLabel, labelFmt), value: progressValue },
    nextReward: { key: "nextReward", label: formatLabel("NEXT REWARD", labelFmt), value: input.rewardDescription },
    totalVisits: { key: "totalVisits", label: formatLabel("TOTAL VISITS", labelFmt), value: `${input.totalVisits}` },
    memberSince: { key: "memberSince", label: formatLabel("MEMBER SINCE", labelFmt), value: memberSinceFormatted },
    customerName: { key: "customerName", label: formatLabel("NAME", labelFmt), value: input.customerName },
    // COUPON fields
    discount: { key: "discount", label: formatLabel("DISCOUNT", labelFmt), value: couponConfig ? formatCouponValue(couponConfig) : input.rewardDescription },
    validUntil: { key: "validUntil", label: formatLabel("VALID UNTIL", labelFmt), value: couponConfig?.validUntil ? new Date(couponConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
    couponCode: { key: "couponCode", label: formatLabel("CODE", labelFmt), value: couponConfig?.couponCode ?? "" },
    // TIER/MEMBERSHIP fields
    tierName: { key: "tierName", label: formatLabel("TIER", labelFmt), value: membershipConfig?.membershipTier ?? "" },
    benefits: { key: "benefits", label: formatLabel("BENEFITS", labelFmt), value: membershipConfig?.benefits ?? "" },
    // POINTS fields
    pointsBalance: { key: "pointsBalance", label: formatLabel("POINTS", labelFmt), value: String(input.pointsBalance ?? 0) },
    nextRewardPoints: { key: "nextRewardPoints", label: formatLabel("NEXT REWARD", labelFmt), value: cheapestItem ? `${cheapestItem.name} (${cheapestItem.pointsCost} pts)` : "" },
    earnRate: { key: "earnRate", label: formatLabel("EARN RATE", labelFmt), value: pointsConfig ? `${pointsConfig.pointsPerVisit} pts/visit` : "" },
    // PREPAID fields
    remaining: { key: "remaining", label: formatLabel("REMAINING", labelFmt), value: `${input.remainingUses ?? 0} / ${prepaidConfig?.totalUses ?? 0}` },
    prepaidValidUntil: { key: "prepaidValidUntil", label: formatLabel("VALID UNTIL", labelFmt), value: prepaidConfig?.validUntil ? new Date(prepaidConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
    totalUsed: { key: "totalUsed", label: formatLabel("TOTAL USED", labelFmt), value: String(input.totalVisits) },
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
  } else if (input.programType === "MEMBERSHIP" && membershipConfig) {
    pass.backFields.push({
      key: "membershipTier",
      label: "Membership Tier",
      value: membershipConfig.membershipTier,
    })
    if (membershipConfig.benefits) {
      pass.backFields.push({
        key: "membershipBenefits",
        label: "Benefits",
        value: membershipConfig.benefits,
      })
    }
    pass.backFields.push({
      key: "membershipTerms",
      label: "Membership",
      value: `Show this pass when visiting to check in. Your membership entitles you to the benefits listed above.`,
    })
  } else if (input.programType === "POINTS" && pointsConfig) {
    pass.backFields.push({
      key: "pointsBalance",
      label: "POINTS BALANCE",
      value: String(input.pointsBalance ?? 0),
    })
    pass.backFields.push({
      key: "earnRate",
      label: "EARN RATE",
      value: `${pointsConfig.pointsPerVisit} points per visit`,
    })
    const catalogText = pointsConfig.catalog.map(item => `${item.name}: ${item.pointsCost} pts`).join("\n")
    pass.backFields.push({
      key: "rewardCatalog",
      label: "REWARD CATALOG",
      value: catalogText,
    })
  } else if (input.programType === "PREPAID" && prepaidConfig) {
    pass.backFields.push({
      key: "prepaidDetails",
      label: "Pass Details",
      value: `${input.remainingUses ?? 0} of ${prepaidConfig.totalUses} ${prepaidConfig.useLabel}s remaining.${prepaidConfig.rechargeable ? " This pass can be recharged." : ""}`,
    })
    if (prepaidConfig.validUntil) {
      pass.backFields.push({
        key: "prepaidExpiry",
        label: "Valid Until",
        value: new Date(prepaidConfig.validUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      })
    }
    pass.backFields.push({
      key: "prepaidUsage",
      label: "How to Use",
      value: `Show this pass to staff each time you use a ${prepaidConfig.useLabel}. Your remaining balance will be updated automatically.`,
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
      }
    )
  }

  // T&C from program or type-specific config
  const termsText = (input.programType === "COUPON" ? couponConfig?.terms : input.programType === "MEMBERSHIP" ? membershipConfig?.terms : input.programType === "PREPAID" ? prepaidConfig?.terms : null) ?? input.termsAndConditions
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

  // Prize reveal link — shown when an unrevealed prize is pending
  if (input.hasUnrevealedPrize && input.enrollmentId && input.restaurantSlug) {
    const { signCardAccess } = await import("../../card-access")
    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
    const sig = signCardAccess(input.enrollmentId)
    const cardPageUrl = `${baseUrl}/join/${input.restaurantSlug}/card/${input.enrollmentId}?sig=${sig}`
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

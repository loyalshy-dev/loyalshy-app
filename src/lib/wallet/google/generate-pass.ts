import "server-only"

import { buildClassId, buildObjectId, buildProgramClassId, buildEnrollmentObjectId } from "./constants"
import { buildSaveUrl } from "./jwt-utils"
import type { CardDesignData, CardType } from "../card-design"
import { getFieldLayout, formatProgressValue, formatLabel, parseStripFilters, parseStampGridConfig } from "../card-design"
import { generateStampGridImage, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } from "../strip-image"
import { uploadFile } from "../../storage"
import { parseCouponConfig, formatCouponValue, parseMembershipConfig, parsePointsConfig, getCheapestCatalogItem, getWalletRewardText } from "../../program-config"

// ─── Types ──────────────────────────────────────────────────

export type GooglePassGenerationInput = {
  customerId: string
  restaurantId: string
  walletPassId: string
  customerName: string
  customerEmail: string | null
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  memberSince: Date
  hasAvailableReward: boolean
  restaurantName: string
  restaurantLogo: string | null
  restaurantLogoGoogle: string | null
  brandColor: string | null
  rewardDescription: string
  rewardExpiryDays: number
  termsAndConditions: string | null
  restaurantPhone: string | null
  restaurantWebsite: string | null
  // Multi-program fields
  programName?: string
  programId?: string
  enrollmentId?: string
  // Card design fields
  cardDesign?: CardDesignData | null
  // Program lifecycle
  programEndsAt?: Date | null
  // Program type + config for type-specific pass content
  programType?: string
  programConfig?: unknown
  pointsBalance?: number
  // Prize reveal
  hasUnrevealedPrize?: boolean
  restaurantSlug?: string
}

// ─── Helpers ────────────────────────────────────────────────

function ensureHexColor(color: string | null, fallback: string): string {
  if (!color) return fallback
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  return fallback
}

function normalizeSocialUrl(handle: string, platform: "instagram" | "facebook" | "tiktok" | "x"): string {
  if (handle.startsWith("http://") || handle.startsWith("https://")) return handle
  const cleaned = handle.replace(/^@/, "")
  const bases: Record<string, string> = {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/@",
    x: "https://x.com/",
  }
  return `${bases[platform]}${cleaned}`
}

// ─── Build Loyalty Class (one per program or restaurant) ─────────────

function buildLoyaltyClass(input: GooglePassGenerationInput) {
  // Use per-program class ID when programId is available, otherwise fall back to restaurant
  const classId = input.programId
    ? buildProgramClassId(input.programId)
    : buildClassId(input.restaurantId)
  const design = input.cardDesign
  const hexBg = ensureHexColor(design?.primaryColor ?? input.brandColor, "#1a1a2e")
  const cardType: CardType | undefined = design?.cardType as CardType | undefined
  const layout = getFieldLayout(cardType)
  const labelFmt = design?.labelFormat ?? "UPPERCASE"

  // Type-specific row field paths
  const isCoupon = input.programType === "COUPON"
  const isMembership = input.programType === "MEMBERSHIP"
  const isPoints = input.programType === "POINTS"

  // Build card row template — all types use textModulesData references
  const cardRowTemplateInfos: Record<string, unknown>[] = []

  if (isCoupon) {
    // Row 1: Discount + Valid Until
    cardRowTemplateInfos.push({
      twoItems: {
        startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['discount']" }] } },
        endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['validUntil']" }] } },
      },
    })
    // Row 2: Coupon code (if any) + Added date
    cardRowTemplateInfos.push({
      twoItems: {
        startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['couponCode']" }] } },
        endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['memberSince']" }] } },
      },
    })
  } else if (isMembership) {
    // Row 1: Tier + Check-ins
    cardRowTemplateInfos.push({
      twoItems: {
        startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['tier']" }] } },
        endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['checkIns']" }] } },
      },
    })
    // Row 2: Benefits + Member since
    cardRowTemplateInfos.push({
      twoItems: {
        startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['benefits']" }] } },
        endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['memberSince']" }] } },
      },
    })
  } else {
    // Stamp/Points: nextReward + memberSince
    const textRow1Start = isPoints ? "earnRate" : "nextReward"
    cardRowTemplateInfos.push({
      twoItems: {
        startItem: { firstValue: { fields: [{ fieldPath: `object.textModulesData['${textRow1Start}']` }] } },
        endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['memberSince']" }] } },
      },
    })
  }

  // Type-aware program display name
  const programDisplayName = (() => {
    const name = input.programName
    if (!name) return "Loyalty Card"
    if (isCoupon) return name
    if (isMembership) return `${name} Membership`
    if (isPoints) return `${name} Points`
    return `${name} Loyalty`
  })()

  // Prefer Google-specific logo, fall back to general
  const googleLogo = input.restaurantLogoGoogle ?? input.restaurantLogo

  const loyaltyClass: Record<string, unknown> = {
    id: classId,
    programName: programDisplayName,
    issuerName: input.restaurantName,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: hexBg,
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
    securityAnimation: { animationType: "FOIL_SHIMMER" },
  }

  // Program logo (required for Loyalty classes)
  const logoUrl = googleLogo ?? "https://developers.google.com/static/wallet/site-assets/images/pass-builder/pass_google_logo.jpg"
  loyaltyClass.programLogo = {
    sourceUri: { uri: logoUrl },
    contentDescription: {
      defaultValue: { language: "en", value: `${input.restaurantName} logo` },
    },
  }
  if (googleLogo) {
    loyaltyClass.wideProgramLogo = {
      sourceUri: { uri: googleLogo },
      contentDescription: {
        defaultValue: { language: "en", value: `${input.restaurantName} logo` },
      },
    }
  }

  // Card template override
  loyaltyClass.classTemplateInfo = {
    cardTemplateOverride: {
      cardRowTemplateInfos,
    },
  }

  // Homepage
  if (input.restaurantWebsite) {
    loyaltyClass.homepageUri = {
      uri: input.restaurantWebsite,
      description: input.restaurantName,
      id: "homepage",
    }
  }

  // Links module for restaurant contact + socials
  const linksUris: Record<string, unknown>[] = []
  if (input.restaurantWebsite) {
    linksUris.push({
      uri: input.restaurantWebsite,
      description: input.restaurantName,
      id: "website",
    })
  }
  if (input.restaurantPhone) {
    linksUris.push({
      uri: `tel:${input.restaurantPhone}`,
      description: input.restaurantPhone,
      id: "phone",
    })
  }

  // Social links from card design — normalize handles to full URLs
  if (design?.socialLinks.instagram) {
    linksUris.push({
      uri: normalizeSocialUrl(design.socialLinks.instagram, "instagram"),
      description: "Instagram",
      id: "instagram",
    })
  }
  if (design?.socialLinks.facebook) {
    linksUris.push({
      uri: normalizeSocialUrl(design.socialLinks.facebook, "facebook"),
      description: "Facebook",
      id: "facebook",
    })
  }
  if (design?.socialLinks.tiktok) {
    linksUris.push({
      uri: normalizeSocialUrl(design.socialLinks.tiktok, "tiktok"),
      description: "TikTok",
      id: "tiktok",
    })
  }
  if (design?.socialLinks.x) {
    linksUris.push({
      uri: normalizeSocialUrl(design.socialLinks.x, "x"),
      description: "X",
      id: "x",
    })
  }

  // Map address link
  if (design?.mapAddress) {
    linksUris.push({
      uri: `https://maps.google.com/?q=${encodeURIComponent(design.mapAddress)}`,
      description: design.mapAddress,
      id: "map",
    })
  }

  // Contact fallback — always include at least one link
  if (linksUris.length === 0) {
    linksUris.push({
      uri: `mailto:support@loyalshy.com`,
      description: "Contact Support",
      id: "contact",
    })
  }

  loyaltyClass.linksModuleData = { uris: linksUris }

  // Text modules replace deprecated infoModuleData
  const classTextModules: Record<string, unknown>[] = []
  if (design?.businessHours) {
    classTextModules.push({
      id: "businessHours",
      header: formatLabel("BUSINESS HOURS", labelFmt),
      body: design.businessHours,
    })
  }
  if (design?.customMessage) {
    classTextModules.push({
      id: "customMessage",
      header: formatLabel("MESSAGE", labelFmt),
      body: design.customMessage,
    })
  }
  if (input.termsAndConditions) {
    classTextModules.push({
      id: "terms",
      header: formatLabel("TERMS & CONDITIONS", labelFmt),
      body: input.termsAndConditions,
    })
  }
  if (classTextModules.length > 0) {
    loyaltyClass.textModulesData = classTextModules
  }

  // Merchant locations from coordinates
  if (design?.mapLatitude != null && design?.mapLongitude != null) {
    loyaltyClass.locations = [
      { latitude: design.mapLatitude, longitude: design.mapLongitude },
    ]
  }

  return loyaltyClass
}

// ─── Build Loyalty Object (one per enrollment or customer) ────────────

async function buildLoyaltyObject(input: GooglePassGenerationInput) {
  // Use enrollment-scoped object ID when enrollmentId is available, otherwise fall back to customer
  const objectId = input.enrollmentId
    ? buildEnrollmentObjectId(input.enrollmentId)
    : buildObjectId(input.customerId)
  // Use per-program class ID when programId is available
  const classId = input.programId
    ? buildProgramClassId(input.programId)
    : buildClassId(input.restaurantId)
  const design = input.cardDesign
  const cardType: CardType | undefined = design?.cardType as CardType | undefined

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

  // Parse type-specific config
  const couponConfig = input.programType === "COUPON" ? parseCouponConfig(input.programConfig) : null
  const membershipConfig = input.programType === "MEMBERSHIP" ? parseMembershipConfig(input.programConfig) : null
  const pointsConfig = input.programType === "POINTS" ? parsePointsConfig(input.programConfig) : null

  // Type-specific loyalty points and text modules
  let loyaltyPoints: Record<string, unknown>
  let secondaryLoyaltyPoints: Record<string, unknown>
  let textModulesData: Record<string, unknown>[]

  if (input.programType === "COUPON" && couponConfig) {
    // When minigame is enabled with prizes, show prizes instead of generic discount
    const prizeText = getWalletRewardText(input.programConfig, formatCouponValue(couponConfig))
    const hasPrizes = prizeText !== formatCouponValue(couponConfig)
    const discountLabel = hasPrizes ? "PRIZES" : "DISCOUNT"
    loyaltyPoints = {
      label: formatLabel(discountLabel, labelFmt),
      balance: { string: prizeText },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("VALID UNTIL", labelFmt),
      balance: { string: couponConfig.validUntil ? new Date(couponConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
    }
    textModulesData = [
      { id: "discount", header: formatLabel(discountLabel, labelFmt), body: prizeText },
      { id: "validUntil", header: formatLabel("VALID UNTIL", labelFmt), body: couponConfig.validUntil ? new Date(couponConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
      ...(couponConfig.couponCode ? [{ id: "couponCode", header: formatLabel("CODE", labelFmt), body: couponConfig.couponCode }] : []),
      { id: "memberSince", header: formatLabel("ADDED", labelFmt), body: memberSinceFormatted },
    ]
  } else if (input.programType === "MEMBERSHIP" && membershipConfig) {
    loyaltyPoints = {
      label: formatLabel("TIER", labelFmt),
      balance: { string: membershipConfig.membershipTier },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("CHECK-INS", labelFmt),
      balance: { int: input.totalVisits },
    }
    textModulesData = [
      { id: "tier", header: formatLabel("TIER", labelFmt), body: membershipConfig.membershipTier },
      { id: "checkIns", header: formatLabel("CHECK-INS", labelFmt), body: String(input.totalVisits) },
      { id: "benefits", header: formatLabel("BENEFITS", labelFmt), body: membershipConfig.benefits },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  } else if (input.programType === "POINTS" && pointsConfig) {
    loyaltyPoints = {
      label: formatLabel("POINTS", labelFmt),
      balance: { int: input.pointsBalance ?? 0 },
    }
    const cheapestItem = getCheapestCatalogItem(pointsConfig)
    secondaryLoyaltyPoints = cheapestItem
      ? { label: formatLabel("NEXT REWARD", labelFmt), balance: { string: `${cheapestItem.name} (${cheapestItem.pointsCost} pts)` } }
      : { label: formatLabel("TOTAL VISITS", labelFmt), balance: { int: input.totalVisits } }
    textModulesData = [
      { id: "earnRate", header: formatLabel("EARN RATE", labelFmt), body: `${pointsConfig.pointsPerVisit} points per visit` },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  } else {
    // STAMP_CARD (default)
    loyaltyPoints = {
      label: formatLabel(progressLabel, labelFmt),
      balance: { string: progressValue },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("TOTAL VISITS", labelFmt),
      balance: { int: input.totalVisits },
    }
    textModulesData = [
      { id: "nextReward", header: formatLabel("NEXT REWARD", labelFmt), body: getWalletRewardText(input.programConfig, input.rewardDescription) },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  }

  const loyaltyObject: Record<string, unknown> = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: input.walletPassId,
    accountName: input.customerName,
    loyaltyPoints,
    secondaryLoyaltyPoints,
    barcode: {
      type: "QR_CODE",
      value: input.walletPassId,
    },
    textModulesData,
    // Group passes from the same restaurant together
    groupingInfo: { groupingId: input.restaurantId },
  }

  // Add reveal link if there's an unrevealed prize
  if (input.hasUnrevealedPrize && input.enrollmentId && input.restaurantSlug) {
    const { signCardAccess } = await import("../../card-access")
    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
    const sig = signCardAccess(input.enrollmentId)
    loyaltyObject.linksModuleData = {
      uris: [{
        uri: `${baseUrl}/join/${input.restaurantSlug}/card/${input.enrollmentId}?sig=${sig}`,
        description: "Reveal your prize!",
        id: "revealLink",
      }],
    }
  }

  // Valid time interval for time-bound programs
  if (input.programEndsAt) {
    loyaltyObject.validTimeInterval = {
      end: { date: input.programEndsAt.toISOString() },
    }
  }

  // Hero image (on object — shows as banner strip on the pass)
  const googleLogo = input.restaurantLogoGoogle ?? input.restaurantLogo
  const showStrip = design?.showStrip ?? false
  const isStampType = !cardType || cardType === "STAMP" || cardType === "POINTS"
  let heroImageUrl: string | null = null
  if (showStrip) {
    const stripFiltersG = parseStripFilters(design?.editorConfig)
    if (isStampType && (stripFiltersG.useStampGrid || design?.patternStyle === "STAMP_GRID") && input.enrollmentId) {
      // Generate stamp grid PNG and upload to R2 so Google can access it
      heroImageUrl = await generateAndUploadStampGrid(input, design, stripFiltersG)
    } else {
      heroImageUrl = design?.stripImageGoogle ?? design?.generatedStripGoogle ?? googleLogo
    }
  } else if (isStampType) {
    // Only use logo as hero for stamp/points cards — for coupon/membership it looks oversized
    heroImageUrl = googleLogo
  }

  // Google validates image URLs server-side — skip non-HTTPS URLs (local dev, private IPs)
  if (heroImageUrl && !/^https:\/\//.test(heroImageUrl)) {
    heroImageUrl = null
  }

  if (heroImageUrl) {
    loyaltyObject.heroImage = {
      sourceUri: { uri: heroImageUrl },
      contentDescription: {
        defaultValue: { language: "en", value: input.restaurantName },
      },
    }
  }

  return loyaltyObject
}

// ─── Stamp Grid → R2 Upload ─────────────────────────────────

async function generateAndUploadStampGrid(
  input: GooglePassGenerationInput,
  design: CardDesignData | null | undefined,
  stripFilters: ReturnType<typeof parseStripFilters>,
): Promise<string | null> {
  try {
    const config = parseStampGridConfig(design?.editorConfig)
    const stripPrimary = stripFilters.stripColor1 ?? design?.primaryColor ?? "#1a1a2e"
    const stripSecondary = stripFilters.stripColor2 ?? design?.secondaryColor ?? "#ffffff"

    const buffer = await generateStampGridImage({
      currentVisits: input.currentCycleVisits,
      totalVisits: input.visitsRequired,
      hasReward: input.hasAvailableReward,
      config,
      primaryColor: stripPrimary,
      secondaryColor: stripSecondary,
      textColor: design?.textColor ?? "#ffffff",
      width: GOOGLE_HERO_WIDTH,
      height: GOOGLE_HERO_HEIGHT,
      stripImageUrl: design?.stripImageGoogle,
      stripOpacity: stripFilters.stripOpacity,
      stripGrayscale: stripFilters.stripGrayscale,
    })

    const key = `strip-images/${input.programId ?? input.restaurantId}/google-stamp-grid-${input.enrollmentId}.png`
    return await uploadFile(buffer, key, "image/png")
  } catch {
    // Fall back to static strip or logo
    const googleLogo = input.restaurantLogoGoogle ?? input.restaurantLogo
    return design?.stripImageGoogle ?? design?.generatedStripGoogle ?? googleLogo
  }
}

// ─── Generate Save-to-Wallet URL ────────────────────────────

/**
 * Generates a "Save to Google Wallet" URL containing the loyalty class
 * and object definitions in a signed JWT. When the user taps
 * the link, Google creates/updates the class and object automatically.
 */
export async function generateGoogleWalletSaveUrl(
  input: GooglePassGenerationInput
): Promise<string> {
  const loyaltyClass = buildLoyaltyClass(input)
  const loyaltyObject = await buildLoyaltyObject(input)

  // Also PATCH the class via REST API to ensure updates (like logo changes)
  // are applied to existing classes that Google may have cached
  patchLoyaltyClass(loyaltyClass).catch(() => {})

  return buildSaveUrl([loyaltyClass], [loyaltyObject])
}

/**
 * Best-effort PATCH of the loyalty class via REST API.
 * Ensures class-level changes (logo, colors, template) propagate
 * even when Google has cached an older version from a previous JWT.
 */
async function patchLoyaltyClass(loyaltyClass: Record<string, unknown>): Promise<void> {
  try {
    const { getAccessToken } = await import("./credentials")
    const { GOOGLE_WALLET_API_BASE, GOOGLE_WALLET_ISSUER_ID } = await import("./constants")
    if (!GOOGLE_WALLET_ISSUER_ID) return

    const token = await getAccessToken()
    const classId = loyaltyClass.id as string

    // Must include reviewStatus when updating an approved class
    const patchBody = { ...loyaltyClass, reviewStatus: "UNDER_REVIEW" }

    const response = await fetch(
      `${GOOGLE_WALLET_API_BASE}/loyaltyClass/${encodeURIComponent(classId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchBody),
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      console.error(`Loyalty class PATCH failed (${response.status}):`, errorText.slice(0, 200))
    }
  } catch {
    // Best-effort — don't block pass generation
  }
}

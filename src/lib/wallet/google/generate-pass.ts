import "server-only"

import { buildClassId, buildObjectId, buildProgramClassId, buildEnrollmentObjectId } from "./constants"
import { buildSaveUrl } from "./jwt-utils"
import type { CardDesignData, CardShape, CardType } from "../card-design"
import { getFieldLayout, formatProgressValue, formatLabel, parseStripFilters } from "../card-design"
import { parseCouponConfig, formatCouponValue, parseMembershipConfig } from "../../program-config"

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
  const shape: CardShape = design?.shape ?? "CLEAN"
  const hexBg = ensureHexColor(design?.primaryColor ?? input.brandColor, "#1a1a2e")
  const cardType: CardType | undefined = design?.cardType as CardType | undefined
  const layout = getFieldLayout(shape, cardType)
  const labelFmt = design?.labelFormat ?? "UPPERCASE"

  // Type-specific row field paths
  const isCoupon = input.programType === "COUPON"
  const isMembership = input.programType === "MEMBERSHIP"

  // Determine which text module fields to reference in rows
  const row1Start = isCoupon ? "couponCode" : isMembership ? "benefits" : "nextReward"
  const row1End = "memberSince"
  const row2Field = isCoupon ? "couponCode" : isMembership ? "benefits" : "nextReward"
  const row3Field = "memberSince"

  // Build card row template
  const cardRowTemplateInfos: Record<string, unknown>[] = []

  if (layout.google.rows >= 1) {
    cardRowTemplateInfos.push({
      twoItems: {
        startItem: {
          firstValue: {
            fields: [{ fieldPath: `object.textModulesData['${row1Start}']` }],
          },
        },
        endItem: {
          firstValue: {
            fields: [{ fieldPath: `object.textModulesData['${row1End}']` }],
          },
        },
      },
    })
  }

  if (layout.google.rows >= 2) {
    cardRowTemplateInfos.push({
      oneItem: {
        item: {
          firstValue: {
            fields: [{ fieldPath: `object.textModulesData['${row2Field}']` }],
          },
        },
      },
    })
  }

  if (layout.google.rows >= 3) {
    cardRowTemplateInfos.push({
      oneItem: {
        item: {
          firstValue: {
            fields: [{ fieldPath: `object.textModulesData['${row3Field}']` }],
          },
        },
      },
    })
  }

  // Type-aware program display name
  const programDisplayName = (() => {
    const name = input.programName
    if (!name) return "Loyalty Card"
    if (isCoupon) return name
    if (isMembership) return `${name} Membership`
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

  // Program logo (required for Loyalty)
  if (googleLogo) {
    loyaltyClass.programLogo = {
      sourceUri: { uri: googleLogo },
      contentDescription: {
        defaultValue: { language: "en", value: `${input.restaurantName} logo` },
      },
    }
    loyaltyClass.wideProgramLogo = {
      sourceUri: { uri: googleLogo },
      contentDescription: {
        defaultValue: { language: "en", value: `${input.restaurantName} logo` },
      },
    }
  }

  // Card row template override
  if (cardRowTemplateInfos.length > 0) {
    loyaltyClass.classTemplateInfo = {
      cardTemplateOverride: { cardRowTemplateInfos },
    }
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

  // Discoverable program (optional — helps Google surface the card)
  loyaltyClass.discoverableProgram = {
    merchantSigninInfo: {
      signinWebsite: {
        uri: input.restaurantWebsite ?? "https://loyalshy.com",
        description: input.restaurantName,
      },
    },
    state: "TRUSTED_TESTERS",
  }

  return loyaltyClass
}

// ─── Build Loyalty Object (one per enrollment or customer) ────────────

function buildLoyaltyObject(input: GooglePassGenerationInput) {
  // Use enrollment-scoped object ID when enrollmentId is available, otherwise fall back to customer
  const objectId = input.enrollmentId
    ? buildEnrollmentObjectId(input.enrollmentId)
    : buildObjectId(input.customerId)
  // Use per-program class ID when programId is available
  const classId = input.programId
    ? buildProgramClassId(input.programId)
    : buildClassId(input.restaurantId)
  const design = input.cardDesign
  const shape: CardShape = design?.shape ?? "CLEAN"
  const cardType: CardType | undefined = design?.cardType as CardType | undefined
  const layout = getFieldLayout(shape, cardType)

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

  // Type-specific loyalty points and text modules
  let loyaltyPoints: Record<string, unknown>
  let secondaryLoyaltyPoints: Record<string, unknown>
  let textModulesData: Record<string, unknown>[]

  if (input.programType === "COUPON" && couponConfig) {
    loyaltyPoints = {
      label: formatLabel("DISCOUNT", labelFmt),
      balance: { string: formatCouponValue(couponConfig) },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("VALID UNTIL", labelFmt),
      balance: { string: couponConfig.validUntil ? new Date(couponConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
    }
    textModulesData = [
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
      { id: "benefits", header: formatLabel("BENEFITS", labelFmt), body: membershipConfig.benefits },
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
      { id: "nextReward", header: formatLabel("NEXT REWARD", labelFmt), body: input.rewardDescription },
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

  // Valid time interval for time-bound programs
  if (input.programEndsAt) {
    loyaltyObject.validTimeInterval = {
      end: { date: input.programEndsAt.toISOString() },
    }
  }

  // Hero image: use dynamic stamp grid route, static strip image, or logo
  const googleLogo = input.restaurantLogoGoogle ?? input.restaurantLogo
  const isStampType = !cardType || cardType === "STAMP" || cardType === "POINTS"
  let heroImageUrl: string | null = null
  if (layout.google.showHeroImage) {
    const stripFiltersG = design ? parseStripFilters(design.editorConfig) : { useStampGrid: false }
    if (isStampType && (stripFiltersG.useStampGrid || design?.patternStyle === "STAMP_GRID") && input.enrollmentId) {
      // Dynamic stamp grid: Google fetches from our API route each time
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
      heroImageUrl = `${baseUrl}/api/wallet/strip/${input.enrollmentId}`
    } else {
      heroImageUrl = design?.stripImageGoogle ?? design?.generatedStripGoogle ?? googleLogo
    }
  } else {
    heroImageUrl = googleLogo
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

// ─── Generate Save-to-Wallet URL ────────────────────────────

/**
 * Generates a "Save to Google Wallet" URL containing the loyalty class
 * and object definitions in a signed JWT. When the user taps
 * the link, Google creates/updates the class and object automatically.
 */
export function generateGoogleWalletSaveUrl(
  input: GooglePassGenerationInput
): string {
  const loyaltyClass = buildLoyaltyClass(input)
  const loyaltyObject = buildLoyaltyObject(input)

  return buildSaveUrl([loyaltyClass], [loyaltyObject])
}

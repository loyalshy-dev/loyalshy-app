import "server-only"

import { buildClassId, buildObjectId, buildProgramClassId, buildEnrollmentObjectId } from "./constants"
import { buildSaveUrl } from "./jwt-utils"
import type { CardDesignData, CardShape } from "../card-design"
import { getFieldLayout, formatProgressValue, formatLabel, parseStripFilters } from "../card-design"

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
  const layout = getFieldLayout(shape)
  const labelFmt = design?.labelFormat ?? "UPPERCASE"

  // Build card row template — progress/totalVisits now handled by loyaltyPoints,
  // so rows only contain: nextReward + memberSince, customerName
  const cardRowTemplateInfos: Record<string, unknown>[] = []

  if (layout.google.rows >= 1) {
    cardRowTemplateInfos.push({
      twoItems: {
        startItem: {
          firstValue: {
            fields: [{ fieldPath: "object.textModulesData['nextReward']" }],
          },
        },
        endItem: {
          firstValue: {
            fields: [{ fieldPath: "object.textModulesData['memberSince']" }],
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
            fields: [{ fieldPath: "object.textModulesData['nextReward']" }],
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
            fields: [{ fieldPath: "object.textModulesData['memberSince']" }],
          },
        },
      },
    })
  }

  const programDisplayName = input.programName
    ? `${input.programName} Loyalty`
    : "Loyalty Card"

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
      uri: `mailto:support@fidelio.app`,
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
        uri: input.restaurantWebsite ?? "https://fidelio.app",
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
  const layout = getFieldLayout(shape)

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

  const loyaltyObject: Record<string, unknown> = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: input.walletPassId,
    accountName: input.customerName,
    // Native loyalty points — primary progress
    loyaltyPoints: {
      label: formatLabel(progressLabel, labelFmt),
      balance: { string: progressValue },
    },
    // Secondary loyalty points — total visits
    secondaryLoyaltyPoints: {
      label: formatLabel("TOTAL VISITS", labelFmt),
      balance: { int: input.totalVisits },
    },
    barcode: {
      type: "QR_CODE",
      value: input.walletPassId,
    },
    // Remaining text fields that aren't covered by native loyalty fields
    textModulesData: [
      { id: "nextReward", header: formatLabel("NEXT REWARD", labelFmt), body: input.rewardDescription },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ],
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
  let heroImageUrl: string | null = null
  if (layout.google.showHeroImage) {
    const stripFiltersG = design ? parseStripFilters(design.editorConfig) : { useStampGrid: false }
    if ((stripFiltersG.useStampGrid || design?.patternStyle === "STAMP_GRID") && input.enrollmentId) {
      // Dynamic stamp grid: Google fetches from our API route each time
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.fidelio.app"
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

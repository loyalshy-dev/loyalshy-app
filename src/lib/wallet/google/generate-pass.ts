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
}

// ─── Hex Color Helpers ──────────────────────────────────────

function ensureHexColor(color: string | null, fallback: string): string {
  if (!color) return fallback
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  return fallback
}

// ─── Build Generic Class (one per program or restaurant) ───────────────

function buildGenericClass(input: GooglePassGenerationInput) {
  // Use per-program class ID when programId is available, otherwise fall back to restaurant
  const classId = input.programId
    ? buildProgramClassId(input.programId)
    : buildClassId(input.restaurantId)
  const design = input.cardDesign
  const shape: CardShape = design?.shape ?? "CLEAN"
  const hexBg = ensureHexColor(design?.primaryColor ?? input.brandColor, "#1a1a2e")
  const layout = getFieldLayout(shape)

  // Build card row template based on shape
  const cardRowTemplateInfos: Record<string, unknown>[] = []

  if (layout.google.rows >= 1) {
    cardRowTemplateInfos.push({
      twoItems: {
        startItem: {
          firstValue: {
            fields: [{ fieldPath: "object.textModulesData['progress']" }],
          },
        },
        endItem: {
          firstValue: {
            fields: [{ fieldPath: "object.textModulesData['totalVisits']" }],
          },
        },
      },
    })
  }

  if (layout.google.rows >= 2) {
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

  if (layout.google.rows >= 3) {
    cardRowTemplateInfos.push({
      oneItem: {
        item: {
          firstValue: {
            fields: [{ fieldPath: "object.textModulesData['customerName']" }],
          },
        },
      },
    })
  }

  const genericClass: Record<string, unknown> = {
    id: classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos,
      },
    },
    hexBackgroundColor: hexBg,
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
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

  // Social links from card design
  if (design?.socialLinks.instagram) {
    linksUris.push({
      uri: design.socialLinks.instagram,
      description: "Instagram",
      id: "instagram",
    })
  }
  if (design?.socialLinks.facebook) {
    linksUris.push({
      uri: design.socialLinks.facebook,
      description: "Facebook",
      id: "facebook",
    })
  }
  if (design?.socialLinks.tiktok) {
    linksUris.push({
      uri: design.socialLinks.tiktok,
      description: "TikTok",
      id: "tiktok",
    })
  }
  if (design?.socialLinks.x) {
    linksUris.push({
      uri: design.socialLinks.x,
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

  if (linksUris.length > 0) {
    genericClass.linksModuleData = { uris: linksUris }
  }

  // Info module for business hours + custom message
  const infoModules: Record<string, unknown>[] = []
  if (design?.businessHours) {
    infoModules.push({
      header: "Business Hours",
      body: design.businessHours,
    })
  }
  if (design?.customMessage) {
    infoModules.push({
      header: "Message",
      body: design.customMessage,
    })
  }
  if (infoModules.length > 0) {
    genericClass.infoModuleData = {
      showLastUpdateTime: true,
      labelValueRows: infoModules.map((m) => ({
        columns: [{
          label: m.header as string,
          value: m.body as string,
        }],
      })),
    }
  }

  return genericClass
}

// ─── Build Generic Object (one per enrollment or customer) ────────────────

function buildGenericObject(input: GooglePassGenerationInput) {
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

  // Use program name in header/subheader when available
  const headerValue = input.restaurantName
  const subheaderValue = input.programName
    ? `${input.programName} Loyalty Card`
    : "Loyalty Card"

  const genericObject: Record<string, unknown> = {
    id: objectId,
    classId,
    state: "ACTIVE",
    header: {
      defaultValue: {
        language: "en",
        value: headerValue,
      },
    },
    subheader: {
      defaultValue: {
        language: "en",
        value: subheaderValue,
      },
    },
    cardTitle: {
      defaultValue: {
        language: "en",
        value: input.restaurantName,
      },
    },
    hexBackgroundColor: ensureHexColor(design?.primaryColor ?? input.brandColor, "#1a1a2e"),
    barcode: {
      type: "QR_CODE",
      value: input.walletPassId,
    },
    textModulesData: [
      { id: "progress", header: formatLabel(progressLabel, labelFmt), body: progressValue },
      { id: "totalVisits", header: formatLabel("TOTAL VISITS", labelFmt), body: `${input.totalVisits}` },
      { id: "nextReward", header: formatLabel("NEXT REWARD", labelFmt), body: input.rewardDescription },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
      { id: "customerName", header: formatLabel("NAME", labelFmt), body: input.customerName },
    ],
  }

  // Add logo if available — prefer Google-specific, fall back to general
  const googleLogo = input.restaurantLogoGoogle ?? input.restaurantLogo
  if (googleLogo) {
    genericObject.logo = {
      sourceUri: {
        uri: googleLogo,
      },
      contentDescription: {
        defaultValue: {
          language: "en",
          value: `${input.restaurantName} logo`,
        },
      },
    }
  }

  // Hero image: use dynamic stamp grid route, static strip image, or logo
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
    genericObject.heroImage = {
      sourceUri: {
        uri: heroImageUrl,
      },
      contentDescription: {
        defaultValue: {
          language: "en",
          value: input.restaurantName,
        },
      },
    }
  }

  // Notifications — alert on save
  genericObject.notifications = {
    upcomingNotification: {
      enableNotification: true,
    },
  }

  return genericObject
}

// ─── Generate Save-to-Wallet URL ────────────────────────────

/**
 * Generates a "Save to Google Wallet" URL containing the class
 * and object definitions in a signed JWT. When the user taps
 * the link, Google creates/updates the class and object automatically.
 */
export function generateGoogleWalletSaveUrl(
  input: GooglePassGenerationInput
): string {
  const genericClass = buildGenericClass(input)
  const genericObject = buildGenericObject(input)

  return buildSaveUrl([genericClass], [genericObject])
}

import "server-only"

import { buildClassId, buildObjectId, buildProgramClassId, buildEnrollmentObjectId } from "./constants"
import { buildSaveUrl } from "./jwt-utils"
import type { CardDesignData, CardType } from "../card-design"
import { getFieldLayout, formatProgressValue, formatLabel, parseStripFilters, parseStampGridConfig } from "../card-design"
import { generateStampGridImage, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } from "../strip-image"
import { uploadFile } from "../../storage"
import { parseCouponConfig, formatCouponValue, parseMembershipConfig, parsePointsConfig, parsePrepaidConfig, parseGiftCardConfig, parseTicketConfig, parseAccessConfig, parseTransitConfig, parseBusinessIdConfig, getCheapestCatalogItem, getWalletRewardText } from "../../pass-config"

// ─── Types ──────────────────────────────────────────────────

export type GooglePassGenerationInput = {
  contactId: string
  organizationId: string
  walletPassId: string
  contactName: string
  contactEmail: string | null
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  memberSince: Date
  hasAvailableReward: boolean
  organizationName: string
  organizationLogo: string | null
  organizationLogoGoogle: string | null
  brandColor: string | null
  rewardDescription: string
  rewardExpiryDays: number
  termsAndConditions: string | null
  organizationPhone: string | null
  organizationWebsite: string | null
  // Multi-template fields
  templateName?: string
  templateId?: string
  passInstanceId?: string
  // Pass design fields
  passDesign?: CardDesignData | null
  // Template lifecycle
  templateEndsAt?: Date | null
  // Pass type + config for type-specific pass content
  passType?: string
  templateConfig?: unknown
  pointsBalance?: number
  remainingUses?: number
  // Gift card data
  giftBalanceCents?: number
  giftCurrency?: string
  // Ticket data
  ticketScanCount?: number
  // Access data
  accessTotalGranted?: number
  // Transit data
  transitIsBoarded?: boolean
  // Business ID data
  businessIdVerifications?: number
  // Prize reveal
  hasUnrevealedPrize?: boolean
  organizationSlug?: string
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

// ─── Build Loyalty Class (one per template or organization) ─────────────

function buildLoyaltyClass(input: GooglePassGenerationInput) {
  // Use per-template class ID when templateId is available, otherwise fall back to organization
  const classId = input.templateId
    ? buildProgramClassId(input.templateId)
    : buildClassId(input.organizationId)
  const design = input.passDesign
  const hexBg = ensureHexColor(design?.primaryColor ?? input.brandColor, "#1a1a2e")
  const cardType: CardType | undefined = design?.cardType as CardType | undefined
  const layout = getFieldLayout(cardType)
  const labelFmt = design?.labelFormat ?? "UPPERCASE"

  // Type-specific row field paths
  // Build card row template — all types use textModulesData references
  const cardRowTemplateInfos: Record<string, unknown>[] = []

  switch (input.passType) {
    case "COUPON":
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['discount']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['validUntil']" }] } },
        },
      })
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['couponCode']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['memberSince']" }] } },
        },
      })
      break
    case "MEMBERSHIP":
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['tier']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['status']" }] } },
        },
      })
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['benefits']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['memberSince']" }] } },
        },
      })
      break
    case "PREPAID":
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['remaining']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['validUntil']" }] } },
        },
      })
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['totalUsed']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['memberSince']" }] } },
        },
      })
      break
    case "GIFT_CARD":
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['balance']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['initialValue']" }] } },
        },
      })
      break
    case "TICKET":
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['eventDate']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['venue']" }] } },
        },
      })
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['scans']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['holder']" }] } },
        },
      })
      break
    case "ACCESS":
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['accessLabel']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['totalGranted']" }] } },
        },
      })
      break
    case "TRANSIT":
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['origin']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['destination']" }] } },
        },
      })
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['transitType']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['boardingStatus']" }] } },
        },
      })
      break
    case "BUSINESS_ID":
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['idLabel']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['verifications']" }] } },
        },
      })
      break
    default: {
      // Stamp/Points
      const textRow1Start = input.passType === "POINTS" ? "earnRate" : "nextReward"
      cardRowTemplateInfos.push({
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: `object.textModulesData['${textRow1Start}']` }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['memberSince']" }] } },
        },
      })
      break
    }
  }

  // Type-aware program display name
  const programDisplayName = (() => {
    const name = input.templateName
    if (!name) return "Loyalty Card"
    switch (input.passType) {
      case "COUPON": return name
      case "MEMBERSHIP": return `${name} Membership`
      case "POINTS": return `${name} Points`
      case "PREPAID": return `${name} Pass`
      case "GIFT_CARD": return `${name} Gift Card`
      case "TICKET": return `${name} Ticket`
      case "ACCESS": return `${name} Access`
      case "TRANSIT": return `${name} Transit`
      case "BUSINESS_ID": return `${name} ID`
      default: return `${name} Loyalty`
    }
  })()

  // Prefer Google-specific logo, fall back to general
  const googleLogo = input.organizationLogoGoogle ?? input.organizationLogo

  const loyaltyClass: Record<string, unknown> = {
    id: classId,
    programName: programDisplayName,
    issuerName: input.organizationName,
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
      defaultValue: { language: "en", value: `${input.organizationName} logo` },
    },
  }
  if (googleLogo) {
    loyaltyClass.wideProgramLogo = {
      sourceUri: { uri: googleLogo },
      contentDescription: {
        defaultValue: { language: "en", value: `${input.organizationName} logo` },
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
  if (input.organizationWebsite) {
    loyaltyClass.homepageUri = {
      uri: input.organizationWebsite,
      description: input.organizationName,
      id: "homepage",
    }
  }

  // Links module for organization contact + socials
  const linksUris: Record<string, unknown>[] = []
  if (input.organizationWebsite) {
    linksUris.push({
      uri: input.organizationWebsite,
      description: input.organizationName,
      id: "website",
    })
  }
  if (input.organizationPhone) {
    linksUris.push({
      uri: `tel:${input.organizationPhone}`,
      description: input.organizationPhone,
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

  // Merchant locations from coordinates + nearby notification
  if (design?.mapLatitude != null && design?.mapLongitude != null) {
    const stripFiltersLoc = parseStripFilters(design.editorConfig)
    const messageBody = stripFiltersLoc.locationMessage || `You're near ${input.organizationName}! Show your pass.`
    loyaltyClass.locations = [
      { latitude: design.mapLatitude, longitude: design.mapLongitude },
    ]
    loyaltyClass.messages = [
      ...(loyaltyClass.messages as Record<string, unknown>[] ?? []),
      {
        header: input.organizationName,
        body: messageBody,
        messageType: "TEXT",
        localizedHeader: { defaultValue: { language: "en", value: input.organizationName } },
        localizedBody: { defaultValue: { language: "en", value: messageBody } },
      },
    ]
  }

  return loyaltyClass
}

// ─── Build Loyalty Object (one per pass instance or contact) ────────────

async function buildLoyaltyObject(input: GooglePassGenerationInput) {
  // Use pass-instance-scoped object ID when passInstanceId is available, otherwise fall back to contact
  const objectId = input.passInstanceId
    ? buildEnrollmentObjectId(input.passInstanceId)
    : buildObjectId(input.contactId)
  // Use per-template class ID when templateId is available
  const classId = input.templateId
    ? buildProgramClassId(input.templateId)
    : buildClassId(input.organizationId)
  const design = input.passDesign
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
  const couponConfig = input.passType === "COUPON" ? parseCouponConfig(input.templateConfig) : null
  const membershipConfig = input.passType === "MEMBERSHIP" ? parseMembershipConfig(input.templateConfig) : null
  const pointsConfig = input.passType === "POINTS" ? parsePointsConfig(input.templateConfig) : null
  const prepaidConfig = input.passType === "PREPAID" ? parsePrepaidConfig(input.templateConfig) : null
  const giftCardConfig = input.passType === "GIFT_CARD" ? parseGiftCardConfig(input.templateConfig) : null
  const ticketConfig = input.passType === "TICKET" ? parseTicketConfig(input.templateConfig) : null
  const accessConfig = input.passType === "ACCESS" ? parseAccessConfig(input.templateConfig) : null
  const transitConfig = input.passType === "TRANSIT" ? parseTransitConfig(input.templateConfig) : null
  const businessIdConfig = input.passType === "BUSINESS_ID" ? parseBusinessIdConfig(input.templateConfig) : null

  // Type-specific loyalty points and text modules
  let loyaltyPoints: Record<string, unknown>
  let secondaryLoyaltyPoints: Record<string, unknown>
  let textModulesData: Record<string, unknown>[]

  if (input.passType === "COUPON" && couponConfig) {
    // When minigame is enabled with prizes, show prizes instead of generic discount
    const prizeText = getWalletRewardText(input.templateConfig, formatCouponValue(couponConfig))
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
  } else if (input.passType === "MEMBERSHIP" && membershipConfig) {
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
      { id: "status", header: formatLabel("STATUS", labelFmt), body: "Active" },
      { id: "benefits", header: formatLabel("BENEFITS", labelFmt), body: membershipConfig.benefits },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  } else if (input.passType === "PREPAID" && prepaidConfig) {
    const remaining = input.remainingUses ?? 0
    const totalUsed = input.totalVisits
    loyaltyPoints = {
      label: formatLabel("REMAINING", labelFmt),
      balance: { string: `${remaining} / ${prepaidConfig.totalUses}` },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("USED", labelFmt),
      balance: { int: totalUsed },
    }
    textModulesData = [
      { id: "remaining", header: formatLabel(`${prepaidConfig.useLabel.toUpperCase()}S LEFT`, labelFmt), body: `${remaining} / ${prepaidConfig.totalUses}` },
      { id: "validUntil", header: formatLabel("VALID UNTIL", labelFmt), body: prepaidConfig.validUntil ? new Date(prepaidConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
      { id: "totalUsed", header: formatLabel("TOTAL USED", labelFmt), body: String(totalUsed) },
      { id: "memberSince", header: formatLabel("ADDED", labelFmt), body: memberSinceFormatted },
    ]
  } else if (input.passType === "POINTS" && pointsConfig) {
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
  } else if (input.passType === "GIFT_CARD" && giftCardConfig) {
    const balanceCents = input.giftBalanceCents ?? giftCardConfig.initialBalanceCents
    const balanceStr = `${giftCardConfig.currency} ${(balanceCents / 100).toFixed(2)}`
    const initialStr = `${giftCardConfig.currency} ${(giftCardConfig.initialBalanceCents / 100).toFixed(2)}`
    loyaltyPoints = {
      label: formatLabel("BALANCE", labelFmt),
      balance: { string: balanceStr },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("INITIAL VALUE", labelFmt),
      balance: { string: initialStr },
    }
    textModulesData = [
      { id: "balance", header: formatLabel("BALANCE", labelFmt), body: balanceStr },
      { id: "initialValue", header: formatLabel("INITIAL VALUE", labelFmt), body: initialStr },
    ]
  } else if (input.passType === "TICKET" && ticketConfig) {
    loyaltyPoints = {
      label: formatLabel("EVENT", labelFmt),
      balance: { string: ticketConfig.eventName },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("SCANS", labelFmt),
      balance: { string: `${input.ticketScanCount ?? 0} / ${ticketConfig.maxScans}` },
    }
    textModulesData = [
      { id: "eventDate", header: formatLabel("DATE", labelFmt), body: new Date(ticketConfig.eventDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) },
      { id: "venue", header: formatLabel("VENUE", labelFmt), body: ticketConfig.eventVenue },
      { id: "scans", header: formatLabel("SCANS", labelFmt), body: `${input.ticketScanCount ?? 0} / ${ticketConfig.maxScans}` },
      { id: "holder", header: formatLabel("HOLDER", labelFmt), body: input.contactName },
    ]
  } else if (input.passType === "ACCESS" && accessConfig) {
    loyaltyPoints = {
      label: formatLabel(accessConfig.accessLabel, labelFmt),
      balance: { string: "Active" },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("TOTAL GRANTED", labelFmt),
      balance: { int: input.accessTotalGranted ?? 0 },
    }
    textModulesData = [
      { id: "accessLabel", header: formatLabel(accessConfig.accessLabel, labelFmt), body: "Active" },
      { id: "totalGranted", header: formatLabel("TOTAL GRANTED", labelFmt), body: String(input.accessTotalGranted ?? 0) },
    ]
  } else if (input.passType === "TRANSIT" && transitConfig) {
    loyaltyPoints = {
      label: formatLabel("STATUS", labelFmt),
      balance: { string: input.transitIsBoarded ? "BOARDED" : "NOT BOARDED" },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("TYPE", labelFmt),
      balance: { string: transitConfig.transitType.toUpperCase() },
    }
    textModulesData = [
      { id: "origin", header: formatLabel("FROM", labelFmt), body: transitConfig.originName ?? "—" },
      { id: "destination", header: formatLabel("TO", labelFmt), body: transitConfig.destinationName ?? "—" },
      { id: "transitType", header: formatLabel("TYPE", labelFmt), body: transitConfig.transitType.toUpperCase() },
      { id: "boardingStatus", header: formatLabel("STATUS", labelFmt), body: input.transitIsBoarded ? "BOARDED" : "NOT BOARDED" },
    ]
  } else if (input.passType === "BUSINESS_ID" && businessIdConfig) {
    loyaltyPoints = {
      label: formatLabel(businessIdConfig.idLabel, labelFmt),
      balance: { string: input.contactName },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("VERIFICATIONS", labelFmt),
      balance: { int: input.businessIdVerifications ?? 0 },
    }
    textModulesData = [
      { id: "idLabel", header: formatLabel(businessIdConfig.idLabel, labelFmt), body: input.contactName },
      { id: "verifications", header: formatLabel("VERIFICATIONS", labelFmt), body: String(input.businessIdVerifications ?? 0) },
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
      { id: "nextReward", header: formatLabel("NEXT REWARD", labelFmt), body: getWalletRewardText(input.templateConfig, input.rewardDescription) },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  }

  const loyaltyObject: Record<string, unknown> = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: input.walletPassId,
    accountName: input.contactName,
    loyaltyPoints,
    secondaryLoyaltyPoints,
    barcode: {
      type: "QR_CODE",
      value: input.walletPassId,
    },
    textModulesData,
    // Group passes from the same organization together
    groupingInfo: { groupingId: input.organizationId },
  }

  // Add reveal link if there's an unrevealed prize
  if (input.hasUnrevealedPrize && input.passInstanceId && input.organizationSlug) {
    const { signCardAccess } = await import("../../card-access")
    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
    const sig = signCardAccess(input.passInstanceId)
    loyaltyObject.linksModuleData = {
      uris: [{
        uri: `${baseUrl}/join/${input.organizationSlug}/card/${input.passInstanceId}?sig=${sig}`,
        description: "Reveal your prize!",
        id: "revealLink",
      }],
    }
  }

  // Valid time interval for time-bound programs
  if (input.templateEndsAt) {
    loyaltyObject.validTimeInterval = {
      end: { date: input.templateEndsAt.toISOString() },
    }
  }

  // Hero image (on object — shows as banner strip on the pass)
  const googleLogo = input.organizationLogoGoogle ?? input.organizationLogo
  const showStrip = design?.showStrip ?? false
  const isStampType = !cardType || cardType === "STAMP" || cardType === "POINTS"
  let heroImageUrl: string | null = null
  if (showStrip) {
    const stripFiltersG = parseStripFilters(design?.editorConfig)
    if (isStampType && (stripFiltersG.useStampGrid || design?.patternStyle === "STAMP_GRID") && input.passInstanceId) {
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
        defaultValue: { language: "en", value: input.organizationName },
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
      secondaryColor: stripFilters.stampFilledColor ?? stripSecondary,
      textColor: design?.textColor ?? "#ffffff",
      width: GOOGLE_HERO_WIDTH,
      height: GOOGLE_HERO_HEIGHT,
      stripImageUrl: design?.stripImageGoogle,
      stripOpacity: stripFilters.stripOpacity,
      stripGrayscale: stripFilters.stripGrayscale,
    })

    const key = `strip-images/${input.templateId ?? input.organizationId}/google-stamp-grid-${input.passInstanceId}.png`
    return await uploadFile(buffer, key, "image/png")
  } catch {
    // Fall back to static strip or logo
    const googleLogo = input.organizationLogoGoogle ?? input.organizationLogo
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

    if (!response.ok && response.status !== 404) {
      // 404 is expected for new programs — class is created when user saves the JWT
      const errorText = await response.text().catch(() => "")
      console.error(`Loyalty class PATCH failed (${response.status}):`, errorText.slice(0, 200))
    }
  } catch {
    // Best-effort — don't block pass generation
  }
}

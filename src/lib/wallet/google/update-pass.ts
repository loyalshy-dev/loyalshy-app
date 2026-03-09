import "server-only"

import { db } from "@/lib/db"
import { getAccessToken } from "./credentials"
import {
  GOOGLE_WALLET_API_BASE,
  GOOGLE_WALLET_ISSUER_ID,
  buildPassInstanceObjectId,
} from "./constants"
import { formatProgressValue, formatLabel, parseStripFilters, parseStampGridConfig, getFieldConfig } from "../card-design"
import type { ProgressStyle, LabelFormat } from "../card-design"
import { generateStampGridImage, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } from "../strip-image"
import { uploadFile } from "../../storage"
import { getWalletRewardText, parseCouponConfig, formatCouponValue, parseMembershipConfig, parsePointsConfig, parsePrepaidConfig, parseGiftCardConfig, parseTicketConfig, parseAccessConfig, parseTransitConfig, parseBusinessIdConfig, getCheapestCatalogItem } from "../../pass-config"

// ─── Types ──────────────────────────────────────────────────

type GooglePassUpdateData = {
  passInstanceId: string
  memberNumber?: number
  contactName: string
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  pointsBalance: number
  hasAvailableReward: boolean
  rewardDescription: string
  revealedPrize: string | null
  organizationName: string
  brandColor: string | null
  organizationLogo: string | null
  templateName: string
  memberSince: Date
  // Pass type
  passType: string | null
  templateConfig: unknown
  // Card design fields for formatting
  progressStyle: ProgressStyle
  labelFormat: LabelFormat
  customProgressLabel: string | null
  heroImageUrl?: string | null
  revealLink?: string | null
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
  // Pass instance status (for coupon redeemed display)
  passInstanceStatus?: string
  // Editor config for custom field labels
  editorConfig?: unknown
}

// ─── Update Google Wallet Pass ──────────────────────────────

/**
 * Updates a Google Wallet pass by PATCHing the loyalty object
 * via the Google Wallet REST API. Changes appear automatically
 * on the user's device.
 */
async function patchGoogleWalletObject(
  data: GooglePassUpdateData
): Promise<void> {
  if (!GOOGLE_WALLET_ISSUER_ID) return

  const objectId = buildPassInstanceObjectId(data.passInstanceId)
  const token = await getAccessToken()

  const labelFmt = data.labelFormat

  const memberSinceFormatted = data.memberSince.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })

  // Parse type-specific config
  const couponConfig = data.passType === "COUPON" ? parseCouponConfig(data.templateConfig) : null
  const membershipConfig = data.passType === "MEMBERSHIP" ? parseMembershipConfig(data.templateConfig) : null
  const pointsConfig = data.passType === "POINTS" ? parsePointsConfig(data.templateConfig) : null
  const prepaidConfig = data.passType === "PREPAID" ? parsePrepaidConfig(data.templateConfig) : null
  const giftCardConfig = data.passType === "GIFT_CARD" ? parseGiftCardConfig(data.templateConfig) : null
  const ticketConfig = data.passType === "TICKET" ? parseTicketConfig(data.templateConfig) : null
  const accessConfig = data.passType === "ACCESS" ? parseAccessConfig(data.templateConfig) : null
  const transitConfig = data.passType === "TRANSIT" ? parseTransitConfig(data.templateConfig) : null
  const businessIdConfig = data.passType === "BUSINESS_ID" ? parseBusinessIdConfig(data.templateConfig) : null
  const cheapestItem = pointsConfig ? getCheapestCatalogItem(pointsConfig) : null

  // Custom field labels from editorConfig
  const stripFiltersUpd = parseStripFilters(data.editorConfig)
  const customLabels = stripFiltersUpd.fieldLabels ?? {}
  const lbl = (fieldId: string, defaultLabel: string) => {
    const custom = customLabels[fieldId]
    return formatLabel(custom ?? defaultLabel, labelFmt)
  }

  // Coupon status-aware values
  const isRedeemed = data.passInstanceStatus === "COMPLETED"
  const couponPrizeText = couponConfig ? getWalletRewardText(data.templateConfig, formatCouponValue(couponConfig)) : ""
  const couponHasPrizes = couponConfig ? couponPrizeText !== formatCouponValue(couponConfig) : false
  const couponDiscountLabel = isRedeemed ? "REDEEMED" : (data.revealedPrize ? "YOUR PRIZE" : (couponHasPrizes ? "PRIZES" : "DISCOUNT"))
  const couponDiscountValue = isRedeemed ? `${data.revealedPrize ?? couponPrizeText} (Used)` : (data.revealedPrize ?? couponPrizeText)
  const couponValidUntilText = couponConfig?.validUntil ? new Date(couponConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry"

  // Membership status
  const membershipStatusText = data.passInstanceStatus === "SUSPENDED" ? "Suspended" : data.passInstanceStatus === "EXPIRED" ? "Expired" : "Active"

  // All field data — IDs match field IDs from getFieldConfig
  const allFieldData: Record<string, { id: string; header: string; body: string }> = {
    organization: { id: "organization", header: lbl("organization", "ORG"), body: data.organizationName },
    memberNumber: { id: "memberNumber", header: lbl("memberNumber", "MEMBER #"), body: `${data.memberNumber ?? "—"}` },
    nextReward: { id: "nextReward", header: lbl("nextReward", data.revealedPrize ? "YOUR PRIZE" : "NEXT REWARD"), body: data.revealedPrize ?? data.rewardDescription },
    totalVisits: { id: "totalVisits", header: lbl("totalVisits", "TOTAL VISITS"), body: `${data.totalVisits}` },
    memberSince: { id: "memberSince", header: lbl("memberSince", "SINCE"), body: memberSinceFormatted },
    registeredAt: { id: "registeredAt", header: lbl("registeredAt", "REGISTERED"), body: memberSinceFormatted },
    customerName: { id: "customerName", header: lbl("customerName", "NAME"), body: data.contactName },
    // COUPON
    discount: { id: "discount", header: lbl("discount", couponDiscountLabel), body: couponDiscountValue },
    validUntil: { id: "validUntil", header: lbl("validUntil", isRedeemed ? "STATUS" : "VALID UNTIL"), body: isRedeemed ? "Redeemed" : couponValidUntilText },
    couponCode: { id: "couponCode", header: lbl("couponCode", "CODE"), body: couponConfig?.couponCode ?? "" },
    // MEMBERSHIP
    tierName: { id: "tierName", header: lbl("tierName", "TIER"), body: membershipConfig?.membershipTier ?? "" },
    benefits: { id: "benefits", header: lbl("benefits", "BENEFITS"), body: membershipConfig?.benefits ?? "" },
    // POINTS
    earnRate: { id: "earnRate", header: lbl("earnRate", "EARN RATE"), body: pointsConfig ? `${pointsConfig.pointsPerVisit} points per visit` : "" },
    // PREPAID
    remaining: { id: "remaining", header: lbl("remaining", "REMAINING"), body: `${data.remainingUses ?? 0} / ${prepaidConfig?.totalUses ?? 0}` },
    prepaidValidUntil: { id: "prepaidValidUntil", header: lbl("prepaidValidUntil", "VALID UNTIL"), body: prepaidConfig?.validUntil ? new Date(prepaidConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
    totalUsed: { id: "totalUsed", header: lbl("totalUsed", "TOTAL USED"), body: String(data.totalVisits) },
    // GIFT_CARD
    giftBalance: { id: "giftBalance", header: lbl("giftBalance", "BALANCE"), body: giftCardConfig ? `${giftCardConfig.currency} ${((data.giftBalanceCents ?? giftCardConfig.initialBalanceCents) / 100).toFixed(2)}` : "" },
    giftInitial: { id: "giftInitial", header: lbl("giftInitial", "INITIAL VALUE"), body: giftCardConfig ? `${giftCardConfig.currency} ${(giftCardConfig.initialBalanceCents / 100).toFixed(2)}` : "" },
    // TICKET
    eventName: { id: "eventName", header: lbl("eventName", "EVENT"), body: ticketConfig?.eventName ?? "" },
    eventDate: { id: "eventDate", header: lbl("eventDate", "DATE"), body: ticketConfig?.eventDate ? new Date(ticketConfig.eventDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "" },
    eventVenue: { id: "eventVenue", header: lbl("eventVenue", "VENUE"), body: ticketConfig?.eventVenue ?? "" },
    scanStatus: { id: "scanStatus", header: lbl("scanStatus", "SCANS"), body: `${data.ticketScanCount ?? 0} / ${ticketConfig?.maxScans ?? 1}` },
    // ACCESS
    accessLabel: { id: "accessLabel", header: lbl("accessLabel", accessConfig?.accessLabel ?? "ACCESS"), body: "Active" },
    accessGranted: { id: "accessGranted", header: lbl("accessGranted", "TOTAL GRANTED"), body: String(data.accessTotalGranted ?? 0) },
    // TRANSIT
    transitType: { id: "transitType", header: lbl("transitType", "TYPE"), body: (transitConfig?.transitType ?? "other").toUpperCase() },
    origin: { id: "origin", header: lbl("origin", "FROM"), body: transitConfig?.originName ?? "—" },
    destination: { id: "destination", header: lbl("destination", "TO"), body: transitConfig?.destinationName ?? "—" },
    boardingStatus: { id: "boardingStatus", header: lbl("boardingStatus", "STATUS"), body: data.transitIsBoarded ? "BOARDED" : "NOT BOARDED" },
    // BUSINESS_ID
    idLabel: { id: "idLabel", header: lbl("idLabel", businessIdConfig?.idLabel ?? "ID"), body: data.contactName },
    verifications: { id: "verifications", header: lbl("verifications", "VERIFICATIONS"), body: String(data.businessIdVerifications ?? 0) },
  }

  // Build textModulesData from user-configured unified fields
  const fieldConfig = getFieldConfig(data.passType ?? "STAMP_CARD")
  const allUpdFields = stripFiltersUpd.fields
    ?? (stripFiltersUpd.headerFields || stripFiltersUpd.secondaryFields
      ? [...(stripFiltersUpd.headerFields ?? fieldConfig.defaultHeader), ...(stripFiltersUpd.secondaryFields ?? fieldConfig.defaultSecondary)]
      : null)
    ?? fieldConfig.defaultFields
  // Only exclude "progress" for stamp/points — it's the native loyaltyPoints widget
  const isStampTypeUpd = !data.passType || data.passType === "STAMP_CARD" || data.passType === "POINTS"
  const googleExcludeUpd = new Set<string>()
  if (isStampTypeUpd) {
    googleExcludeUpd.add("progress")
  }
  const textModulesFieldIds = allUpdFields.filter((id) => !googleExcludeUpd.has(id))
  const textModulesData = textModulesFieldIds
    .map((id) => allFieldData[id])
    .filter((f): f is { id: string; header: string; body: string } => f != null && f.body !== "")

  // Type-specific loyalty points (native Google Wallet widget — not affected by field config)
  let loyaltyPoints: Record<string, unknown>
  let secondaryLoyaltyPoints: Record<string, unknown>

  if (data.passType === "COUPON" && couponConfig) {
    loyaltyPoints = { label: lbl("discount", couponDiscountLabel), balance: { string: couponDiscountValue } }
    secondaryLoyaltyPoints = { label: lbl("validUntil", isRedeemed ? "STATUS" : "VALID UNTIL"), balance: { string: isRedeemed ? "Redeemed" : couponValidUntilText } }
  } else if (data.passType === "MEMBERSHIP" && membershipConfig) {
    loyaltyPoints = { label: lbl("tierName", "TIER"), balance: { string: membershipConfig.membershipTier } }
    secondaryLoyaltyPoints = { label: formatLabel("STATUS", labelFmt), balance: { string: membershipStatusText } }
  } else if (data.passType === "PREPAID" && prepaidConfig) {
    loyaltyPoints = { label: lbl("remaining", "REMAINING"), balance: { string: `${data.remainingUses ?? 0} / ${prepaidConfig.totalUses}` } }
    secondaryLoyaltyPoints = { label: formatLabel("USED", labelFmt), balance: { int: data.totalVisits } }
  } else if (data.passType === "POINTS" && pointsConfig) {
    loyaltyPoints = { label: formatLabel("POINTS", labelFmt), balance: { int: data.pointsBalance ?? 0 } }
    secondaryLoyaltyPoints = cheapestItem
      ? { label: lbl("nextReward", "NEXT REWARD"), balance: { string: `${cheapestItem.name} (${cheapestItem.pointsCost} pts)` } }
      : { label: lbl("totalVisits", "TOTAL VISITS"), balance: { int: data.totalVisits } }
  } else if (data.passType === "GIFT_CARD" && giftCardConfig) {
    const balanceCents = data.giftBalanceCents ?? giftCardConfig.initialBalanceCents
    loyaltyPoints = { label: lbl("giftBalance", "BALANCE"), balance: { string: `${giftCardConfig.currency} ${(balanceCents / 100).toFixed(2)}` } }
    secondaryLoyaltyPoints = { label: lbl("giftInitial", "INITIAL VALUE"), balance: { string: `${giftCardConfig.currency} ${(giftCardConfig.initialBalanceCents / 100).toFixed(2)}` } }
  } else if (data.passType === "TICKET" && ticketConfig) {
    loyaltyPoints = { label: lbl("eventName", "EVENT"), balance: { string: ticketConfig.eventName } }
    secondaryLoyaltyPoints = { label: lbl("scanStatus", "SCANS"), balance: { string: `${data.ticketScanCount ?? 0} / ${ticketConfig.maxScans}` } }
  } else if (data.passType === "ACCESS" && accessConfig) {
    loyaltyPoints = { label: lbl("accessLabel", accessConfig.accessLabel), balance: { string: "Active" } }
    secondaryLoyaltyPoints = { label: lbl("accessGranted", "TOTAL GRANTED"), balance: { int: data.accessTotalGranted ?? 0 } }
  } else if (data.passType === "TRANSIT" && transitConfig) {
    loyaltyPoints = { label: lbl("boardingStatus", "STATUS"), balance: { string: data.transitIsBoarded ? "BOARDED" : "NOT BOARDED" } }
    secondaryLoyaltyPoints = { label: lbl("transitType", "TYPE"), balance: { string: transitConfig.transitType.toUpperCase() } }
  } else if (data.passType === "BUSINESS_ID" && businessIdConfig) {
    loyaltyPoints = { label: lbl("idLabel", businessIdConfig.idLabel), balance: { string: data.contactName } }
    secondaryLoyaltyPoints = { label: lbl("verifications", "VERIFICATIONS"), balance: { int: data.businessIdVerifications ?? 0 } }
  } else {
    // STAMP_CARD (default)
    const progressValue = formatProgressValue(data.currentCycleVisits, data.visitsRequired, data.progressStyle, data.hasAvailableReward)
    const progressLabel = data.customProgressLabel ? data.customProgressLabel : data.hasAvailableReward ? "STATUS" : "PROGRESS"
    loyaltyPoints = { label: formatLabel(progressLabel, labelFmt), balance: { string: progressValue } }
    secondaryLoyaltyPoints = { label: lbl("totalVisits", "TOTAL VISITS"), balance: { int: data.totalVisits } }
  }

  const patchBody: Record<string, unknown> = {
    loyaltyPoints,
    secondaryLoyaltyPoints,
    accountName: data.contactName,
    textModulesData,
  }

  if (data.heroImageUrl) {
    patchBody.heroImage = {
      sourceUri: { uri: data.heroImageUrl },
      contentDescription: {
        defaultValue: { language: "en", value: data.organizationName },
      },
    }
  }

  if (data.revealLink) {
    patchBody.linksModuleData = {
      uris: [{
        uri: data.revealLink,
        description: "Reveal your prize!",
        id: "revealLink",
      }],
    }
  } else {
    // Clear reveal link after prize has been revealed
    patchBody.linksModuleData = { uris: [] }
  }

  const response = await fetch(
    `${GOOGLE_WALLET_API_BASE}/loyaltyObject/${encodeURIComponent(objectId)}`,
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
    const errorText = await response.text().catch(() => "Unable to read error body")
    console.error(
      `Google Wallet PATCH failed (${response.status}):`,
      errorText.slice(0, 200)
    )
    // Don't throw — pass updates are best-effort
  }
}

// ─── Notify Google Pass Update ──────────────────────────────

/**
 * Notifies that a pass instance's Google Wallet pass needs updating.
 * Fetches current passInstance/contact/template/organization data and PATCHes the object.
 */
export async function notifyGooglePassUpdate(
  passInstanceId: string
): Promise<void> {
  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    include: {
      contact: {
        select: {
          id: true,
          fullName: true,
          memberNumber: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              brandColor: true,
              logo: true,
            },
          },
        },
      },
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          passDesign: {
            select: {
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              showStrip: true,
              patternStyle: true,
              progressStyle: true,
              labelFormat: true,
              customProgressLabel: true,
              stripImageGoogle: true,
              editorConfig: true,
            },
          },
        },
      },
      rewards: {
        where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
        select: { id: true, status: true, revealedAt: true, description: true },
        take: 5,
      },
    },
  })

  if (!passInstance || passInstance.walletProvider !== "GOOGLE") return

  // Extract data from the PassInstance.data JSON
  const instanceData = (passInstance.data ?? {}) as Record<string, unknown>
  const currentCycleVisits = (instanceData.currentCycleVisits as number) ?? 0
  const totalVisits = (instanceData.totalVisits as number) ?? 0
  const pointsBalance = (instanceData.pointsBalance as number) ?? 0
  const remainingUses = (instanceData.remainingUses as number) ?? 0
  const giftBalanceCents = (instanceData.balanceCents as number) ?? undefined
  const giftCurrency = (instanceData.currency as string) ?? undefined
  const ticketScanCount = (instanceData.scanCount as number) ?? 0
  const accessTotalGranted = (instanceData.totalGranted as number) ?? 0
  const transitIsBoarded = (instanceData.isBoarded as boolean) ?? false
  const businessIdVerifications = (instanceData.totalVerifications as number) ?? 0

  // Extract config values from PassTemplate.config JSON
  const templateConfig = (passInstance.passTemplate.config ?? {}) as Record<string, unknown>
  const visitsRequired = (templateConfig.stampsRequired as number) ?? 10
  const rewardDescription = (templateConfig.rewardDescription as string) ?? "Free reward"

  const passDesign = passInstance.passTemplate.passDesign
  const hasAvailableReward = passInstance.rewards.some((r) => r.status === "AVAILABLE")
  const revealedReward = passInstance.rewards.find((r) => r.revealedAt !== null && r.description)

  try {
    // Generate stamp grid hero image if applicable
    let heroImageUrl: string | null = null
    const isStampCard = !passInstance.passTemplate.passType || passInstance.passTemplate.passType === "STAMP_CARD"
    if (isStampCard && passDesign?.showStrip !== false) {
      const stripFilters = parseStripFilters(passDesign?.editorConfig)
      const isStampGrid = stripFilters.useStampGrid || passDesign?.patternStyle === "STAMP_GRID"
      if (isStampGrid) {
        try {
          const config = parseStampGridConfig(passDesign?.editorConfig)
          const stripPrimary = stripFilters.stripColor1 ?? passDesign?.primaryColor ?? "#1a1a2e"
          const stripSecondary = stripFilters.stripColor2 ?? passDesign?.secondaryColor ?? "#ffffff"
          const buffer = await generateStampGridImage({
            currentVisits: currentCycleVisits,
            totalVisits: visitsRequired,
            hasReward: hasAvailableReward,
            config,
            primaryColor: stripPrimary,
            secondaryColor: stripFilters.stampFilledColor ?? stripSecondary,
            textColor: passDesign?.textColor ?? "#ffffff",
            width: GOOGLE_HERO_WIDTH,
            height: GOOGLE_HERO_HEIGHT,
            stripImageUrl: passDesign?.stripImageGoogle,
            stripOpacity: stripFilters.stripOpacity,
            stripGrayscale: stripFilters.stripGrayscale,
          })
          const key = `strip-images/${passInstance.passTemplate.id}/google-stamp-grid-${passInstance.id}.png`
          heroImageUrl = await uploadFile(buffer, key, "image/png")
        } catch (err) {
          console.error("Failed to generate stamp grid:", err instanceof Error ? err.message : err)
        }
      }
    }

    // Build reveal link if there's an unrevealed prize
    let revealLink: string | null = null
    const unrevealedReward = passInstance.rewards.find(
      (r) => r.revealedAt === null && r.description != null
    )
    if (unrevealedReward) {
      const { signCardAccess } = await import("../../card-access")
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
      const slug = passInstance.contact.organization.slug
      const sig = signCardAccess(passInstance.id)
      revealLink = `${baseUrl}/join/${slug}/card/${passInstance.id}?sig=${sig}`
    }

    await patchGoogleWalletObject({
      passInstanceId: passInstance.id,
      memberNumber: passInstance.contact.memberNumber,
      contactName: passInstance.contact.fullName,
      currentCycleVisits,
      visitsRequired,
      totalVisits,
      pointsBalance,
      remainingUses,
      giftBalanceCents,
      giftCurrency,
      ticketScanCount,
      accessTotalGranted,
      transitIsBoarded,
      businessIdVerifications,
      hasAvailableReward,
      rewardDescription: getWalletRewardText(passInstance.passTemplate.config, rewardDescription),
      revealedPrize: revealedReward?.description ?? null,
      organizationName: passInstance.contact.organization.name,
      brandColor: passInstance.contact.organization.brandColor,
      organizationLogo: passInstance.contact.organization.logo,
      templateName: passInstance.passTemplate.name,
      memberSince: passInstance.contact.createdAt,
      passType: passInstance.passTemplate.passType,
      templateConfig: passInstance.passTemplate.config,
      progressStyle: (passDesign?.progressStyle as ProgressStyle) ?? "NUMBERS",
      labelFormat: (passDesign?.labelFormat as LabelFormat) ?? "UPPERCASE",
      customProgressLabel: passDesign?.customProgressLabel ?? null,
      heroImageUrl,
      revealLink,
      passInstanceStatus: passInstance.status,
      editorConfig: passDesign?.editorConfig,
    })
  } catch (error) {
    console.error("Failed to update Google Wallet pass:", error instanceof Error ? error.message : "Unknown error")
  }

  // Log the update
  await db.walletPassLog.create({
    data: {
      passInstanceId,
      action: "UPDATED",
      details: { trigger: "data_change", platform: "google" },
    },
  })
}

import "server-only"

import { db } from "@/lib/db"
import { getAccessToken } from "./credentials"
import {
  GOOGLE_WALLET_API_BASE,
  GOOGLE_WALLET_ISSUER_ID,
  buildPassInstanceObjectId,
} from "./constants"
import { formatProgressValue, formatLabel, parseStripFilters, parseStampGridConfig } from "../card-design"
import type { ProgressStyle, LabelFormat } from "../card-design"
import { generateStampGridImage, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } from "../strip-image"
import { uploadFile } from "../../storage"
import { getWalletRewardText, parseCouponConfig, formatCouponValue, parseMembershipConfig, parsePointsConfig, parsePrepaidConfig, parseGiftCardConfig, parseTicketConfig, parseAccessConfig, parseTransitConfig, parseBusinessIdConfig, getCheapestCatalogItem } from "../../pass-config"

// ─── Types ──────────────────────────────────────────────────

type GooglePassUpdateData = {
  passInstanceId: string
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

  // Type-dispatch: build type-specific loyalty points and text modules
  let loyaltyPoints: Record<string, unknown>
  let secondaryLoyaltyPoints: Record<string, unknown>
  let textModulesData: Record<string, unknown>[]

  const couponConfig = data.passType === "COUPON" ? parseCouponConfig(data.templateConfig) : null
  const membershipConfig = data.passType === "MEMBERSHIP" ? parseMembershipConfig(data.templateConfig) : null
  const pointsConfig = data.passType === "POINTS" ? parsePointsConfig(data.templateConfig) : null
  const prepaidConfig = data.passType === "PREPAID" ? parsePrepaidConfig(data.templateConfig) : null
  const giftCardConfig = data.passType === "GIFT_CARD" ? parseGiftCardConfig(data.templateConfig) : null
  const ticketConfig = data.passType === "TICKET" ? parseTicketConfig(data.templateConfig) : null
  const accessConfig = data.passType === "ACCESS" ? parseAccessConfig(data.templateConfig) : null
  const transitConfig = data.passType === "TRANSIT" ? parseTransitConfig(data.templateConfig) : null
  const businessIdConfig = data.passType === "BUSINESS_ID" ? parseBusinessIdConfig(data.templateConfig) : null

  if (data.passType === "COUPON" && couponConfig) {
    const isRedeemed = data.passInstanceStatus === "COMPLETED"
    const prizeText = getWalletRewardText(data.templateConfig, formatCouponValue(couponConfig))
    const hasPrizes = prizeText !== formatCouponValue(couponConfig)
    const discountLabel = isRedeemed ? "REDEEMED" : (data.revealedPrize ? "YOUR PRIZE" : (hasPrizes ? "PRIZES" : "DISCOUNT"))
    const discountValue = isRedeemed
      ? `${data.revealedPrize ?? prizeText} (Used)`
      : (data.revealedPrize ?? prizeText)
    loyaltyPoints = {
      label: formatLabel(discountLabel, labelFmt),
      balance: { string: discountValue },
    }
    const validUntilText = couponConfig.validUntil ? new Date(couponConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry"
    secondaryLoyaltyPoints = {
      label: formatLabel(isRedeemed ? "STATUS" : "VALID UNTIL", labelFmt),
      balance: { string: isRedeemed ? "Redeemed" : validUntilText },
    }
    textModulesData = [
      { id: "discount", header: formatLabel(discountLabel, labelFmt), body: discountValue },
      { id: "validUntil", header: formatLabel(isRedeemed ? "STATUS" : "VALID UNTIL", labelFmt), body: isRedeemed ? "Redeemed" : validUntilText },
      ...(couponConfig.couponCode ? [{ id: "couponCode", header: formatLabel("CODE", labelFmt), body: couponConfig.couponCode }] : []),
      { id: "memberSince", header: formatLabel("ADDED", labelFmt), body: memberSinceFormatted },
    ]
  } else if (data.passType === "MEMBERSHIP" && membershipConfig) {
    const isSuspended = data.passInstanceStatus === "SUSPENDED"
    const isExpired = data.passInstanceStatus === "EXPIRED"
    const statusText = isSuspended ? "Suspended" : isExpired ? "Expired" : "Active"
    loyaltyPoints = {
      label: formatLabel("TIER", labelFmt),
      balance: { string: membershipConfig.membershipTier },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("STATUS", labelFmt),
      balance: { string: statusText },
    }
    textModulesData = [
      { id: "tier", header: formatLabel("TIER", labelFmt), body: membershipConfig.membershipTier },
      { id: "status", header: formatLabel("STATUS", labelFmt), body: statusText },
      { id: "benefits", header: formatLabel("BENEFITS", labelFmt), body: membershipConfig.benefits },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  } else if (data.passType === "PREPAID" && prepaidConfig) {
    const remaining = data.remainingUses ?? 0
    loyaltyPoints = {
      label: formatLabel("REMAINING", labelFmt),
      balance: { string: `${remaining} / ${prepaidConfig.totalUses}` },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("USED", labelFmt),
      balance: { int: data.totalVisits },
    }
    textModulesData = [
      { id: "remaining", header: formatLabel(`${prepaidConfig.useLabel.toUpperCase()}S LEFT`, labelFmt), body: `${remaining} / ${prepaidConfig.totalUses}` },
      { id: "validUntil", header: formatLabel("VALID UNTIL", labelFmt), body: prepaidConfig.validUntil ? new Date(prepaidConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
      { id: "totalUsed", header: formatLabel("TOTAL USED", labelFmt), body: String(data.totalVisits) },
      { id: "memberSince", header: formatLabel("ADDED", labelFmt), body: memberSinceFormatted },
    ]
  } else if (data.passType === "POINTS" && pointsConfig) {
    loyaltyPoints = {
      label: formatLabel("POINTS", labelFmt),
      balance: { int: data.pointsBalance ?? 0 },
    }
    const cheapestItem = getCheapestCatalogItem(pointsConfig)
    secondaryLoyaltyPoints = cheapestItem
      ? { label: formatLabel("NEXT REWARD", labelFmt), balance: { string: `${cheapestItem.name} (${cheapestItem.pointsCost} pts)` } }
      : { label: formatLabel("TOTAL VISITS", labelFmt), balance: { int: data.totalVisits } }
    textModulesData = [
      { id: "earnRate", header: formatLabel("EARN RATE", labelFmt), body: `${pointsConfig.pointsPerVisit} points per visit` },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  } else if (data.passType === "GIFT_CARD" && giftCardConfig) {
    const balanceCents = data.giftBalanceCents ?? giftCardConfig.initialBalanceCents
    const balanceStr = `${giftCardConfig.currency} ${(balanceCents / 100).toFixed(2)}`
    const initialStr = `${giftCardConfig.currency} ${(giftCardConfig.initialBalanceCents / 100).toFixed(2)}`
    loyaltyPoints = { label: formatLabel("BALANCE", labelFmt), balance: { string: balanceStr } }
    secondaryLoyaltyPoints = { label: formatLabel("INITIAL VALUE", labelFmt), balance: { string: initialStr } }
    textModulesData = [
      { id: "balance", header: formatLabel("BALANCE", labelFmt), body: balanceStr },
      { id: "initialValue", header: formatLabel("INITIAL VALUE", labelFmt), body: initialStr },
    ]
  } else if (data.passType === "TICKET" && ticketConfig) {
    loyaltyPoints = { label: formatLabel("EVENT", labelFmt), balance: { string: ticketConfig.eventName } }
    secondaryLoyaltyPoints = { label: formatLabel("SCANS", labelFmt), balance: { string: `${data.ticketScanCount ?? 0} / ${ticketConfig.maxScans}` } }
    textModulesData = [
      { id: "eventDate", header: formatLabel("DATE", labelFmt), body: new Date(ticketConfig.eventDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) },
      { id: "venue", header: formatLabel("VENUE", labelFmt), body: ticketConfig.eventVenue },
      { id: "scans", header: formatLabel("SCANS", labelFmt), body: `${data.ticketScanCount ?? 0} / ${ticketConfig.maxScans}` },
      { id: "holder", header: formatLabel("HOLDER", labelFmt), body: data.contactName },
    ]
  } else if (data.passType === "ACCESS" && accessConfig) {
    loyaltyPoints = { label: formatLabel(accessConfig.accessLabel, labelFmt), balance: { string: "Active" } }
    secondaryLoyaltyPoints = { label: formatLabel("TOTAL GRANTED", labelFmt), balance: { int: data.accessTotalGranted ?? 0 } }
    textModulesData = [
      { id: "accessLabel", header: formatLabel(accessConfig.accessLabel, labelFmt), body: "Active" },
      { id: "totalGranted", header: formatLabel("TOTAL GRANTED", labelFmt), body: String(data.accessTotalGranted ?? 0) },
    ]
  } else if (data.passType === "TRANSIT" && transitConfig) {
    loyaltyPoints = { label: formatLabel("STATUS", labelFmt), balance: { string: data.transitIsBoarded ? "BOARDED" : "NOT BOARDED" } }
    secondaryLoyaltyPoints = { label: formatLabel("TYPE", labelFmt), balance: { string: transitConfig.transitType.toUpperCase() } }
    textModulesData = [
      { id: "origin", header: formatLabel("FROM", labelFmt), body: transitConfig.originName ?? "—" },
      { id: "destination", header: formatLabel("TO", labelFmt), body: transitConfig.destinationName ?? "—" },
      { id: "transitType", header: formatLabel("TYPE", labelFmt), body: transitConfig.transitType.toUpperCase() },
      { id: "boardingStatus", header: formatLabel("STATUS", labelFmt), body: data.transitIsBoarded ? "BOARDED" : "NOT BOARDED" },
    ]
  } else if (data.passType === "BUSINESS_ID" && businessIdConfig) {
    loyaltyPoints = { label: formatLabel(businessIdConfig.idLabel, labelFmt), balance: { string: data.contactName } }
    secondaryLoyaltyPoints = { label: formatLabel("VERIFICATIONS", labelFmt), balance: { int: data.businessIdVerifications ?? 0 } }
    textModulesData = [
      { id: "idLabel", header: formatLabel(businessIdConfig.idLabel, labelFmt), body: data.contactName },
      { id: "verifications", header: formatLabel("VERIFICATIONS", labelFmt), body: String(data.businessIdVerifications ?? 0) },
    ]
  } else {
    // STAMP_CARD (default)
    const progressValue = formatProgressValue(
      data.currentCycleVisits,
      data.visitsRequired,
      data.progressStyle,
      data.hasAvailableReward
    )
    const progressLabel = data.customProgressLabel
      ? data.customProgressLabel
      : data.hasAvailableReward ? "STATUS" : "PROGRESS"
    loyaltyPoints = {
      label: formatLabel(progressLabel, labelFmt),
      balance: { string: progressValue },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("TOTAL VISITS", labelFmt),
      balance: { int: data.totalVisits },
    }
    textModulesData = [
      {
        id: "nextReward",
        header: formatLabel(data.revealedPrize ? "YOUR PRIZE" : "NEXT REWARD", labelFmt),
        body: data.revealedPrize ?? data.rewardDescription,
      },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
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
  const visitsRequired = (templateConfig.visitsRequired as number) ?? 10
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

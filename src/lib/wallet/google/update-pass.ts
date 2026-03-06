import "server-only"

import { db } from "@/lib/db"
import { getAccessToken } from "./credentials"
import {
  GOOGLE_WALLET_API_BASE,
  GOOGLE_WALLET_ISSUER_ID,
  buildEnrollmentObjectId,
} from "./constants"
import { formatProgressValue, formatLabel, parseStripFilters, parseStampGridConfig } from "../card-design"
import type { ProgressStyle, LabelFormat } from "../card-design"
import { generateStampGridImage, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } from "../strip-image"
import { uploadFile } from "../../storage"
import { getWalletRewardText, parseCouponConfig, formatCouponValue, parseMembershipConfig, parsePointsConfig, parsePrepaidConfig, getCheapestCatalogItem } from "../../program-config"

// ─── Types ──────────────────────────────────────────────────

type GooglePassUpdateData = {
  enrollmentId: string
  customerName: string
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  pointsBalance: number
  hasAvailableReward: boolean
  rewardDescription: string
  revealedPrize: string | null
  restaurantName: string
  brandColor: string | null
  restaurantLogo: string | null
  programName: string
  memberSince: Date
  // Program type
  programType: string | null
  programConfig: unknown
  // Card design fields for formatting
  progressStyle: ProgressStyle
  labelFormat: LabelFormat
  customProgressLabel: string | null
  heroImageUrl?: string | null
  revealLink?: string | null
  remainingUses?: number
  // Enrollment status (for coupon redeemed display)
  enrollmentStatus?: string
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

  const objectId = buildEnrollmentObjectId(data.enrollmentId)
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

  const couponConfig = data.programType === "COUPON" ? parseCouponConfig(data.programConfig) : null
  const membershipConfig = data.programType === "MEMBERSHIP" ? parseMembershipConfig(data.programConfig) : null
  const pointsConfig = data.programType === "POINTS" ? parsePointsConfig(data.programConfig) : null
  const prepaidConfig = data.programType === "PREPAID" ? parsePrepaidConfig(data.programConfig) : null

  if (data.programType === "COUPON" && couponConfig) {
    const isRedeemed = data.enrollmentStatus === "COMPLETED"
    const prizeText = getWalletRewardText(data.programConfig, formatCouponValue(couponConfig))
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
  } else if (data.programType === "MEMBERSHIP" && membershipConfig) {
    const isSuspended = data.enrollmentStatus === "SUSPENDED"
    const isExpired = data.enrollmentStatus === "EXPIRED"
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
  } else if (data.programType === "PREPAID" && prepaidConfig) {
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
  } else if (data.programType === "POINTS" && pointsConfig) {
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
    accountName: data.customerName,
    textModulesData,
  }

  if (data.heroImageUrl) {
    patchBody.heroImage = {
      sourceUri: { uri: data.heroImageUrl },
      contentDescription: {
        defaultValue: { language: "en", value: data.restaurantName },
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
 * Notifies that an enrollment's Google Wallet pass needs updating.
 * Fetches current enrollment/customer/program/restaurant data and PATCHes the object.
 */
export async function notifyGooglePassUpdate(
  enrollmentId: string
): Promise<void> {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          createdAt: true,
          restaurant: {
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
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          programType: true,
          config: true,
          visitsRequired: true,
          rewardDescription: true,
          cardDesign: {
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

  if (!enrollment || enrollment.walletPassType !== "GOOGLE") return

  const cardDesign = enrollment.loyaltyProgram.cardDesign
  const hasAvailableReward = enrollment.rewards.some((r) => r.status === "AVAILABLE")
  const revealedReward = enrollment.rewards.find((r) => r.revealedAt !== null && r.description)

  try {
    // Generate stamp grid hero image if applicable
    let heroImageUrl: string | null = null
    const isStampCard = !enrollment.loyaltyProgram.programType || enrollment.loyaltyProgram.programType === "STAMP_CARD"
    if (isStampCard && cardDesign?.showStrip !== false) {
      const stripFilters = parseStripFilters(cardDesign?.editorConfig)
      const isStampGrid = stripFilters.useStampGrid || cardDesign?.patternStyle === "STAMP_GRID"
      if (isStampGrid) {
        try {
          const config = parseStampGridConfig(cardDesign?.editorConfig)
          const stripPrimary = stripFilters.stripColor1 ?? cardDesign?.primaryColor ?? "#1a1a2e"
          const stripSecondary = stripFilters.stripColor2 ?? cardDesign?.secondaryColor ?? "#ffffff"
          const buffer = await generateStampGridImage({
            currentVisits: enrollment.currentCycleVisits,
            totalVisits: enrollment.loyaltyProgram.visitsRequired,
            hasReward: hasAvailableReward,
            config,
            primaryColor: stripPrimary,
            secondaryColor: stripSecondary,
            textColor: cardDesign?.textColor ?? "#ffffff",
            width: GOOGLE_HERO_WIDTH,
            height: GOOGLE_HERO_HEIGHT,
            stripImageUrl: cardDesign?.stripImageGoogle,
            stripOpacity: stripFilters.stripOpacity,
            stripGrayscale: stripFilters.stripGrayscale,
          })
          const key = `strip-images/${enrollment.loyaltyProgram.id}/google-stamp-grid-${enrollment.id}.png`
          heroImageUrl = await uploadFile(buffer, key, "image/png")
        } catch (err) {
          console.error("Failed to generate stamp grid:", err instanceof Error ? err.message : err)
        }
      }
    }

    // Build reveal link if there's an unrevealed prize
    let revealLink: string | null = null
    const unrevealedReward = enrollment.rewards.find(
      (r) => r.revealedAt === null && r.description != null
    )
    if (unrevealedReward) {
      const { signCardAccess } = await import("../../card-access")
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
      const slug = enrollment.customer.restaurant.slug
      const sig = signCardAccess(enrollment.id)
      revealLink = `${baseUrl}/join/${slug}/card/${enrollment.id}?sig=${sig}`
    }

    await patchGoogleWalletObject({
      enrollmentId: enrollment.id,
      customerName: enrollment.customer.fullName,
      currentCycleVisits: enrollment.currentCycleVisits,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
      totalVisits: enrollment.totalVisits,
      pointsBalance: enrollment.pointsBalance ?? 0,
      remainingUses: enrollment.remainingUses ?? 0,
      hasAvailableReward,
      rewardDescription: getWalletRewardText(enrollment.loyaltyProgram.config, enrollment.loyaltyProgram.rewardDescription),
      revealedPrize: revealedReward?.description ?? null,
      restaurantName: enrollment.customer.restaurant.name,
      brandColor: enrollment.customer.restaurant.brandColor,
      restaurantLogo: enrollment.customer.restaurant.logo,
      programName: enrollment.loyaltyProgram.name,
      memberSince: enrollment.customer.createdAt,
      programType: enrollment.loyaltyProgram.programType,
      programConfig: enrollment.loyaltyProgram.config,
      progressStyle: (cardDesign?.progressStyle as ProgressStyle) ?? "NUMBERS",
      labelFormat: (cardDesign?.labelFormat as LabelFormat) ?? "UPPERCASE",
      customProgressLabel: cardDesign?.customProgressLabel ?? null,
      heroImageUrl,
      revealLink,
      enrollmentStatus: enrollment.status,
    })
  } catch (error) {
    console.error("Failed to update Google Wallet pass:", error instanceof Error ? error.message : "Unknown error")
  }

  // Log the update
  await db.walletPassLog.create({
    data: {
      enrollmentId,
      action: "UPDATED",
      details: { trigger: "data_change", platform: "google" },
    },
  })
}

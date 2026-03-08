import http2 from "node:http2"
import { task, AbortTaskRunError } from "@trigger.dev/sdk"
import { walletUpdatesQueue } from "./queues"
import { createDb } from "./db"

// ─── Types ──────────────────────────────────────────────────

type UpdateWalletPassPayload = {
  passInstanceId: string
  updateType: "VISIT" | "REWARD_EARNED" | "REWARD_REDEEMED" | "REWARD_EXPIRED" | "DESIGN_CHANGE" | "TEMPLATE_CHANGE" | "PASS_INSTANCE_SUSPENDED" | "CHECK_IN" | "POINTS_EARNED" | "POINTS_REDEEMED" | "PREPAID_USE" | "PREPAID_RECHARGE" | "GIFT_CHARGE" | "GIFT_REFUND" | "TICKET_SCAN" | "TICKET_VOID" | "ACCESS_GRANT" | "ACCESS_DENY" | "TRANSIT_BOARD" | "TRANSIT_EXIT" | "ID_VERIFY"
}

// ─── Task ───────────────────────────────────────────────────

export const updateWalletPassTask = task({
  id: "update-wallet-pass",
  queue: walletUpdatesQueue,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: UpdateWalletPassPayload) => {
    const db = createDb()

    try {
      const passInstance = await db.passInstance.findUnique({
        where: { id: payload.passInstanceId },
        select: {
          id: true,
          data: true,
          issuedAt: true,
          updatedAt: true,
          walletPassId: true,
          walletPassSerialNumber: true,
          walletProvider: true,
          status: true,
          contact: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          passTemplate: {
            select: {
              id: true,
              name: true,
              passType: true,
              config: true,
              termsAndConditions: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  brandColor: true,
                  secondaryColor: true,
                  logo: true,
                  logoApple: true,
                  logoGoogle: true,
                  phone: true,
                  website: true,
                },
              },
              passDesign: true,
            },
          },
          rewards: {
            where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
            select: { id: true, status: true, revealedAt: true, description: true },
          },
          deviceRegistrations: {
            select: { pushToken: true },
          },
        },
      })

      if (!passInstance) {
        throw new AbortTaskRunError(`PassInstance ${payload.passInstanceId} not found`)
      }

      if (passInstance.walletProvider === "NONE") {
        return { skipped: true, reason: "no_wallet_pass" }
      }

      const template = passInstance.passTemplate
      const passDesign = template.passDesign

      // Extract data from PassInstance.data JSON
      const instanceData = (passInstance.data ?? {}) as Record<string, unknown>
      const currentCycleVisits = (instanceData.currentCycleVisits as number) ?? 0
      const totalVisits = (instanceData.totalVisits as number) ?? 0
      const pointsBalance = (instanceData.pointsBalance as number) ?? 0
      const remainingUses = (instanceData.remainingUses as number) ?? 0

      // Extract config from PassTemplate.config JSON
      const templateConfig = (template.config ?? {}) as Record<string, unknown>
      const visitsRequired = (templateConfig.stampsRequired as number) ?? 10
      const rewardDescription = (templateConfig.rewardDescription as string) ?? ""
      const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 30

      const hasAvailableReward = passInstance.rewards.some(
        (r: { status: string }) => r.status === "AVAILABLE"
      )
      const unrevealedReward = passInstance.rewards.find(
        (r: { revealedAt: Date | null; description: string | null }) => r.revealedAt === null && r.description != null
      )
      const revealedReward = passInstance.rewards.find(
        (r: { revealedAt: Date | null; description: string | null }) => r.revealedAt !== null && r.description != null
      )

      if (passInstance.walletProvider === "APPLE" && passInstance.walletPassSerialNumber) {
        // ── Apple Wallet: Touch updatedAt + send APNs push ──
        await db.passInstance.update({
          where: { id: passInstance.id },
          data: { updatedAt: new Date() },
        })

        // Send APNs push to all registered devices
        const pushTokens = passInstance.deviceRegistrations.map(
          (d: { pushToken: string }) => d.pushToken
        )
        let pushResult = { sent: 0, failed: 0 }

        if (pushTokens.length > 0) {
          pushResult = await sendApnsPush(pushTokens)
        }

        // Log the update
        await db.walletPassLog.create({
          data: {
            passInstanceId: passInstance.id,
            action: pushTokens.length > 0 ? "PUSH_SENT" : "UPDATED",
            details: {
              trigger: payload.updateType,
              platform: "apple",
              devicesNotified: pushTokens.length,
              pushSent: pushResult.sent,
              pushFailed: pushResult.failed,
            },
          },
        })

        return {
          platform: "apple",
          devicesNotified: pushTokens.length,
          pushSent: pushResult.sent,
          pushFailed: pushResult.failed,
        }
      } else if (passInstance.walletProvider === "GOOGLE") {
        // ── Google Wallet: PATCH the loyalty object via REST API ──
        const result = await patchGooglePass(
          { ...passInstance, data: instanceData, currentCycleVisits, totalVisits, pointsBalance },
          { ...template, visitsRequired, rewardDescription },
          hasAvailableReward,
          payload.updateType,
          passDesign,
          !!unrevealedReward,
          revealedReward?.description ?? null
        )

        // Log the update
        await db.walletPassLog.create({
          data: {
            passInstanceId: passInstance.id,
            action: "UPDATED",
            details: {
              trigger: payload.updateType,
              platform: "google",
              status: result.status,
            },
          },
        })

        return { platform: "google", status: result.status }
      }

      return { skipped: true, reason: "unknown_wallet_type" }
    } finally {
      await db.$disconnect()
    }
  },
})

// ─── Google Wallet PATCH ────────────────────────────────────

type PassInstanceForGoogle = {
  id: string
  status: string
  data: Record<string, unknown>
  currentCycleVisits: number
  totalVisits: number
  pointsBalance: number
  issuedAt: Date
  contact: {
    fullName: string
  }
  passTemplate: {
    id: string
    organization: {
      slug: string
      brandColor: string | null
    }
  }
}

type TemplateForGoogle = {
  id: string
  name: string
  passType?: string
  config?: unknown
  visitsRequired: number
  rewardDescription: string
}

type PassDesignRow = {
  primaryColor: string | null
  stripImageGoogle: string | null
  generatedStripGoogle: string | null
  patternStyle: string
  showStrip: boolean
  progressStyle: string
  labelFormat: string
  customProgressLabel: string | null
  editorConfig: unknown
} | null

async function patchGooglePass(
  passInstance: PassInstanceForGoogle,
  template: TemplateForGoogle,
  hasAvailableReward: boolean,
  updateType: string,
  passDesign?: PassDesignRow,
  hasUnrevealedPrize?: boolean,
  revealedPrize?: string | null
): Promise<{ status: number }> {
  const { getAccessToken } = await import("@/lib/wallet/google/credentials")
  const {
    GOOGLE_WALLET_API_BASE,
    GOOGLE_WALLET_ISSUER_ID,
    buildEnrollmentObjectId,
    buildProgramClassId,
  } = await import("@/lib/wallet/google/constants")

  if (!GOOGLE_WALLET_ISSUER_ID) {
    return { status: 0 }
  }

  const objectId = buildEnrollmentObjectId(passInstance.id)
  const token = await getAccessToken()

  const { formatProgressValue, formatLabel } = await import("@/lib/wallet/card-design")
  const { parseCouponConfig, formatCouponValue, parseMembershipConfig, parsePointsConfig, parsePrepaidConfig, parseGiftCardConfig, parseTicketConfig, parseAccessConfig, parseTransitConfig, parseBusinessIdConfig, getCheapestCatalogItem, getWalletRewardText } = await import("@/lib/pass-config")
  type ProgressStyle = import("@/lib/wallet/card-design").ProgressStyle
  type LabelFormat = import("@/lib/wallet/card-design").LabelFormat

  const progressStyle = (passDesign?.progressStyle ?? "NUMBERS") as ProgressStyle
  const labelFmt = (passDesign?.labelFormat ?? "UPPERCASE") as LabelFormat

  const memberSinceFormatted = passInstance.issuedAt.toLocaleDateString(
    "en-US",
    { month: "short", year: "numeric" }
  )

  // Type-dispatch: build type-specific loyalty points and text modules
  let loyaltyPoints: Record<string, unknown>
  let secondaryLoyaltyPoints: Record<string, unknown>
  let textModulesData: Record<string, unknown>[]

  const couponConfig = template.passType === "COUPON" ? parseCouponConfig(template.config) : null
  const membershipConfig = template.passType === "MEMBERSHIP" ? parseMembershipConfig(template.config) : null
  const pointsConfig = template.passType === "POINTS" ? parsePointsConfig(template.config) : null
  const prepaidConfig = template.passType === "PREPAID" ? parsePrepaidConfig(template.config) : null
  const giftCardConfig = template.passType === "GIFT_CARD" ? parseGiftCardConfig(template.config) : null
  const ticketConfig = template.passType === "TICKET" ? parseTicketConfig(template.config) : null
  const accessConfig = template.passType === "ACCESS" ? parseAccessConfig(template.config) : null
  const transitConfig = template.passType === "TRANSIT" ? parseTransitConfig(template.config) : null
  const businessIdConfig = template.passType === "BUSINESS_ID" ? parseBusinessIdConfig(template.config) : null

  if (template.passType === "COUPON" && couponConfig) {
    // Show revealed prize, prize names (if minigame), or generic discount
    const isRedeemed = passInstance.status === "COMPLETED"
    const prizeText = getWalletRewardText(template.config, formatCouponValue(couponConfig))
    const hasPrizes = prizeText !== formatCouponValue(couponConfig)
    const discountLabel = isRedeemed ? "REDEEMED" : (revealedPrize ? "YOUR PRIZE" : (hasPrizes ? "PRIZES" : "DISCOUNT"))
    const discountValue = isRedeemed
      ? `${revealedPrize ?? prizeText} (Used)`
      : (revealedPrize ?? prizeText)
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
  } else if (template.passType === "MEMBERSHIP" && membershipConfig) {
    loyaltyPoints = {
      label: formatLabel("TIER", labelFmt),
      balance: { string: membershipConfig.membershipTier },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("CHECK-INS", labelFmt),
      balance: { int: passInstance.totalVisits },
    }
    textModulesData = [
      { id: "benefits", header: formatLabel("BENEFITS", labelFmt), body: membershipConfig.benefits },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  } else if (template.passType === "POINTS" && pointsConfig) {
    loyaltyPoints = {
      label: formatLabel("POINTS", labelFmt),
      balance: { int: passInstance.pointsBalance ?? 0 },
    }
    const cheapestItem = getCheapestCatalogItem(pointsConfig)
    secondaryLoyaltyPoints = cheapestItem
      ? { label: formatLabel("NEXT REWARD", labelFmt), balance: { string: `${cheapestItem.name} (${cheapestItem.pointsCost} pts)` } }
      : { label: formatLabel("TOTAL VISITS", labelFmt), balance: { int: passInstance.totalVisits } }
    textModulesData = [
      { id: "earnRate", header: formatLabel("EARN RATE", labelFmt), body: `${pointsConfig.pointsPerVisit} points per visit` },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  } else if (template.passType === "PREPAID" && prepaidConfig) {
    const remaining = (passInstance.data.remainingUses as number) ?? 0
    loyaltyPoints = { label: formatLabel("REMAINING", labelFmt), balance: { string: `${remaining} / ${prepaidConfig.totalUses}` } }
    secondaryLoyaltyPoints = { label: formatLabel("USED", labelFmt), balance: { int: passInstance.totalVisits } }
    textModulesData = [
      { id: "remaining", header: formatLabel(`${prepaidConfig.useLabel.toUpperCase()}S LEFT`, labelFmt), body: `${remaining} / ${prepaidConfig.totalUses}` },
      { id: "validUntil", header: formatLabel("VALID UNTIL", labelFmt), body: prepaidConfig.validUntil ? new Date(prepaidConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry" },
      { id: "totalUsed", header: formatLabel("TOTAL USED", labelFmt), body: String(passInstance.totalVisits) },
      { id: "memberSince", header: formatLabel("ADDED", labelFmt), body: memberSinceFormatted },
    ]
  } else if (template.passType === "GIFT_CARD" && giftCardConfig) {
    const balanceCents = (passInstance.data.balanceCents as number) ?? giftCardConfig.initialBalanceCents
    const balanceStr = `${giftCardConfig.currency} ${(balanceCents / 100).toFixed(2)}`
    const initialStr = `${giftCardConfig.currency} ${(giftCardConfig.initialBalanceCents / 100).toFixed(2)}`
    loyaltyPoints = { label: formatLabel("BALANCE", labelFmt), balance: { string: balanceStr } }
    secondaryLoyaltyPoints = { label: formatLabel("INITIAL VALUE", labelFmt), balance: { string: initialStr } }
    textModulesData = [
      { id: "balance", header: formatLabel("BALANCE", labelFmt), body: balanceStr },
      { id: "initialValue", header: formatLabel("INITIAL VALUE", labelFmt), body: initialStr },
    ]
  } else if (template.passType === "TICKET" && ticketConfig) {
    const scanCount = (passInstance.data.scanCount as number) ?? 0
    loyaltyPoints = { label: formatLabel("EVENT", labelFmt), balance: { string: ticketConfig.eventName } }
    secondaryLoyaltyPoints = { label: formatLabel("SCANS", labelFmt), balance: { string: `${scanCount} / ${ticketConfig.maxScans}` } }
    textModulesData = [
      { id: "eventDate", header: formatLabel("DATE", labelFmt), body: new Date(ticketConfig.eventDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) },
      { id: "venue", header: formatLabel("VENUE", labelFmt), body: ticketConfig.eventVenue },
      { id: "scans", header: formatLabel("SCANS", labelFmt), body: `${scanCount} / ${ticketConfig.maxScans}` },
      { id: "holder", header: formatLabel("HOLDER", labelFmt), body: passInstance.contact.fullName },
    ]
  } else if (template.passType === "ACCESS" && accessConfig) {
    const totalGranted = (passInstance.data.totalGranted as number) ?? 0
    loyaltyPoints = { label: formatLabel(accessConfig.accessLabel, labelFmt), balance: { string: "Active" } }
    secondaryLoyaltyPoints = { label: formatLabel("TOTAL GRANTED", labelFmt), balance: { int: totalGranted } }
    textModulesData = [
      { id: "accessLabel", header: formatLabel(accessConfig.accessLabel, labelFmt), body: "Active" },
      { id: "totalGranted", header: formatLabel("TOTAL GRANTED", labelFmt), body: String(totalGranted) },
    ]
  } else if (template.passType === "TRANSIT" && transitConfig) {
    const isBoarded = (passInstance.data.isBoarded as boolean) ?? false
    loyaltyPoints = { label: formatLabel("STATUS", labelFmt), balance: { string: isBoarded ? "BOARDED" : "NOT BOARDED" } }
    secondaryLoyaltyPoints = { label: formatLabel("TYPE", labelFmt), balance: { string: transitConfig.transitType.toUpperCase() } }
    textModulesData = [
      { id: "origin", header: formatLabel("FROM", labelFmt), body: transitConfig.originName ?? "—" },
      { id: "destination", header: formatLabel("TO", labelFmt), body: transitConfig.destinationName ?? "—" },
      { id: "transitType", header: formatLabel("TYPE", labelFmt), body: transitConfig.transitType.toUpperCase() },
      { id: "boardingStatus", header: formatLabel("STATUS", labelFmt), body: isBoarded ? "BOARDED" : "NOT BOARDED" },
    ]
  } else if (template.passType === "BUSINESS_ID" && businessIdConfig) {
    const verifications = (passInstance.data.totalVerifications as number) ?? 0
    loyaltyPoints = { label: formatLabel(businessIdConfig.idLabel, labelFmt), balance: { string: passInstance.contact.fullName } }
    secondaryLoyaltyPoints = { label: formatLabel("VERIFICATIONS", labelFmt), balance: { int: verifications } }
    textModulesData = [
      { id: "idLabel", header: formatLabel(businessIdConfig.idLabel, labelFmt), body: passInstance.contact.fullName },
      { id: "verifications", header: formatLabel("VERIFICATIONS", labelFmt), body: String(verifications) },
    ]
  } else {
    // STAMP_CARD (default)
    const progressValue = formatProgressValue(
      passInstance.currentCycleVisits,
      template.visitsRequired,
      progressStyle,
      hasAvailableReward
    )
    const progressLabel = passDesign?.customProgressLabel
      ? passDesign.customProgressLabel
      : hasAvailableReward ? "STATUS" : "PROGRESS"

    loyaltyPoints = {
      label: formatLabel(progressLabel, labelFmt),
      balance: { string: progressValue },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("TOTAL VISITS", labelFmt),
      balance: { int: passInstance.totalVisits },
    }
    textModulesData = [
      {
        id: "nextReward",
        header: formatLabel(revealedPrize ? "YOUR PRIZE" : "NEXT REWARD", labelFmt),
        body: revealedPrize ?? getWalletRewardText(template.config, template.rewardDescription),
      },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  }

  const patchBody: Record<string, unknown> = {
    classId: buildProgramClassId(template.id),
    loyaltyPoints,
    secondaryLoyaltyPoints,
    accountName: passInstance.contact.fullName,
    textModulesData,
  }

  // Add reveal link if there's an unrevealed prize, clear it otherwise
  if (hasUnrevealedPrize && passInstance.passTemplate.organization.slug) {
    const { signCardAccess } = await import("@/lib/card-access")
    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
    const slug = passInstance.passTemplate.organization.slug
    const sig = signCardAccess(passInstance.id)
    const cardPageUrl = `${baseUrl}/join/${slug}/card/${passInstance.id}?sig=${sig}`
    patchBody.linksModuleData = {
      uris: [{
        uri: cardPageUrl,
        description: "Reveal your prize!",
        id: "revealLink",
      }],
    }
  } else {
    patchBody.linksModuleData = { uris: [] }
  }

  // Stamp grid hero image: only for STAMP_CARD templates
  const isStampCard = !template.passType || template.passType === "STAMP_CARD"
  const { parseStripFilters, parseStampGridConfig } = await import("@/lib/wallet/card-design")
  const triggerStripFilters = parseStripFilters(passDesign?.editorConfig)
  const isTriggerStampGrid = triggerStripFilters.useStampGrid || passDesign?.patternStyle === "stamp_grid" || passDesign?.patternStyle === "STAMP_GRID"
  if (isStampCard && isTriggerStampGrid && passDesign?.showStrip !== false) {
    const stampGridUrl = await generateStampGridToR2(
      { id: passInstance.id, currentCycleVisits: passInstance.currentCycleVisits },
      { id: template.id, visitsRequired: template.visitsRequired },
      passDesign ?? null,
      triggerStripFilters,
      hasAvailableReward
    )
    if (stampGridUrl) {
      patchBody.heroImage = {
        sourceUri: { uri: stampGridUrl },
        contentDescription: {
          defaultValue: { language: "en", value: "Stamp progress" },
        },
      }
    }
  }

  // For design changes, also update hero image (stamp card only for stamp grid)
  if (updateType === "DESIGN_CHANGE" || updateType === "TEMPLATE_CHANGE") {
    if (isStampCard && isTriggerStampGrid && passDesign?.showStrip !== false) {
      const stampGridUrl = await generateStampGridToR2(
        { id: passInstance.id, currentCycleVisits: passInstance.currentCycleVisits },
        { id: template.id, visitsRequired: template.visitsRequired },
        passDesign ?? null,
        triggerStripFilters,
        hasAvailableReward
      )
      if (stampGridUrl) {
        patchBody.heroImage = {
          sourceUri: { uri: stampGridUrl },
          contentDescription: {
            defaultValue: { language: "en", value: "Stamp progress" },
          },
        }
      }
    } else {
      const heroUrl = passDesign?.stripImageGoogle ?? passDesign?.generatedStripGoogle
      if (heroUrl && passDesign?.showStrip !== false) {
        patchBody.heroImage = {
          sourceUri: { uri: heroUrl },
          contentDescription: {
            defaultValue: { language: "en", value: "Card design" },
          },
        }
      }
    }
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
    const errorText = await response.text()
    throw new Error(`Google Wallet PATCH failed (${response.status}): ${errorText}`)
  }

  return { status: response.status }
}

// ─── Stamp Grid -> R2 Upload (for Google Wallet PATCH) ──────

async function generateStampGridToR2(
  passInstance: { id: string; currentCycleVisits: number },
  template: { id: string; visitsRequired: number },
  passDesign: PassDesignRow,
  stripFilters: Awaited<ReturnType<typeof import("@/lib/wallet/card-design").parseStripFilters>>,
  hasAvailableReward: boolean,
): Promise<string | null> {
  try {
    const { parseStampGridConfig } = await import("@/lib/wallet/card-design")
    const { generateStampGridImage, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } = await import("@/lib/wallet/strip-image")
    const { uploadFile } = await import("@/lib/storage")

    const config = parseStampGridConfig(passDesign?.editorConfig)
    const stripPrimary = stripFilters.stripColor1 ?? passDesign?.primaryColor ?? "#1a1a2e"
    const stripSecondary = stripFilters.stripColor2 ?? (passDesign as Record<string, unknown>)?.secondaryColor as string ?? "#ffffff"

    const buffer = await generateStampGridImage({
      currentVisits: passInstance.currentCycleVisits,
      totalVisits: template.visitsRequired,
      hasReward: hasAvailableReward,
      config,
      primaryColor: stripPrimary,
      secondaryColor: stripSecondary,
      textColor: (passDesign as Record<string, unknown>)?.textColor as string ?? "#ffffff",
      width: GOOGLE_HERO_WIDTH,
      height: GOOGLE_HERO_HEIGHT,
      stripImageUrl: passDesign?.stripImageGoogle,
      stripOpacity: stripFilters.stripOpacity,
      stripGrayscale: stripFilters.stripGrayscale,
    })

    const key = `strip-images/${template.id}/google-stamp-grid-${passInstance.id}.png`
    return await uploadFile(buffer, key, "image/png")
  } catch (err) {
    console.error("Failed to generate stamp grid for R2:", err instanceof Error ? err.message : err)
    return null
  }
}

// ─── APNs Push ──────────────────────────────────────────────

/**
 * Sends empty push notifications to Apple Wallet via APNs HTTP/2.
 * Apple Wallet passes use empty pushes — the OS fetches the updated
 * pass from the webServiceURL when it receives the notification.
 */
async function sendApnsPush(
  pushTokens: string[]
): Promise<{ sent: number; failed: number }> {
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER
  if (!passTypeIdentifier) {
    return { sent: 0, failed: pushTokens.length }
  }

  const certB64 = process.env.APPLE_PASS_CERTIFICATE
  const keyB64 = process.env.APPLE_PASS_KEY
  const keyPassphrase = process.env.APPLE_PASS_KEY_PASSPHRASE ?? ""

  if (!certB64 || !keyB64) {
    return { sent: 0, failed: pushTokens.length }
  }

  const cert = Buffer.from(certB64, "base64")
  const key = Buffer.from(keyB64, "base64")
  const apnsHost = process.env.APNS_HOST ?? "api.push.apple.com"

  let sent = 0
  let failed = 0

  // Create a single HTTP/2 session for all pushes
  const session = http2.connect(`https://${apnsHost}`, {
    cert,
    key,
    passphrase: keyPassphrase,
  })

  try {
    for (const pushToken of pushTokens) {
      try {
        const statusCode = await new Promise<number>((resolve, reject) => {
          const req = session.request({
            ":method": "POST",
            ":path": `/3/device/${pushToken}`,
            "apns-topic": passTypeIdentifier,
            "apns-push-type": "background",
            "apns-priority": "5",
          })

          req.on("response", (headers) => {
            resolve(Number(headers[":status"]) || 0)
          })

          req.on("error", reject)
          req.end("{}")
        })

        if (statusCode === 200) {
          sent++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }
  } finally {
    session.close()
  }

  return { sent, failed }
}

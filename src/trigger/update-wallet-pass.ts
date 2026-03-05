import http2 from "node:http2"
import { task, AbortTaskRunError } from "@trigger.dev/sdk"
import { walletUpdatesQueue } from "./queues"
import { createDb } from "./db"

// ─── Types ──────────────────────────────────────────────────

type UpdateWalletPassPayload = {
  enrollmentId: string
  updateType: "VISIT" | "REWARD_EARNED" | "REWARD_REDEEMED" | "REWARD_EXPIRED" | "DESIGN_CHANGE" | "PROGRAM_CHANGE" | "ENROLLMENT_FROZEN" | "CHECK_IN" | "POINTS_EARNED" | "POINTS_REDEEMED"
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
      const enrollment = await db.enrollment.findUnique({
        where: { id: payload.enrollmentId },
        select: {
          id: true,
          currentCycleVisits: true,
          totalVisits: true,
          pointsBalance: true,
          enrolledAt: true,
          updatedAt: true,
          walletPassId: true,
          walletPassSerialNumber: true,
          walletPassType: true,
          status: true,
          customer: {
            select: {
              id: true,
              fullName: true,
              email: true,
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
              rewardExpiryDays: true,
              termsAndConditions: true,
              restaurant: {
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
              cardDesign: true,
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

      if (!enrollment) {
        throw new AbortTaskRunError(`Enrollment ${payload.enrollmentId} not found`)
      }

      if (enrollment.walletPassType === "NONE") {
        return { skipped: true, reason: "no_wallet_pass" }
      }

      const program = enrollment.loyaltyProgram
      const cardDesign = program.cardDesign
      const hasAvailableReward = enrollment.rewards.some(
        (r: { status: string }) => r.status === "AVAILABLE"
      )
      const unrevealedReward = enrollment.rewards.find(
        (r: { revealedAt: Date | null; description: string | null }) => r.revealedAt === null && r.description != null
      )
      const revealedReward = enrollment.rewards.find(
        (r: { revealedAt: Date | null; description: string | null }) => r.revealedAt !== null && r.description != null
      )

      if (enrollment.walletPassType === "APPLE" && enrollment.walletPassSerialNumber) {
        // ── Apple Wallet: Touch updatedAt + send APNs push ──
        await db.enrollment.update({
          where: { id: enrollment.id },
          data: { updatedAt: new Date() },
        })

        // Send APNs push to all registered devices
        const pushTokens = enrollment.deviceRegistrations.map(
          (d: { pushToken: string }) => d.pushToken
        )
        let pushResult = { sent: 0, failed: 0 }

        if (pushTokens.length > 0) {
          pushResult = await sendApnsPush(pushTokens)
        }

        // Log the update
        await db.walletPassLog.create({
          data: {
            enrollmentId: enrollment.id,
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
      } else if (enrollment.walletPassType === "GOOGLE") {
        // ── Google Wallet: PATCH the loyalty object via REST API ──
        const result = await patchGooglePass(
          enrollment,
          program,
          hasAvailableReward,
          payload.updateType,
          cardDesign,
          !!unrevealedReward,
          revealedReward?.description ?? null
        )

        // Log the update
        await db.walletPassLog.create({
          data: {
            enrollmentId: enrollment.id,
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

type EnrollmentForGoogle = {
  id: string
  status: string
  currentCycleVisits: number
  totalVisits: number
  pointsBalance: number
  enrolledAt: Date
  customer: {
    fullName: string
  }
  loyaltyProgram: {
    id: string
    restaurant: {
      slug: string
      brandColor: string | null
    }
  }
}

type ProgramForGoogle = {
  id: string
  name: string
  programType?: string
  config?: unknown
  visitsRequired: number
  rewardDescription: string
}

type CardDesignRow = {
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
  enrollment: EnrollmentForGoogle,
  program: ProgramForGoogle,
  hasAvailableReward: boolean,
  updateType: string,
  cardDesign?: CardDesignRow,
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

  const objectId = buildEnrollmentObjectId(enrollment.id)
  const token = await getAccessToken()

  const { formatProgressValue, formatLabel } = await import("@/lib/wallet/card-design")
  const { parseCouponConfig, formatCouponValue, parseMembershipConfig, parsePointsConfig, getCheapestCatalogItem, getWalletRewardText } = await import("@/lib/program-config")
  type ProgressStyle = import("@/lib/wallet/card-design").ProgressStyle
  type LabelFormat = import("@/lib/wallet/card-design").LabelFormat

  const progressStyle = (cardDesign?.progressStyle ?? "NUMBERS") as ProgressStyle
  const labelFmt = (cardDesign?.labelFormat ?? "UPPERCASE") as LabelFormat

  const memberSinceFormatted = enrollment.enrolledAt.toLocaleDateString(
    "en-US",
    { month: "short", year: "numeric" }
  )

  // Type-dispatch: build type-specific loyalty points and text modules
  let loyaltyPoints: Record<string, unknown>
  let secondaryLoyaltyPoints: Record<string, unknown>
  let textModulesData: Record<string, unknown>[]

  const couponConfig = program.programType === "COUPON" ? parseCouponConfig(program.config) : null
  const membershipConfig = program.programType === "MEMBERSHIP" ? parseMembershipConfig(program.config) : null
  const pointsConfig = program.programType === "POINTS" ? parsePointsConfig(program.config) : null

  if (program.programType === "COUPON" && couponConfig) {
    // Show revealed prize, prize names (if minigame), or generic discount
    const isRedeemed = enrollment.status === "COMPLETED"
    const prizeText = getWalletRewardText(program.config, formatCouponValue(couponConfig))
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
  } else if (program.programType === "MEMBERSHIP" && membershipConfig) {
    loyaltyPoints = {
      label: formatLabel("TIER", labelFmt),
      balance: { string: membershipConfig.membershipTier },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("CHECK-INS", labelFmt),
      balance: { int: enrollment.totalVisits },
    }
    textModulesData = [
      { id: "benefits", header: formatLabel("BENEFITS", labelFmt), body: membershipConfig.benefits },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  } else if (program.programType === "POINTS" && pointsConfig) {
    loyaltyPoints = {
      label: formatLabel("POINTS", labelFmt),
      balance: { int: enrollment.pointsBalance ?? 0 },
    }
    const cheapestItem = getCheapestCatalogItem(pointsConfig)
    secondaryLoyaltyPoints = cheapestItem
      ? { label: formatLabel("NEXT REWARD", labelFmt), balance: { string: `${cheapestItem.name} (${cheapestItem.pointsCost} pts)` } }
      : { label: formatLabel("TOTAL VISITS", labelFmt), balance: { int: enrollment.totalVisits } }
    textModulesData = [
      { id: "earnRate", header: formatLabel("EARN RATE", labelFmt), body: `${pointsConfig.pointsPerVisit} points per visit` },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  } else {
    // STAMP_CARD (default)
    const progressValue = formatProgressValue(
      enrollment.currentCycleVisits,
      program.visitsRequired,
      progressStyle,
      hasAvailableReward
    )
    const progressLabel = cardDesign?.customProgressLabel
      ? cardDesign.customProgressLabel
      : hasAvailableReward ? "STATUS" : "PROGRESS"

    loyaltyPoints = {
      label: formatLabel(progressLabel, labelFmt),
      balance: { string: progressValue },
    }
    secondaryLoyaltyPoints = {
      label: formatLabel("TOTAL VISITS", labelFmt),
      balance: { int: enrollment.totalVisits },
    }
    textModulesData = [
      {
        id: "nextReward",
        header: formatLabel(revealedPrize ? "YOUR PRIZE" : "NEXT REWARD", labelFmt),
        body: revealedPrize ?? getWalletRewardText(program.config, program.rewardDescription),
      },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ]
  }

  const patchBody: Record<string, unknown> = {
    classId: buildProgramClassId(program.id),
    loyaltyPoints,
    secondaryLoyaltyPoints,
    accountName: enrollment.customer.fullName,
    textModulesData,
  }

  // Add reveal link if there's an unrevealed prize, clear it otherwise
  if (hasUnrevealedPrize && enrollment.loyaltyProgram.restaurant.slug) {
    const { signCardAccess } = await import("@/lib/card-access")
    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
    const slug = enrollment.loyaltyProgram.restaurant.slug
    const sig = signCardAccess(enrollment.id)
    const cardPageUrl = `${baseUrl}/join/${slug}/card/${enrollment.id}?sig=${sig}`
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

  // Stamp grid hero image: only for STAMP_CARD programs
  const isStampCard = !program.programType || program.programType === "STAMP_CARD"
  const { parseStripFilters, parseStampGridConfig } = await import("@/lib/wallet/card-design")
  const triggerStripFilters = parseStripFilters(cardDesign?.editorConfig)
  const isTriggerStampGrid = triggerStripFilters.useStampGrid || cardDesign?.patternStyle === "stamp_grid" || cardDesign?.patternStyle === "STAMP_GRID"
  if (isStampCard && isTriggerStampGrid && cardDesign?.showStrip !== false) {
    const stampGridUrl = await generateStampGridToR2(enrollment, program, cardDesign ?? null, triggerStripFilters, hasAvailableReward)
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
  if (updateType === "DESIGN_CHANGE" || updateType === "PROGRAM_CHANGE") {
    if (isStampCard && isTriggerStampGrid && cardDesign?.showStrip !== false) {
      const stampGridUrl = await generateStampGridToR2(enrollment, program, cardDesign ?? null, triggerStripFilters, hasAvailableReward)
      if (stampGridUrl) {
        patchBody.heroImage = {
          sourceUri: { uri: stampGridUrl },
          contentDescription: {
            defaultValue: { language: "en", value: "Stamp progress" },
          },
        }
      }
    } else {
      const heroUrl = cardDesign?.stripImageGoogle ?? cardDesign?.generatedStripGoogle
      if (heroUrl && cardDesign?.showStrip !== false) {
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

// ─── Stamp Grid → R2 Upload (for Google Wallet PATCH) ──────

async function generateStampGridToR2(
  enrollment: { id: string; currentCycleVisits: number },
  program: { id: string; visitsRequired: number },
  cardDesign: CardDesignRow,
  stripFilters: Awaited<ReturnType<typeof import("@/lib/wallet/card-design").parseStripFilters>>,
  hasAvailableReward: boolean,
): Promise<string | null> {
  try {
    const { parseStampGridConfig } = await import("@/lib/wallet/card-design")
    const { generateStampGridImage, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } = await import("@/lib/wallet/strip-image")
    const { uploadFile } = await import("@/lib/storage")

    const config = parseStampGridConfig(cardDesign?.editorConfig)
    const stripPrimary = stripFilters.stripColor1 ?? cardDesign?.primaryColor ?? "#1a1a2e"
    const stripSecondary = stripFilters.stripColor2 ?? (cardDesign as Record<string, unknown>)?.secondaryColor as string ?? "#ffffff"

    const buffer = await generateStampGridImage({
      currentVisits: enrollment.currentCycleVisits,
      totalVisits: program.visitsRequired,
      hasReward: hasAvailableReward,
      config,
      primaryColor: stripPrimary,
      secondaryColor: stripSecondary,
      textColor: (cardDesign as Record<string, unknown>)?.textColor as string ?? "#ffffff",
      width: GOOGLE_HERO_WIDTH,
      height: GOOGLE_HERO_HEIGHT,
      stripImageUrl: cardDesign?.stripImageGoogle,
      stripOpacity: stripFilters.stripOpacity,
      stripGrayscale: stripFilters.stripGrayscale,
    })

    const key = `strip-images/${program.id}/google-stamp-grid-${enrollment.id}.png`
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

import http2 from "node:http2"
import { task, AbortTaskRunError } from "@trigger.dev/sdk"
import { walletUpdatesQueue } from "./queues"
import { createDb } from "./db"

// ─── Types ──────────────────────────────────────────────────

type UpdateWalletPassPayload = {
  enrollmentId: string
  updateType: "VISIT" | "REWARD_EARNED" | "REWARD_REDEEMED" | "REWARD_EXPIRED" | "DESIGN_CHANGE" | "PROGRAM_CHANGE" | "ENROLLMENT_FROZEN"
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
              visitsRequired: true,
              rewardDescription: true,
              rewardExpiryDays: true,
              termsAndConditions: true,
              restaurant: {
                select: {
                  id: true,
                  name: true,
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
            where: { status: "AVAILABLE" },
            select: { id: true },
            take: 1,
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
      const hasAvailableReward = enrollment.rewards.length > 0

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
          cardDesign
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
  currentCycleVisits: number
  totalVisits: number
  enrolledAt: Date
  customer: {
    fullName: string
  }
  loyaltyProgram: {
    id: string
    restaurant: {
      brandColor: string | null
    }
  }
}

type ProgramForGoogle = {
  id: string
  name: string
  visitsRequired: number
  rewardDescription: string
}

type CardDesignRow = {
  primaryColor: string | null
  stripImageGoogle: string | null
  generatedStripGoogle: string | null
  patternStyle: string
  shape: string
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
  cardDesign?: CardDesignRow
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
  type ProgressStyle = import("@/lib/wallet/card-design").ProgressStyle
  type LabelFormat = import("@/lib/wallet/card-design").LabelFormat

  const progressStyle = (cardDesign?.progressStyle ?? "NUMBERS") as ProgressStyle
  const labelFmt = (cardDesign?.labelFormat ?? "UPPERCASE") as LabelFormat
  const progressValue = formatProgressValue(
    enrollment.currentCycleVisits,
    program.visitsRequired,
    progressStyle,
    hasAvailableReward
  )

  const progressLabel = cardDesign?.customProgressLabel
    ? cardDesign.customProgressLabel
    : hasAvailableReward ? "STATUS" : "PROGRESS"

  const memberSinceFormatted = enrollment.enrolledAt.toLocaleDateString(
    "en-US",
    { month: "short", year: "numeric" }
  )

  const patchBody: Record<string, unknown> = {
    classId: buildProgramClassId(program.id),
    loyaltyPoints: {
      label: formatLabel(progressLabel, labelFmt),
      balance: { string: progressValue },
    },
    secondaryLoyaltyPoints: {
      label: formatLabel("TOTAL VISITS", labelFmt),
      balance: { int: enrollment.totalVisits },
    },
    accountName: enrollment.customer.fullName,
    textModulesData: [
      { id: "nextReward", header: formatLabel("NEXT REWARD", labelFmt), body: program.rewardDescription },
      { id: "memberSince", header: formatLabel("MEMBER SINCE", labelFmt), body: memberSinceFormatted },
    ],
  }

  // For stamp grid, always update hero image on VISIT (cache-bust)
  const { parseStripFilters } = await import("@/lib/wallet/card-design")
  const triggerStripFilters = parseStripFilters(cardDesign?.editorConfig)
  const isTriggerStampGrid = triggerStripFilters.useStampGrid || cardDesign?.patternStyle === "stamp_grid" || cardDesign?.patternStyle === "STAMP_GRID"
  if (isTriggerStampGrid && cardDesign?.shape !== "CLEAN") {
    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
    patchBody.heroImage = {
      sourceUri: { uri: `${baseUrl}/api/wallet/strip/${enrollment.id}?v=${Date.now()}` },
      contentDescription: {
        defaultValue: { language: "en", value: "Stamp progress" },
      },
    }
  }

  // For design changes, also update hero image
  // Note: hexBackgroundColor is a class-level field in LoyaltyClass, not on the object
  if (updateType === "DESIGN_CHANGE" || updateType === "PROGRAM_CHANGE") {
    if (isTriggerStampGrid && cardDesign?.shape !== "CLEAN") {
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://app.loyalshy.com"
      patchBody.heroImage = {
        sourceUri: { uri: `${baseUrl}/api/wallet/strip/${enrollment.id}?v=${Date.now()}` },
        contentDescription: {
          defaultValue: { language: "en", value: "Stamp progress" },
        },
      }
    } else {
      const heroUrl = cardDesign?.stripImageGoogle ?? cardDesign?.generatedStripGoogle
      if (heroUrl && cardDesign?.shape !== "CLEAN") {
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

import "server-only"

import { db } from "@/lib/db"
import { getAccessToken } from "./credentials"
import {
  GOOGLE_WALLET_API_BASE,
  GOOGLE_WALLET_ISSUER_ID,
  buildEnrollmentObjectId,
} from "./constants"

// ─── Types ──────────────────────────────────────────────────

type GooglePassUpdateData = {
  enrollmentId: string
  customerName: string
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  hasAvailableReward: boolean
  rewardDescription: string
  restaurantName: string
  brandColor: string | null
  restaurantLogo: string | null
  programName: string
  memberSince: Date
}

// ─── Update Google Wallet Pass ──────────────────────────────

/**
 * Updates a Google Wallet pass by PATCHing the generic object
 * via the Google Wallet REST API. Changes appear automatically
 * on the user's device.
 */
async function patchGoogleWalletObject(
  data: GooglePassUpdateData
): Promise<void> {
  if (!GOOGLE_WALLET_ISSUER_ID) return

  const objectId = buildEnrollmentObjectId(data.enrollmentId)
  const token = await getAccessToken()

  const progressValue = data.hasAvailableReward
    ? "Reward Available!"
    : `${data.currentCycleVisits} / ${data.visitsRequired} Visits`

  const memberSinceFormatted = data.memberSince.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })

  const patchBody: Record<string, unknown> = {
    textModulesData: [
      {
        id: "progress",
        header: "PROGRESS",
        body: progressValue,
      },
      {
        id: "totalVisits",
        header: "TOTAL VISITS",
        body: `${data.totalVisits}`,
      },
      {
        id: "nextReward",
        header: "NEXT REWARD",
        body: data.rewardDescription,
      },
      {
        id: "memberSince",
        header: "MEMBER SINCE",
        body: memberSinceFormatted,
      },
      {
        id: "customerName",
        header: "NAME",
        body: data.customerName,
      },
      {
        id: "programName",
        header: "PROGRAM",
        body: data.programName,
      },
    ],
  }

  const response = await fetch(
    `${GOOGLE_WALLET_API_BASE}/genericObject/${encodeURIComponent(objectId)}`,
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
          visitsRequired: true,
          rewardDescription: true,
        },
      },
      rewards: {
        where: { status: "AVAILABLE" },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!enrollment || enrollment.walletPassType !== "GOOGLE") return

  try {
    await patchGoogleWalletObject({
      enrollmentId: enrollment.id,
      customerName: enrollment.customer.fullName,
      currentCycleVisits: enrollment.currentCycleVisits,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
      totalVisits: enrollment.totalVisits,
      hasAvailableReward: enrollment.rewards.length > 0,
      rewardDescription: enrollment.loyaltyProgram.rewardDescription,
      restaurantName: enrollment.customer.restaurant.name,
      brandColor: enrollment.customer.restaurant.brandColor,
      restaurantLogo: enrollment.customer.restaurant.logo,
      programName: enrollment.loyaltyProgram.name,
      memberSince: enrollment.customer.createdAt,
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

import "server-only"

import { db } from "@/lib/db"
import { reviewVisitCount } from "./eligibility"
import { getActiveReviewSettings } from "./settings"

export type SendReviewPromptResult =
  | { sent: true; provider: "APPLE" | "GOOGLE" }
  | { sent: false; reason: string }

/**
 * Delivers one contact's review prompt. Runs when the delayed Trigger.dev
 * run fires, so every precondition is checked again here, then the contact
 * is claimed atomically (reviewPromptedAt IS NULL → now) so retries and
 * duplicate runs send at most once.
 *
 * - Apple: touch + APNs push; the refreshed pass carries the review back
 *   field with the merchant's message and changeMessage "%@" (generate-pass).
 * - Google: object PATCH with a TEXT_AND_NOTIFY message (update-pass).
 */
export async function sendReviewPrompt(args: {
  contactId: string
  passInstanceId: string
}): Promise<SendReviewPromptResult> {
  const pass = await db.passInstance.findUnique({
    where: { id: args.passInstanceId },
    select: {
      id: true,
      status: true,
      walletProvider: true,
      contactId: true,
      data: true,
      passTemplate: { select: { organizationId: true, passType: true, config: true } },
      contact: { select: { reviewPromptedAt: true, deletedAt: true } },
    },
  })
  if (!pass || pass.contactId !== args.contactId) return { sent: false, reason: "passNotFound" }
  if (pass.status !== "ACTIVE") return { sent: false, reason: "passInactive" }
  if (pass.walletProvider !== "APPLE" && pass.walletProvider !== "GOOGLE") {
    return { sent: false, reason: "noWallet" }
  }
  const visits = reviewVisitCount({
    passType: pass.passTemplate.passType,
    templateConfig: pass.passTemplate.config,
    data: pass.data,
  })
  if (visits === null) return { sent: false, reason: "notEligible" }
  if (pass.contact.deletedAt) return { sent: false, reason: "contactDeleted" }
  if (pass.contact.reviewPromptedAt) return { sent: false, reason: "alreadyPrompted" }

  const settings = await getActiveReviewSettings(pass.passTemplate.organizationId)
  if (!settings) return { sent: false, reason: "featureOff" }

  // The triggering stamp may have been undone since it was scheduled.
  if (visits < settings.triggerStamp) return { sent: false, reason: "belowTrigger" }

  const claimed = await db.contact.updateMany({
    where: { id: args.contactId, reviewPromptedAt: null },
    data: { reviewPromptedAt: new Date(), reviewPromptPassId: pass.id },
  })
  if (claimed.count === 0) return { sent: false, reason: "alreadyPrompted" }

  try {
    if (pass.walletProvider === "APPLE") {
      const { notifyApplePassUpdate } = await import("@/lib/wallet/apple/update-pass")
      await notifyApplePassUpdate(pass.id)
    } else {
      const { notifyGooglePassUpdate } = await import("@/lib/wallet/google/update-pass")
      await notifyGooglePassUpdate(pass.id)
    }
  } catch (err) {
    // Release the claim so the Trigger.dev retry can send again.
    await db.contact.update({
      where: { id: args.contactId },
      data: { reviewPromptedAt: null, reviewPromptPassId: null },
    })
    throw err
  }
  return { sent: true, provider: pass.walletProvider }
}

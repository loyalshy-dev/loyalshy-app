import "server-only"

import { randomUUID } from "crypto"
import type { Prisma } from "@prisma/client"
import { db, getNextMemberNumber } from "@/lib/db"
import { buildCardUrl } from "@/lib/card-access"
import { buildPassIssuedEmailHtml, getEmailFrom, buildWalletDownloadUrl } from "@/lib/email-templates"
import { generateApplePassForEmail } from "@/lib/wallet/generate-pass-for-email"
import { parseCouponConfig, parseMinigameConfig, weightedRandomPrize } from "@/lib/pass-config"

/**
 * Pass issuance building blocks shared by the dashboard's direct issue
 * (src/server/distribution-actions.ts) and the staff app's counter signup
 * (POST /api/v1/contacts). Callers own auth, role checks and copy.
 */

export const PASS_TYPE_LABELS: Record<string, string> = {
  STAMP_CARD: "Stamp Card",
  COUPON: "Coupon",
}

type TemplateForIssue = { id: string; name: string; passType: string; config: unknown }

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002"
}

/**
 * Creates the PassInstance (plus the coupon's Reward row) for a contact.
 * The (contactId, passTemplateId) unique constraint is the race guard — a
 * concurrent winner makes this report "already_exists".
 */
export async function createPassInstanceForContact(params: {
  organizationId: string
  template: TemplateForIssue
  contactId: string
}): Promise<{ status: "created"; id: string } | { status: "already_exists" }> {
  const { organizationId, template, contactId } = params
  const walletPassId = randomUUID()
  const templateConfig = (template.config as Record<string, unknown>) ?? {}
  const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 90

  const instanceDataObj: Record<string, unknown> = {
    currentCycleVisits: 0,
    totalInteractions: 0,
  }

  try {
    const pi = await db.$transaction(async (tx) => {
      const created = await tx.passInstance.create({
        data: {
          contactId,
          passTemplateId: template.id,
          walletPassId,
          data: instanceDataObj as Prisma.InputJsonValue,
        },
        select: { id: true },
      })

      if (template.passType === "COUPON") {
        const couponConfig = parseCouponConfig(template.config)
        const couponExpiresAt = couponConfig?.validUntil
          ? new Date(couponConfig.validUntil)
          : rewardExpiryDays > 0
            ? new Date(Date.now() + rewardExpiryDays * 86_400_000)
            : new Date(Date.now() + 365 * 86_400_000)

        const mgConfig = parseMinigameConfig(template.config)
        const hasPrizes = mgConfig?.enabled && mgConfig.prizes?.length
        const selectedPrize = hasPrizes ? weightedRandomPrize(mgConfig.prizes!) : null

        await tx.reward.create({
          data: {
            contactId,
            organizationId,
            passTemplateId: template.id,
            passInstanceId: created.id,
            status: "AVAILABLE",
            expiresAt: couponExpiresAt,
            ...(selectedPrize ? { description: selectedPrize, revealedAt: null } : {}),
          },
        })
      }

      return created
    })
    return { status: "created", id: pi.id }
  } catch (err) {
    if (isUniqueViolation(err)) return { status: "already_exists" }
    throw err
  }
}

/**
 * Emails the customer their pass (Add to Apple / Google Wallet + card page).
 * Never throws — the pass exists either way; failures are logged.
 * Returns whether the email was handed to the sender.
 */
export async function sendPassIssuedEmail(params: {
  passInstanceId: string
  contact: { fullName: string; email: string }
  organization: { name: string; slug: string }
  template: { name: string; passType: string }
}): Promise<boolean> {
  const { passInstanceId, contact, organization, template } = params
  const cardUrl = buildCardUrl(organization.slug, passInstanceId)
  const googleWalletUrl = buildWalletDownloadUrl(passInstanceId, "google")
  const passTypeLabel = PASS_TYPE_LABELS[template.passType] ?? "Pass"

  try {
    // Generate Apple pass and upload to R2 for direct wallet add from email
    const applePass = await generateApplePassForEmail(passInstanceId)

    const idempotencyKey = `pass-issued:${passInstanceId}`
    if (process.env.TRIGGER_SECRET_KEY) {
      const { tasks } = await import("@trigger.dev/sdk")
      await tasks.trigger(
        "send-pass-issued-email",
        {
          email: contact.email,
          contactName: contact.fullName,
          organizationName: organization.name,
          templateName: template.name,
          passTypeLabel,
          cardUrl,
          appleWalletUrl: applePass?.url,
          googleWalletUrl,
          idempotencyKey,
        },
        { idempotencyKey },
      )
    } else {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"

      const { error: resendError } = await resend.emails.send(
        {
          from: getEmailFrom(),
          to: contact.email,
          subject: `Your ${passTypeLabel} from ${organization.name}`,
          html: buildPassIssuedEmailHtml({
            contactName: contact.fullName,
            organizationName: organization.name,
            templateName: template.name,
            passTypeLabel,
            cardUrl: `${baseUrl}${cardUrl}`,
            appleWalletUrl: applePass?.url,
            googleWalletUrl: `${baseUrl}${googleWalletUrl}`,
          }),
        },
        { idempotencyKey },
      )
      if (resendError) {
        console.error("Resend error (direct issue):", resendError.message)
        return false
      }
    }
    return true
  } catch (err) {
    console.error(
      "Failed to send pass issued email:",
      err instanceof Error ? err.message : "Unknown error"
    )
    return false
  }
}

/**
 * Finds a live contact by email, then phone; otherwise creates one with the
 * next member number. A lost race on the unique email/phone constraint
 * falls back to the row the winner created.
 */
export async function findOrCreateContact(params: {
  organizationId: string
  fullName: string
  email: string | null
  phone: string | null
}): Promise<{ contact: { id: string; fullName: string; email: string | null; memberNumber: number }; created: boolean }> {
  const { organizationId, fullName, email, phone } = params
  const select = { id: true, fullName: true, email: true, memberNumber: true } as const

  const findExisting = async () =>
    (email
      ? await db.contact.findFirst({ where: { organizationId, email, deletedAt: null }, select })
      : null) ??
    (phone
      ? await db.contact.findFirst({ where: { organizationId, phone, deletedAt: null }, select })
      : null)

  const existing = await findExisting()
  if (existing) return { contact: existing, created: false }

  try {
    const contact = await db.$transaction(async (tx) => {
      const memberNumber = await getNextMemberNumber(organizationId, tx)
      return tx.contact.create({
        data: { organizationId, fullName, email, phone, memberNumber },
        select,
      })
    })
    return { contact, created: true }
  } catch (err) {
    if (isUniqueViolation(err)) {
      const winner = await findExisting()
      if (winner) return { contact: winner, created: false }
    }
    throw err
  }
}

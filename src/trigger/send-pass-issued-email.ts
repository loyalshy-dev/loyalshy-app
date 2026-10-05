import { task } from "@trigger.dev/sdk"
import { emailsQueue } from "./queues"
import { buildPassIssuedEmail, getEmailFrom } from "@/lib/email-templates"
import { toLocale } from "@/lib/i18n/messages"

// ─── Types ──────────────────────────────────────────────────

type PassIssuedEmailPayload = {
  email: string
  contactName: string
  organizationName: string
  templateName: string
  /** STAMP_CARD | COUPON. Runs queued before it existed fall back to a stamp card. */
  passType?: string
  /** Kept for runs queued by an older web build; unused. */
  passTypeLabel?: string
  /** Recipient's language; English when missing. */
  locale?: string
  cardUrl: string
  /** R2 public URL to the .pkpass file */
  appleWalletUrl?: string
  googleWalletUrl?: string
  /**
   * Forwarded to Resend's `Idempotency-Key` header so a Trigger.dev retry
   * does not send a second copy of the same logical email to the customer.
   */
  idempotencyKey?: string
}

// ─── Send Pass Issued Email ─────────────────────────────────

export const sendPassIssuedEmailTask = task({
  id: "send-pass-issued-email",
  queue: emailsQueue,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: PassIssuedEmailPayload) => {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)

    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"
    const { subject, html } = await buildPassIssuedEmail(toLocale(payload.locale), {
      contactName: payload.contactName,
      organizationName: payload.organizationName,
      templateName: payload.templateName,
      passType: payload.passType ?? (payload.passTypeLabel === "Coupon" ? "COUPON" : "STAMP_CARD"),
      cardUrl: `${baseUrl}${payload.cardUrl}`,
      appleWalletUrl: payload.appleWalletUrl,
      googleWalletUrl: payload.googleWalletUrl ? `${baseUrl}${payload.googleWalletUrl}` : undefined,
    })

    const result = await resend.emails.send(
      { from: getEmailFrom(), to: payload.email, subject, html },
      payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined,
    )

    return { emailId: result.data?.id ?? null }
  },
})

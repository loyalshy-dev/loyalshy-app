import { task } from "@trigger.dev/sdk"
import { emailsQueue } from "./queues"
import { buildPassIssuedEmailHtml, getEmailFrom } from "@/lib/email-templates"

// ─── Types ──────────────────────────────────────────────────

type PassIssuedEmailPayload = {
  email: string
  contactName: string
  organizationName: string
  templateName: string
  passTypeLabel: string
  cardUrl: string
  /** R2 public URL to the .pkpass file */
  appleWalletUrl?: string
  googleWalletUrl?: string
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
    const fullCardUrl = `${baseUrl}${payload.cardUrl}`

    const result = await resend.emails.send({
      from: getEmailFrom(),
      to: payload.email,
      subject: `Your ${payload.passTypeLabel} from ${payload.organizationName}`,
      html: buildPassIssuedEmailHtml({
        contactName: payload.contactName,
        organizationName: payload.organizationName,
        templateName: payload.templateName,
        passTypeLabel: payload.passTypeLabel,
        cardUrl: fullCardUrl,
        appleWalletUrl: payload.appleWalletUrl,
        googleWalletUrl: payload.googleWalletUrl ? `${baseUrl}${payload.googleWalletUrl}` : undefined,
      }),
    })

    return { emailId: result.data?.id ?? null }
  },
})

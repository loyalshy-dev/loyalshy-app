import { task } from "@trigger.dev/sdk"
import { buildInvitationEmail } from "@/lib/email-templates"
import { toLocale } from "@/lib/i18n/messages"
import { emailsQueue } from "./queues"

// ─── Types ──────────────────────────────────────────────────

type InvitationEmailPayload = {
  email: string
  organizationName: string
  role: "owner" | "admin" | "staff"
  inviteUrl: string
  mobileDeepLink?: string
  /** Inviter's language; English when missing. */
  locale?: string
  /** Forwarded to Resend so a Trigger.dev retry doesn't resend the invitation. */
  idempotencyKey?: string
}

// ─── Send Invitation Email ──────────────────────────────────

export const sendInvitationEmailTask = task({
  id: "send-invitation-email",
  queue: emailsQueue,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: InvitationEmailPayload) => {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { subject, html } = await buildInvitationEmail(toLocale(payload.locale), {
      organizationName: payload.organizationName,
      role: payload.role,
      inviteUrl: payload.inviteUrl,
      mobileDeepLink: payload.mobileDeepLink,
    })

    const result = await resend.emails.send(
      { from: "Loyalshy <noreply@loyalshy.com>", to: payload.email, subject, html },
      payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined,
    )

    return { emailId: result.data?.id ?? null }
  },
})

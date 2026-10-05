import { task } from "@trigger.dev/sdk"
import { buildWelcomeEmail } from "@/lib/email-templates"
import { toLocale } from "@/lib/i18n/messages"
import { emailsQueue } from "./queues"

// ─── Types ──────────────────────────────────────────────────

type WelcomeEmailPayload = {
  email: string
  ownerName: string
  organizationName: string
  organizationSlug: string
  /**
   * Path the primary CTA should target. Resolved by the caller based on
   * whether the org already has an ACTIVE PassTemplate. Defaults to the
   * create-program deep link if absent.
   */
  getStartedPath?: string
  /** Owner's language at signup; English when missing. */
  locale?: string
  /** Forwarded to Resend so a Trigger.dev retry doesn't resend the welcome. */
  idempotencyKey?: string
}

// ─── Send Welcome Email ─────────────────────────────────────

export const sendWelcomeEmailTask = task({
  id: "send-welcome-email",
  queue: emailsQueue,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: WelcomeEmailPayload) => {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)

    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"
    const dashboardUrl = `${baseUrl}/dashboard`
    const getStartedUrl = `${baseUrl}${payload.getStartedPath ?? "/dashboard/programs?action=create"}`
    const joinUrl = `${baseUrl}/join/${payload.organizationSlug}`

    const { subject, html } = await buildWelcomeEmail(toLocale(payload.locale), {
      ownerName: payload.ownerName,
      organizationName: payload.organizationName,
      getStartedUrl,
      dashboardUrl,
      joinUrl,
    })

    const result = await resend.emails.send(
      { from: "Loyalshy <noreply@loyalshy.com>", to: payload.email, subject, html },
      payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined,
    )

    return { emailId: result.data?.id ?? null }
  },
})

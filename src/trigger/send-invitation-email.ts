import { task } from "@trigger.dev/sdk"
import { emailsQueue } from "./queues"

// ─── Types ──────────────────────────────────────────────────

type InvitationEmailPayload = {
  email: string
  organizationName: string
  role: "owner" | "staff"
  inviteUrl: string
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

    const roleLabel = payload.role === "owner" ? "an owner" : "a staff member"

    const result = await resend.emails.send({
      from: "Loyalshy <noreply@loyalshy.com>",
      to: payload.email,
      subject: `You've been invited to ${payload.organizationName} on Loyalshy`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
          <h2 style="color:#171717;font-size:24px;margin-bottom:8px;">You've been invited!</h2>
          <p style="color:#525252;font-size:15px;line-height:1.6;">
            <strong>${payload.organizationName}</strong> has invited you to join their team as ${roleLabel}.
          </p>
          <a href="${payload.inviteUrl}" style="display:inline-block;padding:12px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;margin:16px 0;">
            Accept Invitation
          </a>
          <p style="color:#a3a3a3;font-size:13px;margin-top:24px;">This invitation expires in 7 days.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
          <p style="color:#a3a3a3;font-size:12px;">Loyalshy — Digital Loyalty Cards</p>
        </div>
      `,
    })

    return { emailId: result.data?.id ?? null }
  },
})

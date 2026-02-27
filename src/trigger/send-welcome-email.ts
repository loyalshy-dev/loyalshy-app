import { task } from "@trigger.dev/sdk"
import { emailsQueue } from "./queues"

// ─── Types ──────────────────────────────────────────────────

type WelcomeEmailPayload = {
  email: string
  ownerName: string
  restaurantName: string
  restaurantSlug: string
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

    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://fidelio.app"
    const dashboardUrl = `${baseUrl}/dashboard`
    const qrUrl = `${baseUrl}/dashboard/settings/qr-code`
    const joinUrl = `${baseUrl}/join/${payload.restaurantSlug}`

    const result = await resend.emails.send({
      from: "Fidelio <noreply@fidelio.app>",
      to: payload.email,
      subject: `Welcome to Fidelio, ${payload.ownerName}!`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
          <h1 style="color:#171717;font-size:28px;margin-bottom:8px;">Welcome to Fidelio!</h1>
          <p style="color:#525252;font-size:15px;line-height:1.6;">
            Hi ${payload.ownerName}, your restaurant <strong>${payload.restaurantName}</strong> is all set up. Here's how to get started:
          </p>

          <div style="background:#fafafa;border-radius:8px;padding:20px;margin:24px 0;">
            <h3 style="color:#171717;font-size:16px;margin:0 0 12px 0;">Getting Started</h3>
            <ol style="color:#525252;font-size:14px;line-height:1.8;padding-left:20px;margin:0;">
              <li><strong>Set up your loyalty program</strong> — Configure visits required and rewards in Settings</li>
              <li><strong>Print your QR code</strong> — Download from <a href="${qrUrl}" style="color:#2563eb;">QR Code Settings</a></li>
              <li><strong>Share with customers</strong> — They scan to join at <a href="${joinUrl}" style="color:#2563eb;">${joinUrl}</a></li>
              <li><strong>Register visits</strong> — Use the dashboard to stamp customer visits</li>
            </ol>
          </div>

          <a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
            Go to Dashboard
          </a>

          <p style="color:#a3a3a3;font-size:13px;margin-top:32px;">
            Need help? Reply to this email or visit our docs.
          </p>

          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
          <p style="color:#a3a3a3;font-size:12px;">Fidelio — Digital Loyalty Cards</p>
        </div>
      `,
    })

    return { emailId: result.data?.id ?? null }
  },
})

import { schedules } from "@trigger.dev/sdk"
import { Resend } from "resend"
import { emailsQueue } from "./queues"
import { createDb } from "./db"

// ─── Send Trial Reminder Email — Daily CRON at 9:00 AM UTC ──

export const sendTrialReminderEmailTask = schedules.task({
  id: "send-trial-reminder-email",
  cron: "0 9 * * *",
  queue: emailsQueue,
  run: async () => {
    const db = createDb()
    const resend = new Resend(process.env.RESEND_API_KEY)

    try {
      const now = new Date()
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"

      // Find restaurants where trialEndsAt is 7, 3, or 1 days away
      const reminderDays = [7, 3, 1]
      let emailsSent = 0

      for (const daysAway of reminderDays) {
        const targetDate = new Date(now)
        targetDate.setDate(targetDate.getDate() + daysAway)

        const dayStart = new Date(targetDate)
        dayStart.setHours(0, 0, 0, 0)

        const dayEnd = new Date(targetDate)
        dayEnd.setHours(23, 59, 59, 999)

        const restaurants = await db.restaurant.findMany({
          where: {
            trialEndsAt: { gte: dayStart, lte: dayEnd },
            subscriptionStatus: "TRIALING",
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        })

        for (const restaurant of restaurants) {
          // Find the org owner via organization membership (not User.role)
          const org = await db.organization.findUnique({
            where: { slug: restaurant.slug },
            select: {
              members: {
                where: { role: "owner" },
                select: {
                  user: { select: { name: true, email: true } },
                },
                take: 1,
              },
            },
          })

          const owner = org?.members[0]?.user
          if (!owner?.email) continue

          const daysLabel = daysAway === 1 ? "tomorrow" : `in ${daysAway} days`

          const urgency =
            daysAway === 1
              ? "Your trial ends tomorrow — upgrade now to keep your data."
              : daysAway === 3
                ? "Your trial ends soon. Upgrade to continue using all features."
                : "Your free trial is ending. Here's what you need to know."

          try {
            await resend.emails.send({
              from: "Loyalshy <noreply@loyalshy.com>",
              to: owner.email,
              subject: `Your Loyalshy trial ends ${daysLabel}`,
              html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
                  <h2 style="color:#171717;font-size:24px;margin-bottom:8px;">Trial Ending ${daysAway === 1 ? "Tomorrow" : `in ${daysAway} Days`}</h2>
                  <p style="color:#525252;font-size:15px;line-height:1.6;">
                    Hi ${owner.name ?? "there"},
                  </p>
                  <p style="color:#525252;font-size:15px;line-height:1.6;">
                    ${urgency}
                  </p>
                  <p style="color:#525252;font-size:15px;line-height:1.6;">
                    Your restaurant <strong>${restaurant.name}</strong>'s trial period ends ${daysLabel}. Upgrade to a paid plan to keep all your customer data, wallet passes, and loyalty program running.
                  </p>
                  <a href="${baseUrl}/dashboard/settings?tab=billing" style="display:inline-block;padding:12px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;margin:16px 0;">
                    Upgrade Now
                  </a>
                  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
                  <p style="color:#a3a3a3;font-size:12px;">Loyalshy — Digital Loyalty Cards</p>
                </div>
              `,
            })
            emailsSent++
          } catch {
            // Continue with other restaurants if one email fails
          }
        }
      }

      return { emailsSent }
    } finally {
      await db.$disconnect()
    }
  },
})

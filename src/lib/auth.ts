import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { organization, admin, emailOTP } from "better-auth/plugins"
import { adminAc, userAc } from "better-auth/plugins/admin/access"
import { nextCookies } from "better-auth/next-js"
import { Resend } from "resend"
import { db } from "./db"

// Lazy Resend client — avoid construction at import time (build safety)
let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

/** Escape HTML special characters to prevent injection */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await getResend().emails.send({
        from: "Loyalshy <noreply@loyalshy.com>",
        to: user.email,
        subject: "Reset your password",
        html: `
          <h2>Reset your password</h2>
          <p>Hi ${escapeHtml(user.name ?? "")},</p>
          <p>Click the link below to reset your password. This link expires in 1 hour.</p>
          <a href="${url}" style="display:inline-block;padding:12px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      })
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: "select_account",
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "USER",
        input: false,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const adminEmail = process.env.SUPER_ADMIN_EMAIL
          if (adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase()) {
            await db.user.update({
              where: { id: user.id },
              data: { role: "SUPER_ADMIN" },
            })
          }
        },
      },
    },
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: async () => {
        return true
      },
      creatorRole: "owner",
      membershipLimit: 50,
    }),
    admin({
      defaultRole: "USER",
      adminRoles: ["SUPER_ADMIN", "ADMIN_OPS", "ADMIN_BILLING", "ADMIN_SUPPORT"],
      roles: {
        USER: userAc,
        ADMIN_SUPPORT: adminAc,
        ADMIN_BILLING: adminAc,
        ADMIN_OPS: adminAc,
        SUPER_ADMIN: adminAc,
      },
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      storeOTP: "hashed",
      sendVerificationOnSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        const subjectMap = {
          "email-verification": "Verify your email",
          "sign-in": "Your sign-in code",
          "forget-password": "Your password reset code",
        } as const
        await getResend().emails.send({
          from: "Loyalshy <noreply@loyalshy.com>",
          to: email,
          subject: `${subjectMap[type]} — ${otp}`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
              <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#171717;">Your verification code</h2>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Enter this code to ${type === "email-verification" ? "verify your email" : type === "sign-in" ? "sign in" : "reset your password"}.</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
                <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#171717;">${otp}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#9ca3af;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        })
      },
    }),
    nextCookies(),
  ],

  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
    "https://loyalshy.com",
    "https://www.loyalshy.com",
    "http://localhost:3000",
  ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user

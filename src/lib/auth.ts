import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { organization, admin, emailOTP, bearer } from "better-auth/plugins"
import { adminAc, userAc } from "better-auth/plugins/admin/access"
import { nextCookies } from "better-auth/next-js"
import { Resend } from "resend"
import { db } from "./db"
import { buildOtpEmail, buildResetPasswordEmail } from "./email-templates"
import { requestLocale } from "./i18n/request-locale"

// Lazy Resend client — avoid construction at import time (build safety)
let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
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
      const { subject, html } = await buildResetPasswordEmail(await requestLocale(), { name: user.name ?? "", url })
      await getResend().emails.send({
        from: "Loyalshy <noreply@loyalshy.com>",
        to: user.email,
        subject,
        html,
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
        const { subject, html } = await buildOtpEmail(await requestLocale(), { code: otp, type })
        await getResend().emails.send({
          from: "Loyalshy <noreply@loyalshy.com>",
          to: email,
          subject,
          html,
        })
      },
    }),
    bearer(),
    nextCookies(),
  ],

  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
    "https://loyalshy.com",
    "https://www.loyalshy.com",
    "http://localhost:3000",
    "loyalshystaff://",
  ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user

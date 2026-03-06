import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { organization, admin } from "better-auth/plugins"
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
          <p>Hi ${user.name},</p>
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
      adminRoles: ["SUPER_ADMIN"],
      roles: {
        USER: userAc,
        SUPER_ADMIN: adminAc,
      },
    }),
    nextCookies(),
  ],

  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
    "http://localhost:3000",
  ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user

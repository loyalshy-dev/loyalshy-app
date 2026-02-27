import "server-only"

import { z } from "zod"

// ─── Schema ──────────────────────────────────────────────────

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  NEXT_PUBLIC_BETTER_AUTH_URL: z.string().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Trigger.dev
  TRIGGER_SECRET_KEY: z.string().optional(),
  TRIGGER_PROJECT_REF: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Apple Wallet
  APPLE_PASS_TYPE_IDENTIFIER: z.string().optional(),
  APPLE_TEAM_IDENTIFIER: z.string().optional(),
  APPLE_PASS_CERTIFICATE: z.string().optional(),
  APPLE_PASS_KEY: z.string().optional(),
  APPLE_PASS_KEY_PASSPHRASE: z.string().optional(),
  APPLE_WWDR_CERTIFICATE: z.string().optional(),

  // Google Wallet
  GOOGLE_WALLET_ISSUER_ID: z.string().optional(),
  GOOGLE_WALLET_SERVICE_ACCOUNT_KEY: z.string().optional(),

  // APNs
  APNS_HOST: z.string().optional(),

  // Sentry
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Analytics (Plausible)
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_PLAUSIBLE_HOST: z.string().optional(),
})

// ─── Lazy Validation ─────────────────────────────────────────
// Only validate when first accessed (avoids build-time crashes)

let _env: z.infer<typeof envSchema> | null = null

export function env(): z.infer<typeof envSchema> {
  if (_env) return _env

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new Error(`Missing or invalid environment variables:\n${formatted}`)
  }

  _env = parsed.data
  return _env
}

"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"

// ─── Schema ──────────────────────────────────────────────────

const contactFormSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  inquiryType: z.enum(["general", "sales", "partnership", "support"]),
  company: z.string().max(100).optional().or(z.literal("")),
  message: z.string().min(10).max(5000),
  // Honeypot — must be empty
  website: z.string().max(0).optional().or(z.literal("")),
})

export type ContactFormInput = z.infer<typeof contactFormSchema>

// ─── Rate Limiting (Upstash with in-memory fallback) ─────────

let _limiter: { limit: (key: string) => Promise<{ success: boolean }> } | null =
  null
let _upstashChecked = false

async function getRateLimiter() {
  if (_limiter) return _limiter
  if (_upstashChecked) return null

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    _upstashChecked = true
    return null
  }

  try {
    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")
    const redis = new Redis({ url, token })
    _limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "contact:rl",
    })
    _upstashChecked = true
    return _limiter
  } catch {
    // Don't set _upstashChecked — retry on next invocation in case of transient failure
    return null
  }
}

// In-memory fallback
const memoryStore = new Map<string, { count: number; resetAt: number }>()

function checkMemoryLimit(key: string): boolean {
  const now = Date.now()
  const window = 3_600_000 // 1 hour
  const maxRequests = 3

  const entry = memoryStore.get(key)
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + window })
    return true
  }

  if (entry.count >= maxRequests) return false
  entry.count++
  return true
}

// ─── Action ──────────────────────────────────────────────────

export async function submitContactForm(
  input: ContactFormInput
): Promise<{ success?: boolean; error?: string }> {
  const t = await getTranslations("serverErrors")

  // 1. Validate
  const parsed = contactFormSchema.safeParse(input)
  if (!parsed.success) {
    return { error: t("contactFormFailed") }
  }

  // 2. Honeypot check
  if (parsed.data.website && parsed.data.website.length > 0) {
    // Silently succeed to not tip off bots
    return { success: true }
  }

  // 3. Rate limit by IP
  const hdrs = await headers()
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown"

  const limiter = await getRateLimiter()
  if (limiter) {
    const result = await limiter.limit(`contact:${ip}`)
    if (!result.success) {
      return { error: t("rateLimitExceeded") }
    }
  } else {
    if (!checkMemoryLimit(`contact:${ip}`)) {
      return { error: t("rateLimitExceeded") }
    }
  }

  // 4. Send email via Resend
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)

    const inquiryLabels: Record<string, string> = {
      general: "General Inquiry",
      sales: "Sales / Enterprise",
      partnership: "Partnership",
      support: "Support",
    }

    const { name, inquiryType, company, message } = parsed.data
    // Strip CR/LF to prevent email header injection
    const email = parsed.data.email.replace(/[\r\n]/g, "")

    // Send notification to team
    await resend.emails.send({
      from: "Loyalshy <noreply@loyalshy.com>",
      to: inquiryType === "sales" ? "sales@loyalshy.com" : "hello@loyalshy.com",
      replyTo: email,
      subject: `[${inquiryLabels[inquiryType]}] New contact from ${escapeHtml(name)}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111; margin-bottom: 24px;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666; width: 120px;">Name</td><td style="padding: 8px 0; color: #111;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0; color: #111;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Type</td><td style="padding: 8px 0; color: #111;">${inquiryLabels[inquiryType]}</td></tr>
            ${company ? `<tr><td style="padding: 8px 0; color: #666;">Company</td><td style="padding: 8px 0; color: #111;">${escapeHtml(company)}</td></tr>` : ""}
          </table>
          <div style="margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <p style="color: #111; margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>
        </div>
      `,
    })

    // Send confirmation to sender
    await resend.emails.send({
      from: "Loyalshy <noreply@loyalshy.com>",
      to: email,
      subject: "We received your message — Loyalshy",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111; margin-bottom: 16px;">Thanks for reaching out, ${escapeHtml(name)}!</h2>
          <p style="color: #444; line-height: 1.6;">
            We've received your message and will get back to you within 1-2 business days.
          </p>
          <p style="color: #444; line-height: 1.6;">
            In the meantime, feel free to explore our <a href="https://loyalshy.com" style="color: #6366f1;">platform</a> or check out our <a href="https://loyalshy.com/api/v1/docs" style="color: #6366f1;">API documentation</a>.
          </p>
          <p style="color: #666; margin-top: 24px; font-size: 14px;">
            — The Loyalshy Team
          </p>
        </div>
      `,
    })

    return { success: true }
  } catch (error) {
    console.error("[contact-form] Failed to send email:", (error as Error).message)
    return { error: t("contactFormFailed") }
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

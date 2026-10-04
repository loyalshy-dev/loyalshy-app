"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"
import { checkContactRateLimit, clientIpFromHeaders, escapeHtml } from "@/lib/contact-rate-limit"
import { MATERIAL_PIECES, MATERIAL_QUANTITIES } from "@/lib/material-request"

// ─── Counter-material request (/promote) ─────────────────────
// A quote request, not an order: it lands in the team's inbox and the
// sender gets a confirmation. No price, no payment — this exists to
// measure demand before the print service is built.

const materialRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  business: z.string().min(1).max(100),
  pieces: z.array(z.enum(MATERIAL_PIECES)).min(1).max(MATERIAL_PIECES.length),
  quantity: z.enum(MATERIAL_QUANTITIES),
  message: z.string().max(2000).optional().or(z.literal("")),
  // Honeypot: any value is accepted here and handled below, so a bot sees a success
  website: z.string().max(500).optional(),
})

export type MaterialRequestInput = z.infer<typeof materialRequestSchema>

export async function submitMaterialRequest(input: MaterialRequestInput): Promise<{ success?: boolean; error?: string }> {
  const tErrors = await getTranslations("serverErrors")

  const parsed = materialRequestSchema.safeParse(input)
  if (!parsed.success) return { error: tErrors("contactFormFailed") }
  if (parsed.data.website && parsed.data.website.length > 0) return { success: true }

  const ip = clientIpFromHeaders(await headers())
  if (!(await checkContactRateLimit("material", ip))) return { error: tErrors("rateLimitExceeded") }

  const locale = await getLocale()
  const t = await getTranslations("pages.promote.form")
  const { name, business, pieces, quantity, message } = parsed.data
  const email = parsed.data.email.replace(/[\r\n]/g, "")
  const pieceLabels = pieces.map((p) => t(`pieceOptions.${p}`))

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    const row = (label: string, value: string) =>
      `<tr><td style="padding: 8px 0; color: #666; width: 120px; vertical-align: top;">${label}</td><td style="padding: 8px 0; color: #111;">${value}</td></tr>`

    await resend.emails.send({
      from: "Loyalshy <noreply@loyalshy.com>",
      to: "hello@loyalshy.com",
      replyTo: email,
      // A header, not HTML: strip line breaks, don't entity-escape
      subject: `[Material] ${business.replace(/[\r\n]/g, " ")} · ${pieceLabels.join(", ")}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111; margin-bottom: 24px;">Counter material request</h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${row("Name", escapeHtml(name))}
            ${row("Email", `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`)}
            ${row("Business", escapeHtml(business))}
            ${row("Pieces", pieceLabels.map(escapeHtml).join("<br>"))}
            ${row("Quantity", escapeHtml(t(`quantityOptions.${quantity}`)))}
            ${row("Language", locale)}
          </table>
          ${message ? `<div style="margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;"><p style="color: #111; margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p></div>` : ""}
        </div>
      `,
    })

    await resend.emails.send({
      from: "Loyalshy <noreply@loyalshy.com>",
      to: email,
      subject: `${t("successTitle")} — Loyalshy`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111; margin-bottom: 16px;">${escapeHtml(t("successTitle"))}</h2>
          <p style="color: #444; line-height: 1.6;">${escapeHtml(t("successBody"))}</p>
          <p style="color: #444; line-height: 1.6;">${pieceLabels.map(escapeHtml).join(", ")} · ${escapeHtml(t(`quantityOptions.${quantity}`))}</p>
          <p style="color: #666; margin-top: 24px; font-size: 14px;">— Loyalshy</p>
        </div>
      `,
    })

    return { success: true }
  } catch (error) {
    console.error("[material-request] Failed to send email:", (error as Error).message)
    return { error: tErrors("contactFormFailed") }
  }
}

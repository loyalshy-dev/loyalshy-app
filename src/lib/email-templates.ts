/** Shared email utilities — NOT a "use server" file, so these can be plain sync functions. */

import { signCardAccess } from "@/lib/card-access"
import type { Locale } from "@/i18n/config"
import { getTranslator } from "@/lib/i18n/messages"

/**
 * Returns the sender address for transactional emails.
 * Uses RESEND_FROM_EMAIL env var if set, otherwise defaults to noreply@loyalshy.com.
 * For local dev without a verified domain, set RESEND_FROM_EMAIL=onboarding@resend.dev
 */
export function getEmailFrom(): string {
  return process.env.RESEND_FROM_EMAIL ?? "Loyalshy <noreply@loyalshy.com>"
}

/** Build a signed wallet download URL for use in emails */
export function buildWalletDownloadUrl(
  passInstanceId: string,
  platform: "apple" | "google"
): string {
  const sig = signCardAccess(passInstanceId)
  return `/api/wallet/download/${passInstanceId}?sig=${sig}&platform=${platform}`
}

/** R2-hosted wallet badge PNGs — publicly accessible, email-safe */
const R2_ASSETS = (process.env.R2_PUBLIC_URL ?? "https://pub-7c8a43a8edf44acb9ce148cb7547aa00.r2.dev").replace(/\/$/, "")
const WALLET_BADGE_APPLE = `${R2_ASSETS}/assets/add-to-apple-wallet-v2.png`
const WALLET_BADGE_GOOGLE = `${R2_ASSETS}/assets/add-to-google-wallet-v2.png`

// ─── Localized transactional emails ─────────────────────────
// Every email a person receives is built here from `emails.*` messages in
// the recipient's language (see the callers for where the locale comes
// from). Values that come from people (names, business names, messages)
// are HTML-escaped; subjects are plain text with line breaks stripped.

type Email = { subject: string; html: string }

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
const strong = (s: string) => `<strong>${esc(s)}</strong>`
const subjectLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim()

const P = "color:#525252;font-size:15px;line-height:1.6;margin:0 0 16px;"
const NOTE = "color:#a3a3a3;font-size:13px;line-height:1.5;margin:24px 0 0;"
const H = "color:#171717;font-size:24px;line-height:1.25;margin:0 0 12px;"
const BUTTON =
  "display:inline-block;padding:12px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;"
const BUTTON_SECONDARY =
  "display:inline-block;padding:11px 20px;background:#fff;color:#171717;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;border:1px solid #e5e5e5;"

function layout(locale: Locale, content: string, footer: string): string {
  return `<div lang="${locale}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
      ${content}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px;" />
      <p style="color:#a3a3a3;font-size:12px;margin:0;">${esc(footer)}</p>
    </div>`
}

const button = (href: string, label: string, style = BUTTON) => `<a href="${esc(href)}" style="${style}">${esc(label)}</a>`

/** The email a customer gets with their pass. */
export async function buildPassIssuedEmail(
  locale: Locale,
  data: {
    contactName: string
    organizationName: string
    templateName: string
    passType: string
    cardUrl: string
    appleWalletUrl?: string
    googleWalletUrl?: string
  },
): Promise<Email> {
  const t = await getTranslator(locale, "emails")
  const kind = data.passType === "COUPON" ? "Coupon" : "StampCard"
  const badges = [
    data.appleWalletUrl
      ? `<a href="${esc(data.appleWalletUrl)}" style="display:inline-block;margin:0 8px 8px 0;"><img src="${WALLET_BADGE_APPLE}" alt="${esc(t("passIssued.appleBadge"))}" style="height:40px;" /></a>`
      : "",
    data.googleWalletUrl
      ? `<a href="${esc(data.googleWalletUrl)}" style="display:inline-block;margin:0 0 8px;"><img src="${WALLET_BADGE_GOOGLE}" alt="${esc(t("passIssued.googleBadge"))}" style="height:40px;" /></a>`
      : "",
  ].join("")
  const html = layout(
    locale,
    `<h2 style="${H}">${esc(t(`passIssued.title${kind}`))}</h2>
      <p style="${P}">${t("passIssued.body", {
        name: esc(data.contactName),
        organization: strong(data.organizationName),
        program: strong(data.templateName),
      })}</p>
      ${badges ? `<p style="${P}">${esc(t("passIssued.addToWallet"))}</p><div style="margin:0 0 16px;">${badges}</div>` : ""}
      ${button(data.cardUrl, t("passIssued.view"), badges ? BUTTON_SECONDARY : BUTTON)}
      <p style="${NOTE}">${esc(t("passIssued.bookmark"))}</p>`,
    t("footer"),
  )
  return { subject: subjectLine(t(`passIssued.subject${kind}`, { organization: data.organizationName })), html }
}

/** The welcome email after a business signs up. */
export async function buildWelcomeEmail(
  locale: Locale,
  data: { ownerName: string; organizationName: string; getStartedUrl: string; dashboardUrl: string; joinUrl: string },
): Promise<Email> {
  const t = await getTranslator(locale, "emails")
  const step = (n: 1 | 2 | 3, body: string) =>
    `<li style="margin:0 0 8px;"><strong style="color:#171717;">${esc(t(`welcome.step${n}Title`))}</strong> ${body}</li>`
  const html = layout(
    locale,
    `<h1 style="${H}font-size:28px;">${esc(t("welcome.title"))}</h1>
      <p style="${P}">${t("welcome.intro", { name: esc(data.ownerName), organization: strong(data.organizationName) })}</p>
      <ol style="color:#525252;font-size:14px;line-height:1.6;padding-left:20px;margin:0 0 24px;">
        ${step(1, esc(t("welcome.step1Body")))}
        ${step(2, t("welcome.step2Body", { url: `<a href="${esc(data.joinUrl)}" style="color:#171717;">${esc(data.joinUrl)}</a>` }))}
        ${step(3, esc(t("welcome.step3Body")))}
      </ol>
      ${button(data.getStartedUrl, t("welcome.cta"))}
      <a href="${esc(data.dashboardUrl)}" style="display:inline-block;padding:12px 16px;color:#525252;text-decoration:none;font-size:14px;">${esc(t("welcome.dashboard"))}</a>
      <p style="${NOTE}">${esc(t("welcome.help"))}</p>`,
    t("footer"),
  )
  return { subject: subjectLine(t("welcome.subject", { name: data.ownerName })), html }
}

export type InvitationRole = "owner" | "admin" | "staff"

/** A team invitation (web link + optional staff-app deep link). */
export async function buildInvitationEmail(
  locale: Locale,
  data: { organizationName: string; role: InvitationRole; inviteUrl: string; mobileDeepLink?: string },
): Promise<Email> {
  const t = await getTranslator(locale, "emails")
  const roleKey = data.role === "owner" ? "bodyOwner" : data.role === "admin" ? "bodyAdmin" : "bodyStaff"
  const html = layout(
    locale,
    `<h2 style="${H}">${esc(t("invitation.title"))}</h2>
      <p style="${P}">${t(`invitation.${roleKey}`, { organization: strong(data.organizationName) })}</p>
      <div style="margin:8px 0 0;">
        ${button(data.inviteUrl, t("invitation.accept"))}
        ${data.mobileDeepLink ? `<span style="display:inline-block;width:8px;"></span>${button(data.mobileDeepLink, t("invitation.openApp"), BUTTON_SECONDARY)}` : ""}
      </div>
      <p style="${NOTE}">${esc(t("invitation.expires"))}</p>`,
    t("footer"),
  )
  return { subject: subjectLine(t("invitation.subject", { organization: data.organizationName })), html }
}

/** Partner handoff: the link that makes the recipient the owner. */
export async function buildHandoffEmail(
  locale: Locale,
  data: { organizationName: string; url: string; expiryDays: number },
): Promise<Email> {
  const t = await getTranslator(locale, "emails")
  const html = layout(
    locale,
    `<h2 style="${H}">${esc(t("handoff.title"))}</h2>
      <p style="${P}">${t("handoff.body", { organization: strong(data.organizationName) })}</p>
      ${button(data.url, t("handoff.cta"))}
      <p style="${NOTE}">${esc(t("handoff.expires", { days: data.expiryDays }))}</p>`,
    t("footer"),
  )
  return { subject: subjectLine(t("handoff.subject", { organization: data.organizationName })), html }
}

/** A partner asks an owner for program-manager access. */
export async function buildAccessRequestEmail(
  locale: Locale,
  data: { partnerName: string; partnerEmail: string; organizationName: string; inviteLink: string },
): Promise<Email> {
  const t = await getTranslator(locale, "emails")
  const html = layout(
    locale,
    `<h2 style="${H}">${esc(t("accessRequest.title"))}</h2>
      <p style="${P}">${t("accessRequest.body", {
        name: strong(data.partnerName),
        email: esc(data.partnerEmail),
        organization: strong(data.organizationName),
      })}</p>
      <p style="${P}">${esc(t("accessRequest.how"))}</p>
      ${button(data.inviteLink, t("accessRequest.cta"))}`,
    t("footer"),
  )
  return {
    subject: subjectLine(t("accessRequest.subject", { name: data.partnerName, organization: data.organizationName })),
    html,
  }
}

/** Password reset link. */
export async function buildResetPasswordEmail(locale: Locale, data: { name: string; url: string }): Promise<Email> {
  const t = await getTranslator(locale, "emails")
  const html = layout(
    locale,
    `<h2 style="${H}">${esc(t("resetPassword.subject"))}</h2>
      <p style="${P}">${esc(t("resetPassword.greeting", { name: data.name }))}</p>
      <p style="${P}">${esc(t("resetPassword.body"))}</p>
      ${button(data.url, t("resetPassword.cta"))}
      <p style="${NOTE}">${esc(t("resetPassword.ignore"))}</p>`,
    t("footer"),
  )
  return { subject: subjectLine(t("resetPassword.subject")), html }
}

export type OtpKind = "email-verification" | "sign-in" | "forget-password"

/** One-time code (email verification, sign-in, password reset). */
export async function buildOtpEmail(locale: Locale, data: { code: string; type: OtpKind }): Promise<Email> {
  const t = await getTranslator(locale, "emails")
  const kind = data.type === "sign-in" ? "SignIn" : data.type === "forget-password" ? "Reset" : "Verify"
  const html = layout(
    locale,
    `<h2 style="${H}font-size:20px;">${esc(t("otp.title"))}</h2>
      <p style="${P}">${esc(t(`otp.instruction${kind}`))}</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center;margin:0 0 8px;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#171717;">${esc(data.code)}</span>
      </div>
      <p style="${NOTE}">${esc(t("otp.expires"))}</p>`,
    t("footer"),
  )
  return { subject: subjectLine(t(`otp.subject${kind}`, { code: data.code })), html }
}

/** Auto-reply to the contact form. */
export async function buildContactReplyEmail(locale: Locale, data: { name: string }): Promise<Email> {
  const t = await getTranslator(locale, "emails")
  const html = layout(
    locale,
    `<h2 style="${H}">${esc(t("contactReply.title", { name: data.name }))}</h2>
      <p style="${P}">${esc(t("contactReply.body"))}</p>
      <p style="${P}color:#171717;">${esc(t("contactReply.sign"))}</p>`,
    t("footer"),
  )
  return { subject: subjectLine(t("contactReply.subject")), html }
}

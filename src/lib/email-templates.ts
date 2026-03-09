/** Shared email utilities — NOT a "use server" file, so these can be plain sync functions. */

import { signCardAccess } from "@/lib/card-access"

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

export function buildPassIssuedEmailHtml(payload: {
  contactName: string
  organizationName: string
  templateName: string
  passTypeLabel: string
  cardUrl: string
  appleWalletUrl?: string
  googleWalletUrl?: string
}): string {
  const walletButtons = []

  // Apple Wallet: links to .pkpass file hosted on R2 — iOS Safari opens it
  // with the native "Add to Apple Wallet" dialog immediately
  if (payload.appleWalletUrl) {
    walletButtons.push(`
      <a href="${payload.appleWalletUrl}" style="display:inline-block;margin-right:8px;margin-bottom:8px;">
        <img src="${WALLET_BADGE_APPLE}" alt="Add to Apple Wallet" style="height:40px;" />
      </a>
    `)
  }

  if (payload.googleWalletUrl) {
    walletButtons.push(`
      <a href="${payload.googleWalletUrl}" style="display:inline-block;margin-bottom:8px;">
        <img src="${WALLET_BADGE_GOOGLE}" alt="Add to Google Wallet" style="height:40px;" />
      </a>
    `)
  }

  const walletSection = walletButtons.length > 0
    ? `
      <div style="margin:20px 0;">
        ${walletButtons.join("")}
      </div>
    `
    : ""

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
      <h2 style="color:#171717;font-size:24px;margin-bottom:8px;">Your ${payload.passTypeLabel} is ready!</h2>
      <p style="color:#525252;font-size:15px;line-height:1.6;">
        Hi ${payload.contactName}, <strong>${payload.organizationName}</strong> has issued you a <strong>${payload.templateName}</strong> pass.
      </p>
      ${walletSection}
      <p style="color:#525252;font-size:14px;line-height:1.6;">
        You can also view your pass in the browser:
      </p>
      <a href="${payload.cardUrl}" style="display:inline-block;padding:10px 20px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:500;margin:8px 0;">
        View Pass
      </a>
      <p style="color:#a3a3a3;font-size:13px;margin-top:24px;">
        Bookmark the link above to access your pass anytime.
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="color:#a3a3a3;font-size:12px;">Loyalshy — Digital Wallet Passes</p>
    </div>
  `
}

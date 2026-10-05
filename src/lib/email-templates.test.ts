import { describe, it, expect } from "vitest"
import { locales } from "@/i18n/config"
import {
  buildAccessRequestEmail,
  buildContactReplyEmail,
  buildHandoffEmail,
  buildInvitationEmail,
  buildOtpEmail,
  buildPassIssuedEmail,
  buildResetPasswordEmail,
  buildWelcomeEmail,
} from "./email-templates"

const evil = 'Ana <script>alert("x")</script>\nBcc: x@y'

describe("transactional emails", () => {
  it("render in every language, escape people's text and keep subjects on one line", async () => {
    for (const locale of locales) {
      const emails = await Promise.all([
        buildPassIssuedEmail(locale, { contactName: evil, organizationName: evil, templateName: evil, passType: "COUPON", cardUrl: "https://c", appleWalletUrl: "https://a" }),
        buildPassIssuedEmail(locale, { contactName: "Ana", organizationName: "Café Sol", templateName: "Club", passType: "STAMP_CARD", cardUrl: "https://c" }),
        buildWelcomeEmail(locale, { ownerName: evil, organizationName: evil, getStartedUrl: "https://s", dashboardUrl: "https://d", joinUrl: "https://j" }),
        buildInvitationEmail(locale, { organizationName: evil, role: "admin", inviteUrl: "https://i", mobileDeepLink: "loyalshystaff://invite/x" }),
        buildInvitationEmail(locale, { organizationName: "Café Sol", role: "staff", inviteUrl: "https://i" }),
        buildHandoffEmail(locale, { organizationName: evil, url: "https://h", expiryDays: 7 }),
        buildAccessRequestEmail(locale, { partnerName: evil, partnerEmail: "p@x.com", organizationName: evil, inviteLink: "https://r" }),
        buildResetPasswordEmail(locale, { name: evil, url: "https://r" }),
        buildOtpEmail(locale, { code: "123456", type: "email-verification" }),
        buildOtpEmail(locale, { code: "123456", type: "sign-in" }),
        buildOtpEmail(locale, { code: "123456", type: "forget-password" }),
        buildContactReplyEmail(locale, { name: evil }),
      ])
      for (const { subject, html } of emails) {
        expect(subject.length).toBeGreaterThan(0)
        expect(subject).not.toMatch(/[\r\n]/)
        expect(html).not.toContain("<script>")
        expect(html).toContain(`lang="${locale}"`)
        // No unresolved ICU placeholder or message key leaked into the HTML.
        expect(html).not.toMatch(/\{(name|organization|program|url|email|days|code)\}|emails\./)
      }
    }
  })

  it("uses the recipient's language", async () => {
    const es = await buildPassIssuedEmail("es", { contactName: "Ana", organizationName: "Café Sol", templateName: "Club", passType: "COUPON", cardUrl: "https://c" })
    expect(es.subject).toBe("Tu cupón de Café Sol")
    const de = await buildInvitationEmail("de", { organizationName: "Café Sol", role: "admin", inviteUrl: "https://i" })
    expect(de.html).toContain("als Programm-Manager")
    const otp = await buildOtpEmail("fr", { code: "123456", type: "sign-in" })
    expect(otp.subject).toBe("Votre code de connexion : 123456")
  })
})

import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { MarketingPage } from "@/components/marketing/pages/shell"
import { PageSection } from "@/components/marketing/pages/section"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/subprocessors", "subprocessors")
}

// Name and privacy page per vendor; purpose, data and location are copy
// (pages.subprocessors.rows.*) so they read in each language.
const ROWS = [
  { key: "vercel", name: "Vercel, Inc.", href: "https://vercel.com/legal/privacy-policy" },
  { key: "neon", name: "Neon, Inc.", href: "https://neon.com/privacy-policy" },
  { key: "upstash", name: "Upstash, Inc.", href: "https://upstash.com/trust/privacy.pdf" },
  { key: "cloudflare", name: "Cloudflare, Inc.", href: "https://www.cloudflare.com/privacypolicy/" },
  { key: "stripe", name: "Stripe Payments Europe, Ltd.", href: "https://stripe.com/privacy" },
  { key: "trigger", name: "Trigger.dev, Inc.", href: "https://trigger.dev/legal/privacy" },
  { key: "resend", name: "Resend, Inc.", href: "https://resend.com/legal/privacy-policy" },
  { key: "sentry", name: "Functional Software, Inc. (Sentry)", href: "https://sentry.io/privacy/" },
  { key: "apple", name: "Apple Inc.", href: "https://www.apple.com/legal/privacy/" },
  { key: "google", name: "Google LLC", href: "https://policies.google.com/privacy" },
] as const

export default async function SubprocessorsPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.subprocessors")
  const tFooter = await getTranslations("footer")

  return (
    <MarketingPage>
      <section style={{ background: "var(--mk-bg)" }}>
        <div className="mk-wrap pt-12 lg:pt-20">
          <h1 className="font-display mk-display-1 max-w-[14ch]" style={{ color: "var(--mk-text)" }}>{t("title")}</h1>
          <p className="mk-lead mt-5 max-w-[52ch]">
            {t("lead")}{" "}
            <Link href={localePath(locale, "/privacy")} className="underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
              {tFooter("privacyPolicy")}
            </Link>
            .
          </p>
          <p className="mk-body-sm mt-4" style={{ color: "var(--mk-text-dimmed)" }}>{t("updated")}</p>
        </div>
      </section>

      <PageSection>
        <div className="-mx-6 overflow-x-auto px-6 lg:mx-0 lg:px-0">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--mk-border)" }}>
                {(["name", "purpose", "data", "location"] as const).map((c) => (
                  <th key={c} scope="col" className="mk-caption py-3 pr-6 font-medium" style={{ color: "var(--mk-text-muted)" }}>
                    {t(`columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className="border-b align-top" style={{ borderColor: "var(--mk-border)" }}>
                  <th scope="row" className="py-4 pr-6 font-normal">
                    <a href={row.href} target="_blank" rel="noopener noreferrer" className="mk-body-sm font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
                      {row.name}
                    </a>
                  </th>
                  <td className="mk-body-sm py-4 pr-6" style={{ color: "var(--mk-text)" }}>{t(`rows.${row.key}.purpose`)}</td>
                  <td className="mk-body-sm py-4 pr-6" style={{ color: "var(--mk-text-muted)" }}>{t(`rows.${row.key}.data`)}</td>
                  <td className="mk-body-sm py-4" style={{ color: "var(--mk-text-muted)" }}>{t(`rows.${row.key}.location`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection tight>
        <div className="grid grid-cols-1 gap-10 border-t pt-8 lg:grid-cols-2 lg:gap-8" style={{ borderColor: "var(--mk-border)" }}>
          <div>
            <h2 className="mk-title-4" style={{ color: "var(--mk-text)" }}>{t("changesTitle")}</h2>
            <p className="mk-body mt-3 max-w-[48ch]" style={{ color: "var(--mk-text-muted)" }}>{t("changesBody")}</p>
          </div>
          <div>
            <h2 className="mk-title-4" style={{ color: "var(--mk-text)" }}>{t("dpaTitle")}</h2>
            <p className="mk-body mt-3 max-w-[48ch]" style={{ color: "var(--mk-text-muted)" }}>
              {t("dpaBody")}{" "}
              <a href="mailto:hello@loyalshy.com" className="font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>hello@loyalshy.com</a>.
            </p>
          </div>
        </div>
      </PageSection>
    </MarketingPage>
  )
}

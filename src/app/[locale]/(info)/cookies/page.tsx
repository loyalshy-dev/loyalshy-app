import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath, marketingAlternates, marketingSocial } from "@/i18n/marketing"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  const t = await getTranslations({ locale, namespace: "metadata.cookies" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: marketingAlternates(locale, "/cookies"),
    ...marketingSocial(locale, "/cookies", `${t("title")} — Loyalshy`, t("description")),
    robots: { index: true, follow: true },
  }
}

export default async function CookiesPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("cookies")
  const tCommon = await getTranslations("common")

  return (
    <div className="min-h-screen" style={{ background: "var(--mk-bg, #fafafa)" }}>
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="mb-12">
          <Link
            href={localePath(locale, "/")}
            className="text-[14px] font-medium mb-6 inline-block transition-opacity hover:opacity-70"
            style={{ color: "var(--mk-text-muted, #666)" }}
          >
            {tCommon("backToHome")}
          </Link>
          <h1
            className="font-display text-3xl sm:text-4xl font-bold"
            style={{ color: "var(--mk-text, #111)", letterSpacing: "-0.03em" }}
          >
            {t("pageTitle")}
          </h1>
          <p className="mt-3 text-[15px]" style={{ color: "var(--mk-text-muted, #666)" }}>
            {t("lastUpdated")}
          </p>
        </header>

        <article
          className="prose prose-sm max-w-none space-y-8 text-[15px] leading-relaxed"
          style={{ color: "var(--mk-text-muted, #444)" }}
        >
          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{tCommon("companyInfo.title")}</h2>
            <p><strong>{tCommon("companyInfo.name")}</strong></p>
            <p>{tCommon("companyInfo.vatLabel")}: {tCommon("companyInfo.vat")}</p>
            <p>{tCommon("companyInfo.address")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section1Title")}</h2>
            <p>{t("section1P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section2Title")}</h2>

            <h3 className="text-[15px] font-semibold mt-4 mb-2" style={{ color: "var(--mk-text, #111)" }}>{t("section2EssentialTitle")}</h3>
            <p>{t("section2EssentialIntro")}</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>{t("section2SessionCookie")}</strong> — {t("section2SessionCookieContent")}
              </li>
              <li>
                <strong>{t("section2OrgCookie")}</strong> — {t("section2OrgCookieContent")}
              </li>
              <li>
                <strong>{t("section2ThemeCookie")}</strong> — {t("section2ThemeCookieContent")}
              </li>
            </ul>

            <h3 className="text-[15px] font-semibold mt-6 mb-2" style={{ color: "var(--mk-text, #111)" }}>{t("section2AnalyticsTitle")}</h3>
            <p>{t("section2AnalyticsContent")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section3Title")}</h2>
            <p>
              <strong>{t("section3StripeIntro")}</strong> {t("section3StripeContent")}{" "}
              <a href="https://stripe.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">
                {t("section3StripePrivacyLink")}
              </a>.
            </p>
            <p>{t("section3NoTracking")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section4Title")}</h2>
            <p>{t("section4P1")}</p>
            <p>{t("section4P2")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section5Title")}</h2>
            <p>{t("section5P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section6Title")}</h2>
            <p>{t("section6P1")} <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>.</p>
          </section>
        </article>
      </div>
    </div>
  )
}

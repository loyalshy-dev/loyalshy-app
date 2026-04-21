import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export const metadata: Metadata = {
  title: "Privacy Policy — Loyalshy",
  description: "How Loyalshy collects, uses, and protects your personal data.",
  alternates: { canonical: `${siteUrl}/privacy` },
  robots: { index: true, follow: true },
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy")
  const tCommon = await getTranslations("common")

  return (
    <div className="min-h-screen" style={{ background: "var(--mk-bg, #fafafa)" }}>
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="mb-12">
          <Link
            href="/"
            className="text-[14px] font-medium mb-6 inline-block transition-opacity hover:opacity-70"
            style={{ color: "var(--mk-text-muted, #666)" }}
          >
            &larr; Back to Loyalshy
          </Link>
          <h1
            className="text-3xl sm:text-4xl font-bold"
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
            <p>{t("section1P2")} <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section2Title")}</h2>
            <p><strong>{t("section2AccountData")}</strong> {t("section2AccountDataContent")}</p>
            <p><strong>{t("section2ContactData")}</strong> {t("section2ContactDataContent")}</p>
            <p><strong>{t("section2UsageData")}</strong> {t("section2UsageDataContent")}</p>
            <p><strong>{t("section2PaymentData")}</strong> {t("section2PaymentDataContent")}</p>
            <p><strong>{t("section2TechnicalData")}</strong> {t("section2TechnicalDataContent")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section3Title")}</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>{t("section3Item1")}</li>
              <li>{t("section3Item2")}</li>
              <li>{t("section3Item3")}</li>
              <li>{t("section3Item4")}</li>
              <li>{t("section3Item5")}</li>
              <li>{t("section3Item6")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section4Title")}</h2>
            <p>{t("section4Intro")}</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>{t("section4Item1")}</li>
              <li>{t("section4Item2")}</li>
              <li>{t("section4Item3")}</li>
              <li>{t("section4Item4")}</li>
              <li>{t("section4Item5")}</li>
              <li>{t("section4Item6")}</li>
              <li>{t("section4Item7")}</li>
              <li>{t("section4Item8")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section5Title")}</h2>
            <p>{t("section5P1")}</p>
            <p>{t("section5P2")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section6Title")}</h2>
            <p>{t("section6Intro")}</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>{t("section6Item1")}</li>
              <li>{t("section6Item2")}</li>
              <li>{t("section6Item3")}</li>
              <li>{t("section6Item4")}</li>
              <li>{t("section6Item5")}</li>
              <li>{t("section6Item6")}</li>
            </ul>
            <p>{t("section6Outro")} <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>. {t("section6OutroSuffix")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section7Title")}</h2>
            <p>{t("section7P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section8Title")}</h2>
            <p>{t("section8P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section9Title")}</h2>
            <p>{t("section9P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section10Title")}</h2>
            <p>{t("section10P1")} <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>.</p>
          </section>
        </article>
      </div>
    </div>
  )
}

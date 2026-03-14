import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export const metadata: Metadata = {
  title: "Terms of Service — Loyalshy",
  description: "Terms and conditions for using the Loyalshy platform.",
  alternates: { canonical: `${siteUrl}/terms` },
  robots: { index: true, follow: true },
}

export default async function TermsPage() {
  const t = await getTranslations("terms")

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
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section1Title")}</h2>
            <p>{t("section1P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section2Title")}</h2>
            <p>{t("section2P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section3Title")}</h2>
            <p>{t("section3P1")}</p>
            <p>{t("section3P2")}</p>
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
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section5Title")}</h2>
            <p>{t("section5P1")}</p>
            <p>{t("section5P2")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section6Title")}</h2>
            <p>{t("section6P1")}</p>
            <p>{t("section6P2")}</p>
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
            <p>{t("section10P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section11Title")}</h2>
            <p>{t("section11P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section12Title")}</h2>
            <p>{t("section12P1")}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>{t("section13Title")}</h2>
            <p>{t("section13P1")} <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>.</p>
          </section>
        </article>
      </div>
    </div>
  )
}

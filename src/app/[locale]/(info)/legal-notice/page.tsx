import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath, marketingAlternates, marketingSocial } from "@/i18n/marketing"
import { LEGAL_ENTITY } from "@/lib/legal-entity"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  const t = await getTranslations({ locale, namespace: "metadata.legalNotice" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: marketingAlternates(locale, "/legal-notice"),
    ...marketingSocial(locale, "/legal-notice", `${t("title")} — Loyalshy`, t("description")),
    robots: { index: true, follow: true },
  }
}

const H2 = { color: "var(--mk-text, #111)" }

// Impressum (§ 5 DDG) for German visitors, aviso legal (art. 10 LSSI) for
// Spanish ones; the same facts in every language.
export default async function LegalNoticePage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("legalNotice")
  const tCommon = await getTranslations("common")
  const { name, vatId, taxId, email, representative, register } = LEGAL_ENTITY

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
            {t("intro")}
          </p>
        </header>

        <article className="space-y-8 text-[15px] leading-relaxed" style={{ color: "var(--mk-text-muted, #444)" }}>
          <section>
            <h2 className="text-lg font-semibold mb-3" style={H2}>{t("providerTitle")}</h2>
            <address className="not-italic">
              <strong style={H2}>{name}</strong>
              <br />
              {t("legalForm")}
              <br />
              {tCommon("companyInfo.address")}
            </address>
            {representative && <p className="mt-3">{t("representative")}: {representative} ({t("soleAdministrator")})</p>}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={H2}>{t("contactTitle")}</h2>
            <p>
              {t("email")}: <a href={`mailto:${email}`} className="underline">{email}</a>
            </p>
            <p>
              {t("contactForm")}:{" "}
              <Link href={localePath(locale, "/contact")} className="underline">
                {t("contactFormLink")}
              </Link>
            </p>
          </section>

          {register && (
            <section>
              <h2 className="text-lg font-semibold mb-3" style={H2}>{t("registerTitle")}</h2>
              <p>{register}</p>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold mb-3" style={H2}>{t("taxTitle")}</h2>
            <p>{t("vatId")}: {vatId}</p>
            <p>{t("taxId")}: {taxId}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={H2}>{t("disputeTitle")}</h2>
            <p>{t("disputeP1")}</p>
          </section>
        </article>
      </div>
    </div>
  )
}

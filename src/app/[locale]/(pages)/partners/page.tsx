import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { MarketingPage } from "@/components/marketing/pages/shell"
import { JsonLd, pageJsonLd } from "@/components/marketing/pages/json-ld"
import { PageHero } from "@/components/marketing/pages/page-hero"
import { PageSection } from "@/components/marketing/pages/section"
import { Photo } from "@/components/marketing/pages/photo"
import { Steps } from "@/components/marketing/pages/steps"
import { FeatureGrid } from "@/components/marketing/pages/feature-grid"
import { PageFAQ } from "@/components/marketing/pages/page-faq"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/partners", "partners")
}

const FAQ_KEYS = ["cost", "ownership", "billing", "referral", "share"] as const

export default async function PartnersPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.partners")
  const tc = await getTranslations("pages.common")
  const contact = `${localePath(locale, "/contact")}?type=partnership`

  const jsonLd = await pageJsonLd(locale, "/partners", "partners")

  return (
    <MarketingPage>
      <JsonLd data={jsonLd} />
      <PageHero
        title={t("title")}
        lead={t("lead")}
        primary={{ label: t("cta"), href: contact }}
        secondary={{ label: tc("seePricing"), href: localePath(locale, "/pricing") }}
        media={<Photo id="1521791136064-7986c2920216" alt={t("heroAlt")} ratio="4/3" priority />}
      />
      <PageSection title={t("howTitle")}>
        <Steps steps={["1", "2", "3", "4"].map((k) => ({ title: t(`steps.${k}.title`), body: t(`steps.${k}.body`) }))} />
      </PageSection>
      <PageSection title={t("consoleTitle")} lead={t("consoleLead")}>
        <FeatureGrid columns={4} items={["portfolio", "referral", "access", "seat"].map((k) => ({ title: t(`console.${k}.title`), body: t(`console.${k}.body`) }))} />
      </PageSection>
      <PageSection title={t("whoTitle")}>
        <FeatureGrid columns={4} items={["agencies", "consultants", "pos", "designers"].map((k) => ({ title: t(`who.${k}.title`), body: t(`who.${k}.body`) }))} />
      </PageSection>
      <PageSection tight>
        <div className="grid grid-cols-1 gap-6 border-t pt-8 lg:grid-cols-12 lg:gap-8" style={{ borderColor: "var(--mk-border)" }}>
          <h2 className="mk-title-4 lg:col-span-4" style={{ color: "var(--mk-text)" }}>{t("termsTitle")}</h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <p className="mk-body max-w-[60ch]" style={{ color: "var(--mk-text-muted)" }}>{t("termsBody")}</p>
            <Link href={contact} className="mk-btn-primary mt-6">
              {t("cta")}
            </Link>
          </div>
        </div>
      </PageSection>
      <PageFAQ
        title={t("faqTitle")}
        items={FAQ_KEYS.map((k) => ({ question: t(`faq.${k}.question`), answer: t(`faq.${k}.answer`) }))}
        aside={
          <p>
            {tc("anythingElse")}{" "}
            <Link href={contact} className="font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
              {tc("emailUs")}
            </Link>{" "}
            {tc("replyTime")}
          </p>
        }
      />
    </MarketingPage>
  )
}

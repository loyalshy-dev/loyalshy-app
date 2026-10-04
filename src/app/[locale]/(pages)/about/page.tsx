import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { MarketingPage } from "@/components/marketing/pages/shell"
import { PageHero } from "@/components/marketing/pages/page-hero"
import { PageSection } from "@/components/marketing/pages/section"
import { Photo } from "@/components/marketing/pages/photo"
import { FeatureGrid } from "@/components/marketing/pages/feature-grid"
import { ClosingCTA } from "@/components/marketing/closing-cta"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/about", "about")
}

export default async function AboutPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.about")
  const tCommon = await getTranslations("common")

  return (
    <MarketingPage>
      <PageHero title={t("title")} lead={t("lead")} media={<Photo id="1559925393-8be0ec4767c8" alt={t("heroAlt")} ratio="4/3" priority />} />

      <PageSection>
        <div className="grid grid-cols-1 gap-6 border-t pt-8 lg:grid-cols-12 lg:gap-8" style={{ borderColor: "var(--mk-border)" }}>
          <h2 className="font-display mk-display-2 lg:col-span-4" style={{ color: "var(--mk-text)" }}>{t("whyTitle")}</h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <p className="mk-body max-w-[60ch]" style={{ color: "var(--mk-text-muted)" }}>{t("whyBody1")}</p>
            <p className="mk-body mt-4 max-w-[60ch]" style={{ color: "var(--mk-text-muted)" }}>{t("whyBody2")}</p>
          </div>
        </div>
      </PageSection>

      <PageSection title={t("holdTitle")}>
        <FeatureGrid columns={4} items={["noApp", "data", "honest", "counter"].map((k) => ({ title: t(`hold.${k}.title`), body: t(`hold.${k}.body`) }))} />
      </PageSection>

      <PageSection tight>
        <Photo id="1522071820081-009f0129c71c" alt={t("photoAlt")} ratio="21/9" sizes="(min-width: 1280px) 76rem, 100vw" />
      </PageSection>

      <PageSection>
        <div className="grid grid-cols-1 gap-6 border-t pt-8 lg:grid-cols-12 lg:gap-8" style={{ borderColor: "var(--mk-border)" }}>
          <h2 className="font-display mk-display-2 lg:col-span-4" style={{ color: "var(--mk-text)" }}>{t("companyTitle")}</h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <p className="mk-body max-w-[60ch]" style={{ color: "var(--mk-text-muted)" }}>{t("companyBody")}</p>
            <address className="mk-body-sm mt-6 not-italic" style={{ color: "var(--mk-text-muted)" }}>
              <strong style={{ color: "var(--mk-text)" }}>{tCommon("companyInfo.name")}</strong>
              <br />
              {tCommon("companyInfo.address")}
              <br />
              {tCommon("companyInfo.vatLabel")}: {tCommon("companyInfo.vat")}
            </address>
            <Link href={localePath(locale, "/contact")} className="mk-btn-ghost mt-6">
              {t("contactCta")}
            </Link>
          </div>
        </div>
      </PageSection>

      <ClosingCTA />
    </MarketingPage>
  )
}

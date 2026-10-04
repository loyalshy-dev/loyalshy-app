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
import { SplitRows } from "@/components/marketing/pages/split"
import { FeatureGrid } from "@/components/marketing/pages/feature-grid"
import { PageFAQ } from "@/components/marketing/pages/page-faq"
import { ClosingCTA } from "@/components/marketing/closing-cta"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/automations", "automations")
}

const ROWS = [
  { key: "reviews", photo: "1517248135467-4c7edcad34c4" },
  { key: "winback", photo: "1521017432531-fbd92d768814" },
  { key: "nearby", photo: "1534452203293-494d7ddbf7e0" },
] as const

const FAQ_KEYS = ["frequency", "android", "edit", "plans", "coupons"] as const

export default async function AutomationsPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.automations")
  const tc = await getTranslations("pages.common")
  const tCommon = await getTranslations("common")

  const jsonLd = await pageJsonLd(locale, "/automations", "automations")

  return (
    <MarketingPage>
      <JsonLd data={jsonLd} />
      <PageHero
        title={t("title")}
        lead={t("lead")}
        primary={{ label: tCommon("getStartedFree"), href: "/register" }}
        secondary={{ label: tc("seePricing"), href: localePath(locale, "/pricing") }}
        media={<Photo id="1512428559087-560fa5ceab42" alt={t("heroAlt")} ratio="4/3" priority />}
      />

      <PageSection>
        <SplitRows
          rows={ROWS.map((r) => ({
            id: r.key,
            meta: t(`rows.${r.key}.meta`),
            title: t(`rows.${r.key}.title`),
            body: t(`rows.${r.key}.body`),
            more: t(`rows.${r.key}.more`),
            link: { label: tc("seePricing"), href: localePath(locale, "/pricing") },
            media: <Photo id={r.photo} alt={t(`rows.${r.key}.alt`)} ratio="4/3" />,
          }))}
        />
      </PageSection>

      <PageSection tight>
        <div className="grid grid-cols-1 gap-6 border-t pt-8 lg:grid-cols-12 lg:gap-8" style={{ borderColor: "var(--mk-border)" }}>
          <h2 className="mk-title-4 lg:col-span-4" style={{ color: "var(--mk-text)" }}>{t("announceTitle")}</h2>
          <p className="mk-body max-w-[60ch] lg:col-span-7 lg:col-start-6" style={{ color: "var(--mk-text-muted)" }}>{t("announceBody")}</p>
        </div>
      </PageSection>

      <PageSection title={t("measureTitle")} lead={t("measureLead")}>
        <FeatureGrid items={["asked", "rating", "lift"].map((k) => ({ title: t(`measure.${k}.title`), body: t(`measure.${k}.body`) }))} />
      </PageSection>

      <PageFAQ
        title={t("faqTitle")}
        items={FAQ_KEYS.map((k) => ({ question: t(`faq.${k}.question`), answer: t(`faq.${k}.answer`) }))}
        aside={
          <p>
            {tc("anythingElse")}{" "}
            <Link href={localePath(locale, "/contact")} className="font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
              {tc("emailUs")}
            </Link>{" "}
            {tc("replyTime")}
          </p>
        }
      />

      <ClosingCTA />
    </MarketingPage>
  )
}

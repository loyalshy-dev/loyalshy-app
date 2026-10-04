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
import { ClosingCTA } from "@/components/marketing/closing-cta"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/private-programs", "privatePrograms")
}

const FAQ_KEYS = ["existing", "qr", "plans", "both"] as const

export default async function PrivateProgramsPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.privatePrograms")
  const tc = await getTranslations("pages.common")
  const tCommon = await getTranslations("common")

  const jsonLd = await pageJsonLd(locale, "/private-programs", "privatePrograms")

  return (
    <MarketingPage>
      <JsonLd data={jsonLd} />
      <PageHero
        title={t("title")}
        lead={t("lead")}
        primary={{ label: tCommon("getStartedFree"), href: "/register" }}
        secondary={{ label: tc("seeStaffApp"), href: localePath(locale, "/staff-app") }}
        media={<Photo id="1503951914875-452162b0f3f1" alt={t("heroAlt")} ratio="4/3" priority />}
      />
      <PageSection title={t("whatTitle")}>
        <FeatureGrid items={["hidden", "team", "same"].map((k) => ({ title: t(`what.${k}.title`), body: t(`what.${k}.body`) }))} />
      </PageSection>
      <PageSection title={t("forTitle")}>
        <FeatureGrid columns={4} items={["members", "vip", "staff", "events"].map((k) => ({ title: t(`for.${k}.title`), body: t(`for.${k}.body`) }))} />
      </PageSection>
      <PageSection title={t("howTitle")}>
        <Steps steps={["1", "2", "3"].map((k) => ({ title: t(`steps.${k}.title`), body: t(`steps.${k}.body`) }))} />
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

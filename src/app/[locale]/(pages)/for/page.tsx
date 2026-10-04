import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { MarketingPage } from "@/components/marketing/pages/shell"
import { PageHero } from "@/components/marketing/pages/page-hero"
import { PageSection } from "@/components/marketing/pages/section"
import { LinkCards } from "@/components/marketing/pages/link-cards"
import { FeatureGrid } from "@/components/marketing/pages/feature-grid"
import { ClosingCTA } from "@/components/marketing/closing-cta"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/for", "for")
}

const CARDS = [
  { slug: "cafes", path: "/for/cafes", photo: "1554118811-1e0d58224f24" },
  { slug: "salons", path: "/for/salons", photo: "1560066984-138dadb4c035" },
  { slug: "retail", path: "/for/retail", photo: "1441986300917-64674bd600d8" },
] as const

export default async function IndustriesPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.industries.hub")
  const tc = await getTranslations("pages.common")
  const tCommon = await getTranslations("common")

  return (
    <MarketingPage>
      <PageHero
        title={t("title")}
        lead={t("lead")}
        primary={{ label: tCommon("getStartedFree"), href: "/register" }}
        secondary={{ label: tc("seePricing"), href: localePath(locale, "/pricing") }}
      />
      <PageSection tight>
        <LinkCards
          cards={CARDS.map((c) => ({
            href: localePath(locale, c.path),
            title: t(`cards.${c.slug}.title`),
            lead: t(`cards.${c.slug}.lead`),
            photo: c.photo,
            alt: t(`cards.${c.slug}.alt`),
          }))}
        />
      </PageSection>
      <PageSection title={t("sameTitle")} lead={t("sameLead")}>
        <FeatureGrid items={["noApp", "counter", "data"].map((k) => ({ title: t(`same.${k}.title`), body: t(`same.${k}.body`) }))} />
      </PageSection>
      <ClosingCTA />
    </MarketingPage>
  )
}

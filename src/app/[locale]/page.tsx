import { NextIntlClientProvider } from "next-intl"
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server"
import { MarketingNavbar } from "@/components/marketing/navbar"
import { Hero } from "@/components/marketing/hero"
import { FeatureShowcase } from "@/components/marketing/feature-showcase"
import { Pricing } from "@/components/marketing/pricing"
import { FAQ } from "@/components/marketing/faq"
import { ClosingCTA } from "@/components/marketing/closing-cta"
import { MarketingFooter } from "@/components/marketing/footer"
import type { Locale } from "@/i18n/config"
import { marketingUrl, siteUrl } from "@/i18n/marketing"
import { JsonLd, ORG_ID, SITE_ID, SOFTWARE_ID, siteNodes } from "@/components/marketing/pages/json-ld"

type PageProps = { params: Promise<{ locale: string }> }

async function HomeJsonLd({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "metadata.home" })
  const pageUrl = marketingUrl(locale, "/")
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      ...(await siteNodes(locale)),
      {
        "@type": "WebPage",
        "@id": `${pageUrl}/#webpage`,
        url: pageUrl,
        name: t("title"),
        description: t("description"),
        isPartOf: { "@id": SITE_ID },
        about: { "@id": SOFTWARE_ID },
        inLanguage: locale,
      },
      {
        "@type": "SoftwareApplication",
        "@id": SOFTWARE_ID,
        name: "Loyalshy",
        url: siteUrl,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: t("description"),
        // Free 0 / Pro 29 / Business 49 / Scale 99; Enterprise is custom
        offers: { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: 0, highPrice: 99, offerCount: 4 },
        provider: { "@id": ORG_ID },
      },
    ],
  }
  return <JsonLd data={structuredData} />
}

const MARKETING_NAMESPACES = [
  "common", "nav", "hero", "featureShowcase",
  "pricing",
  "tryDemo", "closingCta", "footer",
] as const

export default async function LandingPage({ params }: PageProps) {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const messages = await getMessages()
  const marketingMessages: Record<string, unknown> = {}
  for (const ns of MARKETING_NAMESPACES) {
    if (ns in messages) marketingMessages[ns] = messages[ns as keyof typeof messages]
  }

  return (
    <NextIntlClientProvider messages={marketingMessages}>
      <HomeJsonLd locale={locale} />
      <div data-brand="loyalshy" className="min-h-screen" style={{ background: "var(--mk-bg)" }}>
        <MarketingNavbar />
        <main>
          <Hero />
          <FeatureShowcase />
          <Pricing />
          <FAQ />
          <ClosingCTA />
        </main>
        <MarketingFooter />
      </div>
    </NextIntlClientProvider>
  )
}
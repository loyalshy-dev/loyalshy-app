import { NextIntlClientProvider } from "next-intl"
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server"
import { MarketingNavbar } from "@/components/marketing/navbar"
import { Hero } from "@/components/marketing/hero"
import { FeatureShowcase } from "@/components/marketing/feature-showcase"
import { CardAnatomy } from "@/components/marketing/card-anatomy"
import { Pricing } from "@/components/marketing/pricing"
import { FAQ } from "@/components/marketing/faq"
import { ClosingCTA } from "@/components/marketing/closing-cta"
import { MarketingFooter } from "@/components/marketing/footer"
import type { Locale } from "@/i18n/config"
import { marketingUrl, siteUrl } from "@/i18n/marketing"

type PageProps = { params: Promise<{ locale: string }> }

async function JsonLd({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "metadata.home" })
  const pageUrl = marketingUrl(locale, "/")
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Loyalshy",
        legalName: "HEX CONCEPTS STUDIO, S.L.",
        url: siteUrl,
        logo: `${siteUrl}/logo.svg`,
        email: "hello@loyalshy.com",
        sameAs: ["https://instagram.com/loyalshy", "https://tiktok.com/@loyalshy_"],
        taxID: "B27646645",
        vatID: "ESB27646645",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Av. Convent 11",
          postalCode: "25123",
          addressLocality: "Torrefarrera",
          addressRegion: "Lleida",
          addressCountry: "ES",
        },
        description: t("jsonLdDescription"),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Loyalshy",
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: ["en", "es", "fr"],
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}/#webpage`,
        url: pageUrl,
        name: t("title"),
        description: t("description"),
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#software` },
        inLanguage: locale,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: "Loyalshy",
        url: siteUrl,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: t("description"),
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: "0",
          highPrice: "99",
          offerCount: "4",
        },
        featureList: [
          "Digital stamp cards",
          "Digital coupons",
          "Apple Wallet integration",
          "Google Wallet integration",
          "QR code onboarding",
          "Real-time analytics",
          "Team management",
        ],
        provider: { "@id": `${siteUrl}/#organization` },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

const MARKETING_NAMESPACES = [
  "common", "nav", "hero", "featureShowcase",
  "gallery", "pricing",
  "faq", "tryDemo", "closingCta", "footer",
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
      <JsonLd locale={locale} />
      <div data-brand="loyalshy" className="min-h-screen" style={{ background: "var(--mk-bg)", overscrollBehaviorY: "contain" }}>
        <MarketingNavbar />
        <main>
          <Hero />
          <CardAnatomy />
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
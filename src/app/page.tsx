import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { MarketingNavbar } from "@/components/marketing/navbar"
import { Hero } from "@/components/marketing/hero"
import { FeatureShowcase } from "@/components/marketing/dashboard-preview"
import { HowItWorks } from "@/components/marketing/how-it-works"
import { Features } from "@/components/marketing/features"
import { WalletPreview } from "@/components/marketing/wallet-preview"
import { Testimonials } from "@/components/marketing/testimonials"
import { Pricing } from "@/components/marketing/pricing"
import { FAQ } from "@/components/marketing/faq"
import { ClosingCTA } from "@/components/marketing/closing-cta"
import { TryDemo } from "@/components/marketing/try-demo"
import { StaffApp } from "@/components/marketing/staff-app"
import { MarketingFooter } from "@/components/marketing/footer"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export const metadata: Metadata = {
  alternates: { canonical: siteUrl },
}

function JsonLd() {
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
        description:
          "Digital loyalty platform for small businesses. Create and manage stamp cards and coupons in Apple and Google Wallet.",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Loyalshy",
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/#webpage`,
        url: siteUrl,
        name: "Loyalshy — Digital Loyalty Cards for Small Businesses",
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#software` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: "Loyalshy",
        url: siteUrl,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Replace paper stamp cards with digital ones in Apple and Google Wallet. Reward repeat customers with stamp cards and coupons — no app required.",
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
  "common", "nav", "hero", "featureShowcase", "howItWorks",
  "features", "walletPreview", "testimonials", "pricing",
  "faq", "tryDemo", "staffApp", "closingCta", "footer",
] as const

export default async function LandingPage() {
  const messages = await getMessages()
  const marketingMessages: Record<string, unknown> = {}
  for (const ns of MARKETING_NAMESPACES) {
    if (ns in messages) marketingMessages[ns] = messages[ns as keyof typeof messages]
  }

  return (
    <NextIntlClientProvider messages={marketingMessages}>
      <JsonLd />
      <div className="min-h-screen" style={{ background: "var(--mk-bg)", overscrollBehaviorY: "contain" }}>
        <MarketingNavbar />
        <main>
          <Hero />
          <TryDemo />
          <FeatureShowcase />
          <HowItWorks />
          <WalletPreview />
          <Features />
          <StaffApp />
          {/* <Testimonials /> */}
          <Pricing />
          <FAQ />
          <ClosingCTA />
        </main>
        <MarketingFooter />
      </div>
    </NextIntlClientProvider>
  )
}
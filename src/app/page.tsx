import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { MarketingNavbar } from "@/components/marketing/navbar"
import { Hero } from "@/components/marketing/hero"
import { FeatureShowcase } from "@/components/marketing/dashboard-preview"
import { HowItWorks } from "@/components/marketing/how-it-works"
import { Features } from "@/components/marketing/features"
import { ApiSection } from "@/components/marketing/api-section"
import { PassTypesCarousel } from "@/components/marketing/pass-types-carousel"
import { WalletPreview } from "@/components/marketing/wallet-preview"
import { Testimonials } from "@/components/marketing/testimonials"
import { Pricing } from "@/components/marketing/pricing"
import { FAQ } from "@/components/marketing/faq"
import { ClosingCTA } from "@/components/marketing/closing-cta"
import { TryDemo } from "@/components/marketing/try-demo"
import { SocialProof } from "@/components/marketing/social-proof"
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
        url: siteUrl,
        logo: `${siteUrl}/logo.svg`,
        email: "hello@loyalshy.com",
        description:
          "Digital wallet pass platform for businesses. Create and manage Apple and Google Wallet passes from one dashboard.",
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
        name: "Loyalshy — Digital Wallet Passes for Apple & Google Wallet",
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
          "Create digital wallet passes for Apple and Google Wallet. Stamp cards, memberships, coupons, tickets, prepaid passes, and more — all from one platform.",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: "0",
          highPrice: "99",
          offerCount: "4",
        },
        featureList: [
          "Stamp cards",
          "Coupons",
          "Memberships",
          "Points programs",
          "Prepaid passes",
          "Gift cards",
          "Tickets",
          "Access passes",
          "Transit passes",
          "Business IDs",
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
  "common", "nav", "hero", "socialProof", "featureShowcase", "howItWorks",
  "features", "apiSection", "passTypesCarousel", "walletPreview", "testimonials", "pricing",
  "faq", "tryDemo", "closingCta", "footer",
] as const

export default async function LandingPage() {
  const messages = await getMessages()
  const marketingMessages: Record<string, unknown> = {}
  for (const ns of MARKETING_NAMESPACES) {
    if (ns in messages) marketingMessages[ns] = messages[ns as keyof typeof messages]
  }

  return (
    <NextIntlClientProvider messages={marketingMessages}>
      <div className="min-h-screen" style={{ background: "var(--mk-bg)", overscrollBehaviorY: "contain" }}>
        <JsonLd />
        <MarketingNavbar />
        <main>
          <Hero />
          <TryDemo />
          <SocialProof />
          <FeatureShowcase />
          <HowItWorks />
          <WalletPreview />
          <Features />
          <ApiSection />
          <PassTypesCarousel />
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
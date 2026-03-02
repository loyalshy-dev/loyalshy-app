import type { Metadata } from "next"
import { MarketingNavbar } from "@/components/marketing/navbar"
import { Hero } from "@/components/marketing/hero"
import { SocialProof } from "@/components/marketing/social-proof"
import { DashboardPreview } from "@/components/marketing/dashboard-preview"
import { HowItWorks } from "@/components/marketing/how-it-works"
import { Features } from "@/components/marketing/features"
import { WalletPreview } from "@/components/marketing/wallet-preview"
import { Testimonials } from "@/components/marketing/testimonials"
import { Pricing } from "@/components/marketing/pricing"
import { FAQ } from "@/components/marketing/faq"
import { ClosingCTA } from "@/components/marketing/closing-cta"
import { MarketingFooter } from "@/components/marketing/footer"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export const metadata: Metadata = {
  alternates: { canonical: siteUrl },
}

function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Loyalshy",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Digital loyalty card SaaS for restaurants. Create Apple and Google Wallet passes, track visits, and reward your best customers.",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      highPrice: "79",
      offerCount: "3",
    },
    featureList: [
      "Apple Wallet passes",
      "Google Wallet passes",
      "QR code onboarding",
      "Visit tracking",
      "Reward management",
      "Real-time analytics",
      "Team management",
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <JsonLd />
      <MarketingNavbar />
      <main>
        <Hero />
        <SocialProof />
        <DashboardPreview />
        <HowItWorks />
        <WalletPreview />
        <Features />
        <Testimonials />
        <Pricing />
        <FAQ />
        <ClosingCTA />
      </main>
      <MarketingFooter />
    </div>
  )
}

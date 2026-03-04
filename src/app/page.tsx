import type { Metadata } from "next"
import { Suspense } from "react"
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
import { MarketingFooter } from "@/components/marketing/footer"
import { connection } from "next/server"
import { getPublicShowcaseCards } from "@/server/showcase-actions"
import type { MarketingCard } from "@/components/marketing/wallet-card-data"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"

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
      priceCurrency: "EUR",
      lowPrice: "19",
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

function showcaseToMarketing(dbCards: { designData: unknown; metadata: unknown }[]): {
  cards: MarketingCard[]
  designs: WalletPassDesign[]
} | null {
  if (dbCards.length === 0) return null

  const cards: MarketingCard[] = []
  const designs: WalletPassDesign[] = []

  for (const sc of dbCards) {
    const m = (sc.metadata ?? {}) as Record<string, unknown>
    const d = (sc.designData ?? {}) as Record<string, unknown>
    const ec = (d.editorConfig ?? {}) as Record<string, unknown>

    cards.push({
      templateId: (d.templateId as string) ?? "",
      restaurantName: (m.restaurantName as string) ?? "Restaurant",
      currentVisits: (m.currentVisits as number) ?? 5,
      totalVisits: (m.totalVisits as number) ?? 10,
      rewardDescription: (m.rewardDescription as string) ?? "Free reward",
      customerName: (m.customerName as string) ?? "Customer",
      memberSince: (m.memberSince as string) ?? "Jan 2026",
      discountText: (m.discountText as string) || undefined,
      couponCode: (m.couponCode as string) || undefined,
      validUntil: (m.validUntil as string) || undefined,
      tierName: (m.tierName as string) || undefined,
      benefits: (m.benefits as string) || undefined,
    })

    designs.push({
      cardType: (d.cardType as WalletPassDesign["cardType"]) ?? "STAMP",
      showStrip: (d.showStrip as boolean) ?? true,
      primaryColor: (d.primaryColor as string) ?? "#1a1a2e",
      secondaryColor: (d.secondaryColor as string) ?? "#ffffff",
      textColor: (d.textColor as string) ?? "#ffffff",
      progressStyle: (d.progressStyle as WalletPassDesign["progressStyle"]) ?? "NUMBERS",
      labelFormat: (d.labelFormat as WalletPassDesign["labelFormat"]) ?? "UPPERCASE",
      customProgressLabel: (d.customProgressLabel as string) ?? null,
      stripImageUrl: (d.stripImageUrl as string) ?? null,
      patternStyle: (d.patternStyle as WalletPassDesign["patternStyle"]) ?? "NONE",
      stripOpacity: ec.stripOpacity as number | undefined,
      stripGrayscale: ec.stripGrayscale as boolean | undefined,
      stripColor1: ec.stripColor1 as string | undefined,
      stripColor2: ec.stripColor2 as string | undefined,
      stripFill: ec.stripFill as WalletPassDesign["stripFill"],
      patternColor: ec.patternColor as string | undefined,
      useStampGrid: ec.useStampGrid as boolean | undefined,
      stampGridConfig: ec.stampGridConfig as WalletPassDesign["stampGridConfig"],
      stripImagePosition: ec.stripImagePosition as { x: number; y: number } | undefined,
      stripImageZoom: ec.stripImageZoom as number | undefined,
    })
  }

  return { cards, designs }
}

async function ShowcaseContent() {
  await connection()

  let showcaseCards: MarketingCard[] | undefined
  let showcaseDesigns: WalletPassDesign[] | undefined

  try {
    const dbCards = await getPublicShowcaseCards()
    const result = showcaseToMarketing(dbCards)
    if (result) {
      showcaseCards = result.cards
      showcaseDesigns = result.designs
    }
  } catch {
    // Fallback to hardcoded — DB may not be available
  }

  return (
    <>
      <Hero />
      <FeatureShowcase />
      <HowItWorks />
      <WalletPreview showcaseCards={showcaseCards} showcaseDesigns={showcaseDesigns} />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <ClosingCTA />
    </>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--mk-bg)" }}>
      <JsonLd />
      <MarketingNavbar />
      <main>
        <Suspense fallback={
          <>
            <Hero />
            <FeatureShowcase />
            <HowItWorks />
            <WalletPreview />
            <Features />
            <Testimonials />
            <Pricing />
            <FAQ />
            <ClosingCTA />
          </>
        }>
          <ShowcaseContent />
        </Suspense>
      </main>
      <MarketingFooter />
    </div>
  )
}
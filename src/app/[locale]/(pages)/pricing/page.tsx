import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath, siteUrl } from "@/i18n/marketing"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { MarketingPage } from "@/components/marketing/pages/shell"
import { JsonLd, ORG_ID, SOFTWARE_ID, pageJsonLd } from "@/components/marketing/pages/json-ld"
import { PLANS } from "@/lib/plans"
import { PageSection } from "@/components/marketing/pages/section"
import { PlanCompare } from "@/components/marketing/pages/plan-compare"
import { PageFAQ } from "@/components/marketing/pages/page-faq"
import { Pricing } from "@/components/marketing/pricing"
import { ClosingCTA } from "@/components/marketing/closing-cta"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/pricing", "pricing")
}

const FAQ_KEYS = ["customer", "limit", "change", "annual", "vat", "cancel", "enterprise"] as const

export default async function PricingPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.pricing")
  const tc = await getTranslations("pages.common")
  const tp = await getTranslations("pricing")
  // The four self-serve plans as Offers on the shared SoftwareApplication
  // node; prices from the plan table, VAT included. No ratings: none exist.
  const offer = (key: "free" | "starter" | "growth" | "scale", price: number, annual: number) => ({
    "@type": "Offer",
    name: tp(`${key}.name`),
    price,
    priceCurrency: "EUR",
    url: `${siteUrl}/register`,
    availability: "https://schema.org/InStock",
    priceSpecification: [
      { "@type": "UnitPriceSpecification", price, priceCurrency: "EUR", billingDuration: "P1M", valueAddedTaxIncluded: true },
      { "@type": "UnitPriceSpecification", price: annual * 12, priceCurrency: "EUR", billingDuration: "P1Y", valueAddedTaxIncluded: true },
    ],
  })
  const software = {
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_ID,
    name: "Loyalshy",
    url: siteUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    provider: { "@id": ORG_ID },
    offers: [
      offer("free", 0, 0),
      offer("starter", PLANS.STARTER.price ?? 0, PLANS.STARTER.annualPrice ?? 0),
      offer("growth", PLANS.GROWTH.price ?? 0, PLANS.GROWTH.annualPrice ?? 0),
      offer("scale", PLANS.SCALE.price ?? 0, PLANS.SCALE.annualPrice ?? 0),
    ],
  }
  const jsonLd = await pageJsonLd(locale, "/pricing", "pricing", { extra: [software] })

  return (
    <MarketingPage clientNamespaces={["pricing"]}>
      <JsonLd data={jsonLd} />
      <section style={{ background: "var(--mk-bg)" }}>
        <div className="mk-wrap pt-12 lg:pt-20">
          <h1 className="font-display mk-display-1 max-w-[14ch]" style={{ color: "var(--mk-text)" }}>
            {t("title")}
          </h1>
          <p className="mk-lead mt-5 max-w-[52ch]">{t("lead")}</p>
        </div>
      </section>

      {/* The landing's compare grid, prices from the plan table */}
      <Pricing />

      <PageSection title={t("compareTitle")} lead={t("compareLead")} align="center">
        <PlanCompare locale={locale} />
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

import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { MarketingPage } from "@/components/marketing/pages/shell"
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

  return (
    <MarketingPage clientNamespaces={["pricing"]}>
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

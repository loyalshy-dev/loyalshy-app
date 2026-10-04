import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { MarketingPage } from "@/components/marketing/pages/shell"
import { PageHero } from "@/components/marketing/pages/page-hero"
import { PageSection } from "@/components/marketing/pages/section"
import { Steps } from "@/components/marketing/pages/steps"
import { PageFAQ } from "@/components/marketing/pages/page-faq"
import { OrderCta, FreeCta } from "@/components/marketing/pages/promote-cta"
import { MaterialRequestForm, type MaterialFormLabels } from "@/components/marketing/pages/material-request-form"
import {
  CounterCardPiece, StaffPiece, TentPiece, DoorStickerPiece, TicketPiece, StoryPiece, ReviewsPiece, CouponPiece, type MockCopy,
} from "@/components/marketing/pages/promote-pieces"
import { ClosingCTA } from "@/components/marketing/closing-cta"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/promote", "promote")
}

// Each block: where in the business, the piece that goes there, whether it
// is a free download from Distribution and whether we can make it.
const BLOCKS = [
  { key: "counter", free: true, order: true },
  { key: "staff", free: false, order: false },
  { key: "tent", free: true, order: true },
  { key: "door", free: false, order: true },
  { key: "ticket", free: false, order: true },
  { key: "social", free: false, order: true },
  { key: "reviews", free: true, order: true },
  { key: "welcome", free: false, order: false },
] as const

const FAQ_KEYS = ["change", "ownPrinter", "time", "private"] as const

export default async function PromotePage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.promote")
  const tc = await getTranslations("pages.common")
  const m = t.raw("mock") as MockCopy

  const piece = (key: (typeof BLOCKS)[number]["key"]) => {
    const alt = t(`blocks.${key}.alt`)
    switch (key) {
      case "counter": return <CounterCardPiece m={m} alt={alt} />
      case "staff": return <StaffPiece m={m} alt={alt} />
      case "tent": return <TentPiece m={m} alt={alt} />
      case "door": return <DoorStickerPiece m={m} alt={alt} />
      case "ticket": return <TicketPiece m={m} alt={alt} />
      case "social": return <StoryPiece m={m} alt={alt} passAlt={t("blocks.welcome.alt")} />
      case "reviews": return <ReviewsPiece m={m} alt={alt} />
      case "welcome": return <CouponPiece alt={alt} />
    }
  }

  return (
    <MarketingPage>
      <PageHero
        title={t("title")}
        lead={t("lead")}
        primary={{ label: t("orderCta"), href: "#request" }}
        secondary={{ label: t("freeCta"), href: "#free" }}
      />

      <PageSection>
        <div className="flex flex-col gap-16 lg:gap-24">
          {BLOCKS.map((b, i) => {
            const reversed = i % 2 === 1
            return (
              <div key={b.key} id={b.key} className="grid grid-cols-1 gap-8 scroll-mt-24 lg:grid-cols-12 lg:items-center lg:gap-8">
                <div className={reversed ? "lg:col-span-5 lg:col-start-8 lg:order-2" : "lg:col-span-5"}>
                  <p className="mk-caption font-medium" style={{ color: "var(--mk-text-dimmed)" }}>{t(`blocks.${b.key}.piece`)}</p>
                  <h2 className="font-display mk-display-2 mt-2 max-w-[18ch]" style={{ color: "var(--mk-text)" }}>{t(`blocks.${b.key}.title`)}</h2>
                  <p className="mk-body mt-5 max-w-[52ch]" style={{ color: "var(--mk-text-muted)" }}>{t(`blocks.${b.key}.body`)}</p>
                  <p className="mk-body mt-4 max-w-[52ch]" style={{ color: "var(--mk-text)" }}>
                    <strong className="font-semibold">{t(`blocks.${b.key}.tip`)}</strong>
                  </p>
                  {b.order || b.free ? (
                    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                      {b.order ? <OrderCta piece={b.key} label={t("orderCta")} /> : null}
                      {b.free ? <FreeCta piece={b.key} label={t("freeCta")} /> : null}
                    </div>
                  ) : null}
                </div>
                <div className={reversed ? "lg:col-span-6 lg:col-start-1 lg:order-1" : "lg:col-span-6 lg:col-start-7"}>{piece(b.key)}</div>
              </div>
            )
          })}
        </div>
      </PageSection>

      <PageSection id="free" title={t("freeTitle")} lead={t("freeLead")}>
        <Steps steps={["1", "2", "3"].map((k) => ({ title: t(`freeSteps.${k}.title`), body: t(`freeSteps.${k}.body`) }))} />
      </PageSection>

      <section id="request" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
        <div className="mk-wrap grid grid-cols-1 gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24">
          <div className="lg:col-span-5">
            <h2 className="font-display mk-display-2 max-w-[18ch]" style={{ color: "var(--mk-text)" }}>{t("orderTitle")}</h2>
            <p className="mk-lead mt-4 max-w-[44ch]">{t("orderLead")}</p>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded-2xl p-6 sm:p-8" style={{ border: "1px solid var(--mk-border)" }}>
              <Suspense>
                <MaterialRequestForm labels={t.raw("form") as MaterialFormLabels} />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

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

import Image from "next/image"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { ClosingCTA } from "@/components/marketing/closing-cta"
import { MarketingPage } from "./shell"
import { PageHero } from "./page-hero"
import { PageSection } from "./section"
import { Photo } from "./photo"
import { Steps } from "./steps"
import { FeatureGrid } from "./feature-grid"
import { PageFAQ } from "./page-faq"

// One page per business type, same bones: the opener with a photo, the
// counter in three steps, the two programs as real passes, what the card
// does between visits, a second photo, the trade's own questions, and
// the closing band. Copy under `pages.industries.<slug>`.

export type IndustrySlug = "cafes" | "salons" | "retail"

const PHOTOS: Record<IndustrySlug, { hero: string; second: string }> = {
  cafes: { hero: "1507914372368-b2b085b925a1", second: "1453614512568-c4024d13c247" },
  salons: { hero: "1560066984-138dadb4c035", second: "1562322140-8baeececf3df" },
  retail: { hero: "1441986300917-64674bd600d8", second: "1556740738-b6a63e27c4df" },
}

const BEYOND_KEYS: Record<IndustrySlug, readonly string[]> = {
  cafes: ["reviews", "winback", "nearby", "announcements"],
  salons: ["winback", "reviews", "private", "announcements"],
  retail: ["nearby", "announcements", "winback", "reviews"],
}

const FAQ_KEYS: Record<IndustrySlug, readonly string[]> = {
  cafes: ["rush", "two", "android", "design", "hardware"],
  salons: ["services", "booking", "staff", "gap", "android"],
  retail: ["amount", "online", "coupon", "locations", "export"],
}

const PASS = { stamp: "/pass-types/stamp-2-apple.webp", coupon: "/pass-types/coupon-3-apple.webp" }

function PassCard({ src, alt, label, title, body }: { src: string; alt: string; label: string; title: string; body: string }) {
  return (
    <div className="grid grid-cols-1 gap-6 border-t pt-6 sm:grid-cols-12 sm:gap-8" style={{ borderColor: "var(--mk-border)" }}>
      <div className="sm:col-span-5">
        <div className="mx-auto max-w-[240px] sm:mx-0">
          <Image src={src} alt={alt} width={960} height={1350} className="h-auto w-full" sizes="240px" style={{ filter: "drop-shadow(0 14px 18px oklch(0 0 0 / 0.18))" }} />
        </div>
      </div>
      <div className="sm:col-span-7">
        <p className="mk-caption font-medium" style={{ color: "var(--mk-text-dimmed)" }}>{label}</p>
        <h3 className="mk-title-4 mt-2" style={{ color: "var(--mk-text)" }}>{title}</h3>
        <p className="mk-body mt-3 max-w-[44ch]" style={{ color: "var(--mk-text-muted)" }}>{body}</p>
      </div>
    </div>
  )
}

export async function IndustryPage({ locale, slug }: { locale: Locale; slug: IndustrySlug }) {
  const t = await getTranslations(`pages.industries.${slug}`)
  const tc = await getTranslations("pages.common")
  const tCommon = await getTranslations("common")
  const photos = PHOTOS[slug]
  const beyondLinks: Record<string, string> = {
    reviews: localePath(locale, "/automations"),
    winback: localePath(locale, "/automations"),
    nearby: localePath(locale, "/automations"),
    announcements: localePath(locale, "/automations"),
    private: localePath(locale, "/private-programs"),
  }

  return (
    <MarketingPage>
      <PageHero
        title={t("title")}
        lead={t("lead")}
        primary={{ label: tCommon("getStartedFree"), href: "/register" }}
        secondary={{ label: tc("seePricing"), href: localePath(locale, "/pricing") }}
        media={<Photo id={photos.hero} alt={t("heroAlt")} ratio="4/3" priority />}
      />

      <PageSection title={t("counterTitle")} lead={t("counterLead")}>
        <Steps
          steps={["1", "2", "3"].map((k) => ({
            title: t(`steps.${k}.title`),
            body: t(`steps.${k}.body`),
            link: k === "1" ? { label: tc("seePromote"), href: localePath(locale, "/promote") } : undefined,
          }))}
        />
      </PageSection>

      <PageSection title={t("programsTitle")} lead={t("programsLead")}>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-8">
          <PassCard src={PASS.stamp} alt={t("stamp.alt")} label={tc("stampCard")} title={t("stamp.title")} body={t("stamp.body")} />
          <PassCard src={PASS.coupon} alt={t("coupon.alt")} label={tc("coupon")} title={t("coupon.title")} body={t("coupon.body")} />
        </div>
      </PageSection>

      <PageSection title={t("beyondTitle")} lead={t("beyondLead")}>
        <FeatureGrid
          columns={4}
          items={BEYOND_KEYS[slug].map((k) => ({
            title: t(`beyond.${k}.title`),
            body: t(`beyond.${k}.body`),
            link: { label: k === "private" ? tc("seePrivatePrograms") : tc("seeAutomations"), href: beyondLinks[k] },
          }))}
        />
      </PageSection>

      <PageSection tight>
        <Photo id={photos.second} alt={t("photoAlt")} ratio="21/9" sizes="(min-width: 1280px) 76rem, 100vw" />
      </PageSection>

      <PageFAQ
        title={t("faqTitle")}
        items={FAQ_KEYS[slug].map((k) => ({ question: t(`faq.${k}.question`), answer: t(`faq.${k}.answer`) }))}
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

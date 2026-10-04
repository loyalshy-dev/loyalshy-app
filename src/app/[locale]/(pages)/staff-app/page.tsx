import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { MarketingPage } from "@/components/marketing/pages/shell"
import { PageHero } from "@/components/marketing/pages/page-hero"
import { PageSection } from "@/components/marketing/pages/section"
import { SplitRows } from "@/components/marketing/pages/split"
import { FeatureGrid } from "@/components/marketing/pages/feature-grid"
import { PageFAQ } from "@/components/marketing/pages/page-faq"
import { PhoneFrame } from "@/components/marketing/phone-frame"
import { APP_STORE_URL, PLAY_STORE_URL } from "@/components/marketing/store-links"
import { ClosingCTA } from "@/components/marketing/closing-cta"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/staff-app", "staffApp")
}

// Real screenshots (pre-redesign, see "Known stale assets" in CLAUDE.md).
const SCREENS = {
  scan: "/staff-app/scan.webp",
  today: "/staff-app/today.webp",
  share: "/staff-app/share.webp",
  history: "/staff-app/history.webp",
} as const

function Screen({ src, alt, width = 260, priority = false }: { src: string; alt: string; width?: number; priority?: boolean }) {
  return (
    <PhoneFrame width={width} status={false} className="mx-auto">
      <Image src={src} alt={alt} width={1170} height={2532} priority={priority} className="absolute inset-0 h-full w-full object-cover object-top" sizes={`${width}px`} />
    </PhoneFrame>
  )
}

const ROWS = [
  { key: "scan", screen: "scan" },
  { key: "find", screen: "today" },
  { key: "counter", screen: "share" },
  { key: "signup", screen: "today" },
  { key: "rewards", screen: "history" },
  { key: "announce", screen: "today" },
] as const

const FAQ_KEYS = ["free", "devices", "roles", "offline", "demo"] as const

export default async function StaffAppPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.staffApp")
  const tc = await getTranslations("pages.common")

  const badges = (
    <div className="flex flex-wrap items-center gap-3">
      <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t("appStore")} className="inline-flex">
        <Image src="/staff-app/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg" alt="" width={156} height={52} className="h-12 w-auto" />
      </a>
      <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t("playStore")} className="inline-flex">
        <Image src="/staff-app/GetItOnGooglePlay_Badge_Web_color_English.svg" alt="" width={180} height={52} className="h-12 w-auto" />
      </a>
    </div>
  )

  return (
    <MarketingPage>
      <PageHero
        title={t("title")}
        lead={t("lead")}
        actions={badges}
        media={
          <div className="flex justify-center lg:justify-end">
            <Screen src={SCREENS.scan} alt={t("screens.scan")} width={300} priority />
          </div>
        }
      />

      <PageSection>
        <SplitRows
          rows={ROWS.map((r) => ({
            id: r.key,
            meta: t(`rows.${r.key}.meta`),
            title: t(`rows.${r.key}.title`),
            body: t(`rows.${r.key}.body`),
            more: r.key === "scan" ? t("rows.scan.more") : undefined,
            media: <Screen src={SCREENS[r.screen]} alt={t(`screens.${r.screen}`)} />,
          }))}
        />
      </PageSection>

      <PageSection title={t("signinTitle")} lead={t("signinLead")}>
        <FeatureGrid columns={4} items={["qr", "email", "google", "invite"].map((k) => ({ title: t(`signin.${k}.title`), body: t(`signin.${k}.body`) }))} />
      </PageSection>

      <PageFAQ
        title={t("faqTitle")}
        items={FAQ_KEYS.map((k) => ({ question: t(`faq.${k}.question`), answer: t(`faq.${k}.answer`) }))}
        aside={
          <div className="space-y-6">
            <p>
              {tc("anythingElse")}{" "}
              <Link href={localePath(locale, "/contact")} className="font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
                {tc("emailUs")}
              </Link>{" "}
              {tc("replyTime")}
            </p>
            {badges}
          </div>
        }
      />

      <ClosingCTA />
    </MarketingPage>
  )
}

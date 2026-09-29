import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { HeroFilm } from "./hero-film"

const DEMO_JOIN_URL = process.env.NEXT_PUBLIC_DEMO_JOIN_URL
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL

// Apple's opener: the name of the thing in two lines, one tagline, the
// action, and then the film — the product on a pinned stage, driven by scroll.
export async function Hero() {
  const t = await getTranslations("hero")
  const tCommon = await getTranslations("common")

  return (
    <section className="relative" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap flex flex-col items-center pt-14 pb-6 text-center sm:pt-20 lg:pt-24 lg:pb-8">
        <h1 className="font-display mk-display-1 max-w-[18ch]" style={{ color: "var(--mk-text)" }}>
          {t("title")}
        </h1>
        <p className="font-display mt-4 text-[1.375rem] font-medium leading-tight tracking-[-0.015em] sm:text-[1.75rem]" style={{ color: "var(--mk-text-muted)" }}>
          {t("tagline")}
        </p>
        <p className="mk-lead mt-6 hidden max-w-[48ch] lg:block">{t("subtitle")}</p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <Link href="/register" className="mk-btn-primary px-8! py-4! text-base!">
            {tCommon("getStartedFree")}
          </Link>
          <Link
            href={DEMO_JOIN_URL ? "#try-demo" : "#features"}
            className="hidden text-base font-semibold underline-offset-4 hover:underline sm:inline"
            style={{ color: "var(--mk-text)" }}
          >
            {DEMO_JOIN_URL ? t("tryInWallet") : t("seeHowItWorks")}
          </Link>
        </div>
        <p className="mk-body-sm mt-4 hidden sm:block" style={{ color: "var(--mk-text-dimmed)" }}>
          {t("note")}
        </p>
      </div>
      <HeroFilm demoUrl={DEMO_JOIN_URL} appStoreUrl={APP_STORE_URL} playStoreUrl={PLAY_STORE_URL} />
    </section>
  )
}

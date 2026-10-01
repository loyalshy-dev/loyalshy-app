import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { HeroFilm } from "./hero-film"

const DEMO_JOIN_URL = process.env.NEXT_PUBLIC_DEMO_JOIN_URL
// Loyalshy Staff, live on both stores since 2026-10-01.
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "https://apps.apple.com/app/id6761551059"
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || "https://play.google.com/store/apps/details?id=com.loyalshy.staff"

// Apple's opener: the name of the thing in two lines, one tagline, the
// action, and then the film — the phone fills the fold and the story plays
// on a pinned stage, driven by scroll. The lead lives in the film's captions.
// The section keeps a breath under the film so its last frame does not
// land on the next title.
export async function Hero() {
  const t = await getTranslations("hero")
  const tCommon = await getTranslations("common")

  return (
    <section className="relative pb-[10vh] lg:pb-[14vh]" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap flex flex-col items-center pt-10 pb-4 text-center sm:pt-14 lg:pt-16 lg:pb-6">
        <h1 className="font-display mk-display-1 max-w-[18ch]" style={{ color: "var(--mk-text)" }}>
          {t("title")}
        </h1>
        <p className="font-display mt-4 text-[1.375rem] font-medium leading-tight tracking-[-0.015em] sm:text-[1.75rem]" style={{ color: "var(--mk-text-muted)" }}>
          {t("tagline")}
        </p>
        <div className="mt-7 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <Link href="/register" className="mk-btn-primary px-8! py-4! text-base!">
            {tCommon("getStartedFree")}
          </Link>
          <Link
            href={DEMO_JOIN_URL ? "#try-demo" : "#features"}
            className="text-base font-semibold underline-offset-4 hover:underline"
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

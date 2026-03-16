import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"
import { getTranslations } from "next-intl/server"

/* ─── Browser frame with real screenshot ──────────────────────────── */

function BrowserFrame({ browserUrl, screenshotAlt }: { browserUrl: string; screenshotAlt: string }) {
  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{
        background: "var(--mk-card)",
        border: "1px solid var(--mk-border)",
        boxShadow:
          "0 20px 60px oklch(0 0 0 / 0.10), 0 0 0 1px oklch(0 0 0 / 0.03)",
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--mk-border)" }}
      >
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full" style={{ background: "oklch(0.65 0.2 25)" }} />
          <div className="size-3 rounded-full" style={{ background: "oklch(0.80 0.15 95)" }} />
          <div className="size-3 rounded-full" style={{ background: "oklch(0.65 0.18 145)" }} />
        </div>
        <div
          className="mx-auto flex items-center gap-2 rounded-md px-4 py-1 text-[11px]"
          style={{
            background: "var(--mk-surface)",
            color: "var(--mk-text-dimmed)",
            border: "1px solid var(--mk-border)",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
            <path d="M5 3v2h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          </svg>
          {browserUrl}
        </div>
      </div>

      {/* Screenshot */}
      <Image
        src="/platform/cards.webp"
        alt={screenshotAlt}
        width={1920}
        height={1080}
        className="w-full h-auto"
        sizes="(max-width: 1280px) 100vw, 1280px"
        priority
      />
    </div>
  )
}

/* ─── Hero ────────────────────────────────────────────────────────── */

export async function Hero() {
  const t = await getTranslations("hero")
  const tCommon = await getTranslations("common")

  return (
    <section
      className="relative overflow-hidden pt-8 sm:pt-12 pb-20 sm:pb-28"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* Subtle gradient orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-200 rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.2 265 / 0.06) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-20 -right-40 size-150 rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.17 155 / 0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        {/* Badge */}
        <div className="hero-fade-in" style={{ animationDelay: "0ms" }}>
          <div className="flex justify-center mb-6">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium"
              style={{
                background: "oklch(0.55 0.2 265 / 0.06)",
                border: "1px solid oklch(0.55 0.2 265 / 0.12)",
                color: "var(--mk-brand-purple)",
              }}
            >
              <Star className="size-3.5 fill-current" />
              {t("badge")}
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="hero-fade-in" style={{ animationDelay: "100ms" }}>
          <h1
            className="mx-auto max-w-4xl text-center text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.08]"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.035em" }}
          >
            {t("title1")}{" "}
            <br className="hidden sm:block" />
            {t("title2")}{" "}
            <span className="mk-gradient-text">{t("titleHighlight")}</span>
          </h1>
        </div>

        {/* Subtitle */}
        <div className="hero-fade-in" style={{ animationDelay: "200ms" }}>
          <p
            className="mx-auto mt-6 max-w-xl text-center text-[17px] leading-relaxed"
            style={{ color: "var(--mk-text-muted)" }}
          >
            {t("subtitle")}
          </p>
        </div>

        {/* CTAs */}
        <div className="hero-fade-in" style={{ animationDelay: "300ms" }}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="mk-btn-primary py-3.5! px-8! text-[15px]! gap-2">
              {tCommon("getStartedFree")}
              <ArrowRight className="size-4" />
            </Link>
            <Link href="#features" className="mk-btn-ghost py-3.5! px-8! text-[15px]!">
              {t("seeHowItWorks")}
            </Link>
          </div>
          <p
            className="mt-4 text-center text-[13px]"
            style={{ color: "var(--mk-text-dimmed)" }}
          >
            {t("freeForever")} &middot; {t("noCreditCard")}
          </p>
        </div>

        {/* Product screenshot */}
        <div className="mx-auto mt-16 max-w-5xl">
          <BrowserFrame browserUrl={t("browserUrl")} screenshotAlt={t("screenshotAlt")} />
        </div>
      </div>
    </section>
  )
}

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { WalletStack } from "./wallet-stack"

/* ─── Hero ────────────────────────────────────────────────────────── */

export async function Hero() {
  const t = await getTranslations("hero")
  const tCommon = await getTranslations("common")

  return (
    <section
      className="relative overflow-hidden py-24 md:py-32 mk-mesh-bg"
      style={{ background: "var(--mk-bg)" }}
    >
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Asymmetric 7/5 grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Text content */}
          <div className="lg:col-span-7 flex flex-col items-start gap-6 sm:gap-8">
            {/* Badge */}
            <div className="hero-fade-in max-w-full" style={{ animationDelay: "0ms" }}>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] sm:text-[13px] font-bold tracking-wider"
                style={{
                  background: "oklch(0.55 0.2 265 / 0.06)",
                  border: "1px solid oklch(0.55 0.2 265 / 0.15)",
                  color: "var(--mk-brand-purple)",
                }}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--mk-brand-purple)" }}
                />
                {t("badge")}
              </div>
            </div>

            {/* Headline */}
            <div className="hero-fade-in" style={{ animationDelay: "100ms" }}>
              <h1
                className="mk-clamp-h1 font-black leading-[0.95]"
                style={{ color: "var(--mk-text)", letterSpacing: "-0.045em" }}
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
                className="max-w-xl text-lg font-medium leading-relaxed"
                style={{ color: "var(--mk-text-muted)" }}
              >
                {t("subtitle")}
              </p>
            </div>

            {/* CTAs */}
            <div className="hero-fade-in w-full" style={{ animationDelay: "300ms" }}>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
                <Link href="/register" className="mk-btn-primary py-4! px-8! text-base! gap-2 shadow-xl! w-full sm:w-auto">
                  {tCommon("getStartedFree")}
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="#features" className="mk-btn-ghost py-4! px-8! text-base! w-full sm:w-auto">
                  {t("seeHowItWorks")}
                </Link>
                <span
                  className="text-sm sm:ml-2"
                  style={{ color: "var(--mk-text-dimmed)" }}
                >
                  {t("freeForever")}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Wallet stack */}
          <div
            className="hero-fade-in lg:col-span-5 flex justify-center"
            style={{ animationDelay: "200ms" }}
          >
            <div className="relative">
              {/* Glow behind wallet stack */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 scale-150 rounded-full blur-3xl"
                style={{
                  background: "radial-gradient(circle, oklch(0.55 0.2 265 / 0.1) 0%, transparent 70%)",
                }}
              />
              <WalletStack />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

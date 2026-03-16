import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"
import { getTranslations } from "next-intl/server"

/* ─── Floating pass cards ─────────────────────────────────────────── */

const HERO_PASSES = [
  { src: "/pass-types/stamp.webp", alt: "Stamp card pass", rotate: -6, x: 0, y: 0, z: 3 },
  { src: "/pass-types/coupon.webp", alt: "Coupon pass", rotate: 4, x: 80, y: -30, z: 2 },
  { src: "/pass-types/ticket.webp", alt: "Ticket pass", rotate: -3, x: 40, y: 60, z: 1 },
] as const

function HeroPassStack({ screenshotAlt }: { screenshotAlt: string }) {
  return (
    <div
      className="relative"
      style={{ width: 320, height: 400 }}
      aria-label={screenshotAlt}
    >
      {HERO_PASSES.map((pass) => (
        <div
          key={pass.src}
          className="absolute"
          style={{
            left: pass.x,
            top: pass.y,
            zIndex: pass.z,
            transform: `rotate(${pass.rotate}deg)`,
            animation: `mk-float ${3 + pass.z * 0.5}s ease-in-out infinite`,
            animationDelay: `${pass.z * -0.8}s`,
          }}
        >
          <Image
            src={pass.src}
            alt={pass.alt}
            width={213}
            height={238}
            className="rounded-2xl"
            style={{
              boxShadow: `0 ${8 + pass.z * 4}px ${24 + pass.z * 12}px oklch(0 0 0 / ${0.08 + pass.z * 0.03})`,
            }}
            priority
          />
        </div>
      ))}
    </div>
  )
}

/* ─── Hero ────────────────────────────────────────────────────────── */

export async function Hero() {
  const t = await getTranslations("hero")
  const tCommon = await getTranslations("common")

  return (
    <section
      className="relative overflow-hidden pt-8 sm:pt-16 pb-20 sm:pb-28"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* Gradient mesh background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 70% 40%, oklch(0.55 0.2 265 / 0.07) 0%, transparent 70%),
            radial-gradient(ellipse 40% 60% at 30% 70%, oklch(0.55 0.17 155 / 0.05) 0%, transparent 70%),
            radial-gradient(ellipse 80% 40% at 50% 10%, oklch(0.55 0.2 265 / 0.03) 0%, transparent 70%)
          `,
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        {/* Asymmetric 2-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
          {/* Left: Text content */}
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="hero-fade-in" style={{ animationDelay: "0ms" }}>
              <div className="mb-6">
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
                className="text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-[1.05]"
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
                className="mt-6 max-w-xl text-[17px] leading-relaxed"
                style={{ color: "var(--mk-text-muted)" }}
              >
                {t("subtitle")}
              </p>
            </div>

            {/* CTAs */}
            <div className="hero-fade-in" style={{ animationDelay: "300ms" }}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link href="/register" className="mk-btn-primary py-3.5! px-8! text-[15px]! gap-2">
                  {tCommon("getStartedFree")}
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="#features" className="mk-btn-ghost py-3.5! px-8! text-[15px]!">
                  {t("seeHowItWorks")}
                </Link>
              </div>
              <p
                className="mt-4 text-[13px]"
                style={{ color: "var(--mk-text-dimmed)" }}
              >
                {t("freeForever")} &middot; {t("noCreditCard")}
              </p>
            </div>
          </div>

          {/* Right: Floating pass card images */}
          <div
            className="hero-fade-in mt-16 flex justify-center lg:mt-0 lg:justify-end"
            style={{ animationDelay: "200ms" }}
          >
            <div className="relative">
              {/* Glow behind cards */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 scale-150 rounded-full blur-3xl"
                style={{
                  background: "radial-gradient(circle, oklch(0.55 0.2 265 / 0.1) 0%, transparent 70%)",
                }}
              />
              <HeroPassStack screenshotAlt={t("screenshotAlt")} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

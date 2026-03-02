import Link from "next/link"
import { Button } from "@/components/ui/button"
import { WalletStack } from "@/components/marketing/wallet-stack"
import type { MarketingCard } from "@/components/marketing/wallet-card-data"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"

/**
 * Hero section for Loyalshy marketing landing page.
 *
 * Usage:
 *   import { Hero } from "@/components/marketing/hero"
 *   <Hero />
 *
 * Layout: text-left + wallet mockup right on lg+, stacked on mobile.
 * Background: CSS-only radial mesh dots pattern — no images, no JS.
 */

type HeroProps = {
  showcaseCards?: MarketingCard[]
  showcaseDesigns?: WalletPassDesign[]
}

export function Hero({ showcaseCards, showcaseDesigns }: HeroProps = {}) {
  return (
    <section
      className="relative isolate overflow-hidden"
      aria-label="Hero"
    >
      {/* ── Background mesh / dot pattern ──────────────────────────── */}
      {/*
        Two layers:
        1. A large radial gradient that fades from brand-tinted to background.
        2. A repeating radial-gradient "dot grid" for the Linear-style mesh.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(
              ellipse 80% 60% at 60% -10%,
              oklch(0.55 0.2 265 / 0.12) 0%,
              transparent 70%
            ),
            radial-gradient(
              ellipse 50% 40% at 10% 80%,
              oklch(0.55 0.2 265 / 0.06) 0%,
              transparent 60%
            )
          `,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage: `radial-gradient(
            circle,
            oklch(0.55 0.2 265 / 0.18) 1px,
            transparent 1px
          )`,
          backgroundSize: "28px 28px",
          maskImage: `radial-gradient(
            ellipse 85% 70% at 50% 0%,
            black 30%,
            transparent 100%
          )`,
          WebkitMaskImage: `radial-gradient(
            ellipse 85% 70% at 50% 0%,
            black 30%,
            transparent 100%
          )`,
        }}
      />

      {/* ── Content wrapper ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-28 lg:flex lg:items-center lg:gap-x-16 lg:px-8 lg:pb-32 lg:pt-36">

        {/* ── Left: Copy ──────────────────────────────────────────────── */}
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:shrink-0">
          {/* Eyebrow badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[oklch(0.55_0.2_265/0.25)] bg-[oklch(0.55_0.2_265/0.08)] px-3.5 py-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "oklch(0.55 0.2 265)" }}
              aria-hidden="true"
            />
            <span
              className="text-xs font-medium tracking-wide"
              style={{ color: "oklch(0.55 0.2 265)" }}
            >
              Apple &amp; Google Wallet
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[2.6rem] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]">
            Digital loyalty cards your customers{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, oklch(0.55 0.2 265) 0%, oklch(0.65 0.18 295) 100%)",
              }}
            >
              actually use
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Replace paper punch cards with Apple &amp; Google Wallet passes.
            Set up in 5 minutes.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-11 rounded-lg px-6 text-sm font-medium shadow-sm"
              style={
                {
                  background: "oklch(0.55 0.2 265)",
                  color: "oklch(0.985 0 0)",
                  "--tw-shadow-color": "oklch(0.55 0.2 265 / 0.35)",
                } as React.CSSProperties
              }
            >
              <Link href="/register">Start Free Trial</Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 rounded-lg px-6 text-sm font-medium"
            >
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          {/* Social proof / trust strip */}
          <p className="mt-8 text-xs text-muted-foreground">
            No credit card required &middot; Free 14-day trial &middot; Cancel any time
          </p>
        </div>

        {/* ── Right: Wallet card stack ─────────────────────────────────── */}
        <div className="mx-auto mt-16 flex justify-center lg:mx-0 lg:mt-0 lg:flex-1 lg:justify-end">
          <WalletStack cards={showcaseCards} designs={showcaseDesigns} />
        </div>
      </div>
    </section>
  )
}

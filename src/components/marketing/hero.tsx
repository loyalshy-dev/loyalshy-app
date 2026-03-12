"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"
import { FadeIn } from "./motion"

/* ─── Browser frame with real screenshot ──────────────────────────── */

function BrowserFrame() {
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
          app.loyalshy.com/dashboard
        </div>
      </div>

      {/* Screenshot */}
      <Image
        src="/platform/cards.png"
        alt="Loyalshy dashboard showing loyalty programs with beautiful card designs"
        width={1920}
        height={1080}
        className="w-full h-auto"
        priority
      />
    </div>
  )
}

/* ─── Hero ────────────────────────────────────────────────────────── */

export function Hero() {
  return (
    <section
      className="relative overflow-hidden pt-8 sm:pt-12 pb-20 sm:pb-28"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* Subtle gradient orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.2 265 / 0.06) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-20 -right-40 size-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.17 155 / 0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        {/* Badge */}
        <FadeIn delay={0} duration={0.5}>
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
              The modern loyalty platform
            </div>
          </div>
        </FadeIn>

        {/* Headline */}
        <FadeIn delay={0.1} duration={0.7}>
          <h1
            className="mx-auto max-w-4xl text-center text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.08]"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.035em" }}
          >
            Digital loyalty cards{" "}
            <br className="hidden sm:block" />
            your customers{" "}
            <span className="mk-gradient-text">actually use</span>
          </h1>
        </FadeIn>

        {/* Subtitle */}
        <FadeIn delay={0.2} duration={0.6}>
          <p
            className="mx-auto mt-6 max-w-xl text-center text-[17px] leading-relaxed"
            style={{ color: "var(--mk-text-muted)" }}
          >
            Replace paper punch cards with Apple &amp; Google Wallet passes.
            Set up in 5 minutes. No app required for your customers.
          </p>
        </FadeIn>

        {/* CTAs */}
        <FadeIn delay={0.3} duration={0.5}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="mk-btn-primary !py-3.5 !px-8 !text-[15px] gap-2">
              Get Started Free
              <ArrowRight className="size-4" />
            </Link>
            <Link href="#features" className="mk-btn-ghost !py-3.5 !px-8 !text-[15px]">
              See How It Works
            </Link>
          </div>
          <p
            className="mt-4 text-center text-[13px]"
            style={{ color: "var(--mk-text-dimmed)" }}
          >
            Free forever &middot; No credit card required
          </p>
        </FadeIn>

        {/* Product screenshot */}
        <FadeIn delay={0.5} duration={0.8} direction="up" distance={40}>
          <div className="mx-auto mt-16 max-w-5xl">
            <BrowserFrame />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

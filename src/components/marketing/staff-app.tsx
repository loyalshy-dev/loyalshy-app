"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useRef, useState } from "react"
import { QrCode, ScanLine, Activity, Shield, ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { FadeIn, Stagger, StaggerItem } from "./motion"

/* ─── Screenshot carousel data ────────────────────────────────────── */

const SCREENSHOTS = [
  { src: "/staff-app/home.webp", id: "home" },
  { src: "/staff-app/scan.webp", id: "scan" },
  { src: "/staff-app/history.webp", id: "history" },
  { src: "/staff-app/share.webp", id: "share" },
] as const

/* ─── Main component ─────────────────────────────────────────────── */

export function StaffApp() {
  const t = useTranslations("staffApp")
  const [activeIdx, setActiveIdx] = useState(0)

  const features = [
    { icon: ScanLine, key: "scan" as const },
    { icon: Activity, key: "activity" as const },
    { icon: QrCode, key: "pairing" as const },
    { icon: Shield, key: "secure" as const },
  ]

  return (
    <section
      className="relative py-16 sm:py-24 md:py-28 overflow-hidden"
      style={{ background: "var(--mk-surface)" }}
    >
      {/* Gradient mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 50% 50% at 30% 40%, oklch(0.704 0.193 32 / 0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 70% 60%, oklch(0.704 0.193 32 / 0.04) 0%, transparent 70%)
          `,
        }}
      />

      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Section heading */}
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
            <div className="flex w-full items-center justify-center py-8">
              <Image
                src="/staff-app/icon.webp"
                alt="Loyalshy Staff Scanner"
                width={128}
                height={128}
                className="size-32 sm:size-32 rounded-2xl shrink-0"
                style={{
                  boxShadow: "0 4px 16px oklch(0 0 0 / 0.15)"
                }}
              />
              

            </div>

            <p
              className="text-[13px] font-bold tracking-wide mb-4"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("sectionLabel")}
            </p>
            <div className="flex items-center justify-center gap-4 mb-1">

              <h2
                className="mk-clamp-h2 font-black tracking-tight text-center"
                style={{ color: "var(--mk-text)" }}
              >
                {t("title")}
              </h2>
            </div>
            <p
              className="mt-4 text-[16px] leading-relaxed max-w-xl mx-auto"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("subtitle")}
            </p>
          </div>
        </FadeIn>

        {/* Two-column layout: phone + features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Phone mockup with screenshots */}
          <FadeIn direction="left" className="flex justify-center">
            <div className="relative">
              {/* Phone frame — matches the wallet/platform frame: thin uniform
                  bezel, small dynamic island, light shadow + 1px ring */}
              <div
                className="relative mx-auto overflow-hidden"
                style={{
                  width: 260,
                  padding: 8,
                  borderRadius: 42,
                  background: "oklch(0.18 0.005 285)",
                  boxShadow: "0 24px 70px oklch(0 0 0 / 0.18), 0 0 0 1px var(--mk-border)",
                }}
              >
                {/* Dynamic island */}
                <div
                  className="absolute left-1/2 top-3.5 z-30 -translate-x-1/2 rounded-full bg-black"
                  style={{ width: 78, height: 22 }}
                  aria-hidden="true"
                />

                {/* Screen */}
                <div
                  className="relative overflow-hidden"
                  style={{
                    height: 528,
                    borderRadius: 34,
                    background: "var(--mk-surface)",
                  }}
                >
                  {/* Screenshots — stacked with crossfade */}
                  {SCREENSHOTS.map((shot, i) => (
                    <Image
                      key={shot.id}
                      src={shot.src}
                      alt={t(`screenshots.${shot.id}`)}
                      width={1170}
                      height={2532}
                      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-out"
                      style={{ opacity: activeIdx === i ? 1 : 0 }}
                      sizes="260px"
                      priority={i === 0}
                      loading={i === 0 ? "eager" : "lazy"}
                    />
                  ))}
                </div>
              </div>

              {/* Dot indicators */}
              <div className="flex justify-center gap-2 mt-6">
                {SCREENSHOTS.map((shot, i) => (
                  <button
                    key={shot.id}
                    type="button"
                    aria-label={t(`screenshots.${shot.id}`)}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: activeIdx === i ? 24 : 8,
                      height: 8,
                      background: activeIdx === i ? "var(--mk-brand-purple)" : "var(--mk-border)",
                    }}
                    onClick={() => setActiveIdx(i)}
                  />
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Features + store badges */}
          <div className="flex flex-col gap-8">
            {/* Desktop: 2×2 grid */}
            <Stagger className="hidden sm:grid sm:grid-cols-2 gap-4">
              {features.map((feat) => {
                const Icon = feat.icon
                return (
                  <StaggerItem key={feat.key}>
                    <FeatureCard icon={Icon} title={t(`features.${feat.key}.title`)} description={t(`features.${feat.key}.description`)} />
                  </StaggerItem>
                )
              })}
            </Stagger>

            {/* Mobile: horizontal scroll carousel */}
            <FeaturesCarousel features={features} t={t} />

            {/* App icon + store badges */}
            <FadeIn delay={0.3}>
              <div className="flex flex-row items-center justify-center gap-4">
                <Link
                  href="#"
                  aria-label={t("downloadAppStore")}
                  className="transition-opacity hover:opacity-80"
                >
                  <Image
                    src="/staff-app/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg"
                    alt={t("downloadAppStore")}
                    width={156}
                    height={48}
                    className="h-12 w-auto"
                  />
                </Link>
                <Link
                  href="#"
                  aria-label={t("downloadPlayStore")}
                  className="transition-opacity hover:opacity-80"
                >
                  <Image
                    src="/staff-app/GetItOnGooglePlay_Badge_Web_color_English.svg"
                    alt={t("downloadPlayStore")}
                    width={180}
                    height={48}
                    className="h-12 w-auto"
                  />
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Feature card (shared) ───────────────────────────────────────── */

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ScanLine
  title: string
  description: string
}) {
  return (
    <div
      className="rounded-xl p-5 h-full transition-colors duration-200"
      style={{
        background: "var(--mk-card)",
        border: "1px solid var(--mk-border)",
      }}
    >
      <div
        className="size-10 rounded-lg flex items-center justify-center mb-3"
        style={{ background: "oklch(0.704 0.193 32 / 0.1)" }}
      >
        <Icon
          className="size-5"
          style={{ color: "var(--mk-brand-purple)" }}
          strokeWidth={1.5}
        />
      </div>
      <h3
        className="text-[15px] font-semibold mb-1"
        style={{ color: "var(--mk-text)" }}
      >
        {title}
      </h3>
      <p
        className="text-[13px] leading-relaxed"
        style={{ color: "var(--mk-text-muted)" }}
      >
        {description}
      </p>
    </div>
  )
}

/* ─── Mobile features carousel ────────────────────────────────────── */

function FeaturesCarousel({
  features,
  t,
}: {
  features: { icon: typeof ScanLine; key: string }[]
  t: ReturnType<typeof useTranslations>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeFeature, setActiveFeature] = useState(0)

  const scroll = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 260
    const gap = 12
    const next = dir === "left" ? activeFeature - 1 : activeFeature + 1
    const clamped = Math.max(0, Math.min(next, features.length - 1))
    el.scrollTo({ left: clamped * (cardWidth + gap), behavior: "smooth" })
    setActiveFeature(clamped)
  }, [activeFeature, features.length])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 260
    const gap = 12
    const idx = Math.round(el.scrollLeft / (cardWidth + gap))
    setActiveFeature(Math.max(0, Math.min(idx, features.length - 1)))
  }, [features.length])

  return (
    <div className="sm:hidden">
      <div className="relative">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 -mx-6 px-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {features.map((feat) => {
            const Icon = feat.icon
            return (
              <div key={feat.key} className="snap-center shrink-0 w-[75vw] max-w-[280px]">
                <FeatureCard
                  icon={Icon}
                  title={t(`features.${feat.key}.title`)}
                  description={t(`features.${feat.key}.description`)}
                />
              </div>
            )
          })}
        </div>

        {/* Nav arrows */}
        {activeFeature > 0 && (
          <button
            type="button"
            aria-label="Previous feature"
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 size-8 rounded-full flex items-center justify-center"
            style={{
              background: "var(--mk-card)",
              border: "1px solid var(--mk-border)",
              boxShadow: "0 2px 8px oklch(0 0 0 / 0.1)",
            }}
          >
            <ChevronLeft className="size-4" style={{ color: "var(--mk-text)" }} />
          </button>
        )}
        {activeFeature < features.length - 1 && (
          <button
            type="button"
            aria-label="Next feature"
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 size-8 rounded-full flex items-center justify-center"
            style={{
              background: "var(--mk-card)",
              border: "1px solid var(--mk-border)",
              boxShadow: "0 2px 8px oklch(0 0 0 / 0.1)",
            }}
          >
            <ChevronRight className="size-4" style={{ color: "var(--mk-text)" }} />
          </button>
        )}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {features.map((feat, i) => (
          <div
            key={feat.key}
            className="rounded-full transition-all duration-300"
            style={{
              width: activeFeature === i ? 20 : 6,
              height: 6,
              background: activeFeature === i ? "var(--mk-brand-purple)" : "var(--mk-border)",
            }}
          />
        ))}
      </div>
    </div>
  )
}

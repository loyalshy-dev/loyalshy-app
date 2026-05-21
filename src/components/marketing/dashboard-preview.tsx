"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { BarChart3, CreditCard, Palette, QrCode, Smartphone, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { FadeIn, ScaleIn } from "./motion"

/* ─── Main component ──────────────────────────────────────────────── */

export function FeatureShowcase() {
  const t = useTranslations("featureShowcase")
  const [activeTab, setActiveTab] = useState("dashboard")
  // Must match SSR (false) so hydration doesn't mismatch; the mount effect
  // below syncs the real value, forcing a post-hydration re-render. Mobile
  // swaps the desktop browser mockup for a phone mockup with mobile shots.
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    setCompact(mq.matches)
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const FEATURES = [
    {
      id: "dashboard",
      label: t("tabs.dashboard.label"),
      icon: BarChart3,
      description: t("tabs.dashboard.description"),
      image: "/platform/dashboard.webp",
      mobileImage: "/platform/mobile/dashboard.webp",
      alt: t("tabs.dashboard.alt"),
    },
    {
      id: "card-designer",
      label: t("tabs.cardDesigner.label"),
      icon: Palette,
      description: t("tabs.cardDesigner.description"),
      image: "/platform/studio.webp",
      mobileImage: "/platform/mobile/studio.webp",
      alt: t("tabs.cardDesigner.alt"),
    },
    {
      id: "programs",
      label: t("tabs.programs.label"),
      icon: CreditCard,
      description: t("tabs.programs.description"),
      image: "/platform/cards.webp",
      mobileImage: "/platform/mobile/cards.webp",
      alt: t("tabs.programs.alt"),
    },
    {
      id: "passes",
      label: t("tabs.passes.label"),
      icon: Smartphone,
      description: t("tabs.passes.description"),
      image: "/platform/passes.webp",
      mobileImage: "/platform/mobile/passes.webp",
      alt: t("tabs.passes.alt"),
    },
    {
      id: "distribution",
      label: t("tabs.distribution.label"),
      icon: QrCode,
      description: t("tabs.distribution.description"),
      image: "/platform/distribution.webp",
      mobileImage: "/platform/mobile/distribution.webp",
      alt: t("tabs.distribution.alt"),
    },
    {
      id: "team",
      label: t("tabs.team.label"),
      icon: Users,
      description: t("tabs.team.description"),
      image: "/platform/team.webp",
      mobileImage: "/platform/mobile/team.webp",
      alt: t("tabs.team.alt"),
    },
  ]

  const activeFeature = FEATURES.find((f) => f.id === activeTab) ?? FEATURES[0]

  return (
    <section className="relative py-16 sm:py-24 md:py-28 overflow-hidden" style={{ background: "var(--mk-bg)" }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Section heading */}
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-10">
            <p
              className="text-[13px] font-bold tracking-wide mb-4"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="mk-clamp-h2 font-black tracking-tight"
              style={{ color: "var(--mk-text)" }}
            >
              {t("title")}
            </h2>
          </div>
        </FadeIn>

        {/* Product mockup with active screenshot — phone on mobile, browser on desktop */}
        <ScaleIn>
          {compact ? (
            /* Phone mockup — mobile screenshots */
            <div className="relative mx-auto" style={{ width: 260 }}>
              <div
                className="relative overflow-hidden"
                style={{
                  borderRadius: 42,
                  background: "oklch(0.18 0.005 285)",
                  padding: 8,
                  boxShadow:
                    "0 24px 70px oklch(0 0 0 / 0.18), 0 0 0 1px var(--mk-border)",
                }}
              >
                {/* Dynamic island */}
                <div
                  className="absolute left-1/2 top-3.5 z-20 -translate-x-1/2 rounded-full bg-black"
                  style={{ width: 78, height: 22 }}
                  aria-hidden="true"
                />
                {/* Screen — all images stacked, only active one visible */}
                <div
                  className="relative overflow-hidden"
                  style={{ borderRadius: 34, aspectRatio: "390 / 844", background: "var(--mk-surface)" }}
                >
                  {FEATURES.map((feature) => (
                    <Image
                      key={feature.id}
                      src={feature.mobileImage}
                      alt={feature.alt}
                      width={780}
                      height={1688}
                      className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 ease-out"
                      style={{ opacity: activeTab === feature.id ? 1 : 0 }}
                      sizes="260px"
                      priority={feature.id === "dashboard"}
                      loading={feature.id === "dashboard" ? "eager" : "lazy"}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Browser mockup — desktop screenshots */
            <div
              className="relative mx-auto max-w-5xl rounded-2xl overflow-hidden"
              style={{
                background: "var(--mk-card)",
                border: "1px solid var(--mk-border)",
                boxShadow:
                  "0 24px 80px oklch(0 0 0 / 0.10), 0 8px 24px oklch(0 0 0 / 0.06)",
              }}
            >
              {/* Browser bar */}
              <div
                className="flex items-center gap-2 px-4 py-2.5"
                style={{ borderBottom: "1px solid var(--mk-border)" }}
              >
                <div className="flex gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ background: "oklch(0.65 0.2 25)" }} />
                  <div className="size-2.5 rounded-full" style={{ background: "oklch(0.80 0.15 95)" }} />
                  <div className="size-2.5 rounded-full" style={{ background: "oklch(0.65 0.18 145)" }} />
                </div>
                <div
                  className="mx-auto rounded-md px-4 py-1 text-[11px]"
                  style={{ background: "var(--mk-surface)", color: "var(--mk-text-dimmed)", border: "1px solid var(--mk-border)" }}
                >
                  {t("browserUrl")}
                </div>
              </div>

              {/* Screenshot area — all images stacked, only active one visible */}
              <div className="relative overflow-hidden aspect-video">
                {FEATURES.map((feature) => (
                  <Image
                    key={feature.id}
                    src={feature.image}
                    alt={feature.alt}
                    width={1920}
                    height={1080}
                    className="w-full h-auto transition-opacity duration-300 ease-out"
                    style={{
                      opacity: activeTab === feature.id ? 1 : 0,
                      position: activeTab === feature.id ? "relative" : "absolute",
                      top: 0,
                      left: 0,
                    }}
                    sizes="(max-width: 1280px) 100vw, 1280px"
                    priority={feature.id === "dashboard"}
                    loading={feature.id === "dashboard" ? "eager" : "lazy"}
                  />
                ))}
              </div>
            </div>
          )}
        </ScaleIn>

        {/* Tab bar */}
        <FadeIn delay={0.2}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              const isActive = activeTab === feature.id
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setActiveTab(feature.id)}
                  className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium transition-all duration-200"
                  style={
                    isActive
                      ? {
                          background: "var(--mk-text)",
                          color: "var(--mk-bg)",
                        }
                      : {
                          background: "transparent",
                          color: "var(--mk-text-muted)",
                          border: "1px solid transparent",
                        }
                  }
                >
                  <Icon className="size-4" strokeWidth={1.5} />
                  <span className="hidden sm:inline">{feature.label}</span>
                </button>
              )
            })}
          </div>
        </FadeIn>

        {/* Description */}
        <FadeIn delay={0.3}>
          <p
            key={activeTab}
            className="mt-5 mx-auto max-w-xl text-center text-[16px] leading-relaxed"
            style={{ color: "var(--mk-text-muted)" }}
          >
            {activeFeature.description}
          </p>
        </FadeIn>
      </div>
    </section>
  )
}

"use client"

import { useState } from "react"
import Image from "next/image"
import { BarChart3, CreditCard, Palette, QrCode, Smartphone, Users } from "lucide-react" // icons kept for feature data
import { useTranslations } from "next-intl"
import { FadeIn, ScaleIn } from "./motion"

/* ─── Main component ──────────────────────────────────────────────── */

export function FeatureShowcase() {
  const t = useTranslations("featureShowcase")
  const [activeTab, setActiveTab] = useState("dashboard")

  const FEATURES = [
    {
      id: "dashboard",
      label: t("tabs.dashboard.label"),
      icon: BarChart3,
      description: t("tabs.dashboard.description"),
      image: "/platform/dashboard.webp",
      alt: t("tabs.dashboard.alt"),
    },
    {
      id: "card-designer",
      label: t("tabs.cardDesigner.label"),
      icon: Palette,
      description: t("tabs.cardDesigner.description"),
      image: "/platform/studio.webp",
      alt: t("tabs.cardDesigner.alt"),
    },
    {
      id: "programs",
      label: t("tabs.programs.label"),
      icon: CreditCard,
      description: t("tabs.programs.description"),
      image: "/platform/cards.webp",
      alt: t("tabs.programs.alt"),
    },
    {
      id: "passes",
      label: t("tabs.passes.label"),
      icon: Smartphone,
      description: t("tabs.passes.description"),
      image: "/platform/passes.webp",
      alt: t("tabs.passes.alt"),
    },
    {
      id: "distribution",
      label: t("tabs.distribution.label"),
      icon: QrCode,
      description: t("tabs.distribution.description"),
      image: "/platform/distribution.webp",
      alt: t("tabs.distribution.alt"),
    },
    {
      id: "team",
      label: t("tabs.team.label"),
      icon: Users,
      description: t("tabs.team.description"),
      image: "/platform/team.webp",
      alt: t("tabs.team.alt"),
    },
  ]

  const activeFeature = FEATURES.find((f) => f.id === activeTab) ?? FEATURES[0]

  return (
    <section className="relative py-24 overflow-hidden" style={{ background: "var(--mk-bg)" }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Section heading */}
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-16">
            <p
              className="text-[13px] font-black uppercase tracking-[0.2em] mb-4"
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

        {/* Browser mockup with tabs inside chrome */}
        <ScaleIn>
          <div
            className="relative mx-auto rounded-2xl overflow-hidden"
            style={{
              background: "var(--mk-card)",
              border: "1px solid var(--mk-border)",
              boxShadow:
                "0 24px 80px oklch(0 0 0 / 0.10), 0 8px 24px oklch(0 0 0 / 0.06)",
            }}
          >
            {/* Browser chrome bar */}
            <div
              className="flex items-center gap-4 px-4 py-3"
              style={{
                background: "var(--mk-surface)",
                borderBottom: "1px solid var(--mk-border)",
              }}
            >
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full" style={{ background: "oklch(0.65 0.2 25)" }} />
                <div className="size-3 rounded-full" style={{ background: "oklch(0.80 0.15 95)" }} />
                <div className="size-3 rounded-full" style={{ background: "oklch(0.65 0.18 145)" }} />
              </div>
              <div className="flex-1 flex justify-center">
                <div
                  className="rounded-md px-4 py-1 text-[11px] w-full max-w-sm text-center"
                  style={{
                    background: "var(--mk-card)",
                    color: "var(--mk-text-dimmed)",
                  }}
                >
                  {t("browserUrl")}
                </div>
              </div>
            </div>

            {/* Tabs inside the mockup */}
            <div
              className="flex overflow-x-auto"
              style={{
                background: "var(--mk-surface)",
                borderBottom: "1px solid var(--mk-border)",
              }}
            >
              {FEATURES.map((feature) => {
                const isActive = activeTab === feature.id
                return (
                  <button
                    key={feature.id}
                    type="button"
                    onClick={() => setActiveTab(feature.id)}
                    className="px-6 py-4 text-xs font-bold whitespace-nowrap transition-all"
                    style={{
                      borderBottom: isActive ? "2px solid var(--mk-brand-purple)" : "2px solid transparent",
                      color: isActive ? "var(--mk-brand-purple)" : "var(--mk-text-dimmed)",
                      background: isActive ? "var(--mk-card)" : "transparent",
                    }}
                  >
                    {feature.label}
                  </button>
                )
              })}
            </div>

            {/* Screenshot area — all images stacked, only active one visible */}
            <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
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
        </ScaleIn>
      </div>
    </section>
  )
}

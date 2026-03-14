"use client"

import { useState } from "react"
import Image from "next/image"
import { BarChart3, CreditCard, Palette, QrCode, Smartphone, Users } from "lucide-react"
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
    <section className="py-20 sm:py-28" style={{ background: "var(--mk-bg)" }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Section heading */}
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-10">
            <p
              className="text-[13px] font-medium uppercase tracking-widest mb-3"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="text-3xl sm:text-[2.5rem] font-bold"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
            >
              {t("title")}
            </h2>
          </div>
        </FadeIn>

        {/* Browser mockup with active screenshot */}
        <ScaleIn>
          <div
            className="relative mx-auto max-w-5xl rounded-xl overflow-hidden"
            style={{
              background: "var(--mk-card)",
              border: "1px solid var(--mk-border)",
              boxShadow:
                "0 20px 60px oklch(0 0 0 / 0.08), 0 0 0 1px oklch(0 0 0 / 0.03)",
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

            {/* Screenshot area — only render active image to avoid loading all 6 */}
            <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
              <Image
                key={activeTab}
                src={activeFeature.image}
                alt={activeFeature.alt}
                width={1920}
                height={1080}
                className="w-full h-auto"
                sizes="(max-width: 1280px) 100vw, 1280px"
                priority={activeTab === "dashboard"}
                loading={activeTab === "dashboard" ? "eager" : "lazy"}
              />
            </div>
          </div>
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

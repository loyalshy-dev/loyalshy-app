"use client"

import { useState } from "react"
import Image from "next/image"
import { BarChart3, CreditCard, Palette, QrCode, Smartphone, Users } from "lucide-react"
import { FadeIn, ScaleIn } from "./motion"

const FEATURES = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: BarChart3,
    description:
      "Get a real-time overview of visits, rewards, and customer engagement — all in one place.",
    image: "/platform/dashboard.png",
    alt: "Program overview dashboard with stat cards and template details",
  },
  {
    id: "card-designer",
    label: "Card Designer",
    icon: Palette,
    description:
      "Design stunning loyalty cards with our visual studio. Your brand, your style.",
    image: "/platform/studio.png",
    alt: "Card design studio with floating toolbar and live wallet pass preview",
  },
  {
    id: "programs",
    label: "Programs",
    icon: CreditCard,
    description:
      "Manage all your loyalty programs in one place. Stamp cards, coupons, memberships, and more.",
    image: "/platform/cards.png",
    alt: "Programs grid showing different loyalty card types and designs",
  },
  {
    id: "passes",
    label: "Passes",
    icon: Smartphone,
    description:
      "Track every issued pass. Filter by status, search contacts, and manage pass lifecycle.",
    image: "/platform/passes.png",
    alt: "Pass instances list with status filters and search",
  },
  {
    id: "distribution",
    label: "Distribution",
    icon: QrCode,
    description:
      "Generate QR codes, share links, and issue passes directly. Multiple sizes for print.",
    image: "/platform/distribution.png",
    alt: "Distribution page with QR code, shareable link, and print sizes",
  },
  {
    id: "team",
    label: "Team",
    icon: Users,
    description:
      "Invite staff with role-based access. Owners and staff see different views.",
    image: "/platform/team.png",
    alt: "Team settings showing members with roles and invite button",
  },
] as const

/* ─── Main component ──────────────────────────────────────────────── */

export function FeatureShowcase() {
  const [activeTab, setActiveTab] = useState("dashboard")
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
              Platform
            </p>
            <h2
              className="text-3xl sm:text-[2.5rem] font-bold"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
            >
              Everything in one place
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
                app.loyalshy.com
              </div>
            </div>

            {/* Screenshot area */}
            <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
              {FEATURES.map((feature) => (
                <Image
                  key={feature.id}
                  src={feature.image}
                  alt={feature.alt}
                  width={1920}
                  height={1080}
                  className="w-full h-auto transition-opacity duration-300"
                  style={{
                    opacity: activeTab === feature.id ? 1 : 0,
                    position: activeTab === feature.id ? "relative" : "absolute",
                    top: 0,
                    left: 0,
                  }}
                  priority={feature.id === "dashboard" && activeTab === "dashboard"}
                  loading={activeTab === feature.id ? "eager" : "lazy"}
                />
              ))}
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

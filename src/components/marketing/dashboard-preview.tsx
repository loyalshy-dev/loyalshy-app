"use client"

import { useState } from "react"
import { Play } from "lucide-react"

const FEATURES = [
  {
    id: "dashboard",
    label: "Dashboard",
    description:
      "Get a real-time overview of visits, rewards, and customer engagement — all in one place.",
  },
  {
    id: "wallet-passes",
    label: "Wallet Passes",
    description:
      "Beautiful Apple & Google Wallet passes that update automatically on every visit.",
  },
  {
    id: "card-designer",
    label: "Card Designer",
    description:
      "Design stunning loyalty cards with our drag-and-drop studio. Your brand, your style.",
  },
  {
    id: "qr-codes",
    label: "QR Codes",
    description:
      "Generate unique QR codes for your counter or tables. Customers scan once to join.",
  },
  {
    id: "analytics",
    label: "Analytics",
    description:
      "Track visit trends, busiest days, top customers, and reward redemption rates.",
  },
  {
    id: "team",
    label: "Team",
    description:
      "Invite staff with role-based access. Owners and staff see different views.",
  },
] as const

export function FeatureShowcase() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const activeFeature = FEATURES.find((f) => f.id === activeTab) ?? FEATURES[0]

  return (
    <section className="py-20 sm:py-28" style={{ background: "var(--mk-bg)" }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Video / image placeholder */}
        <div
          className="relative mx-auto max-w-5xl rounded-2xl overflow-hidden"
          style={{
            background: "var(--mk-surface)",
            border: "1px solid var(--mk-border)",
            boxShadow: "0 8px 40px oklch(0 0 0 / 0.08), 0 0 0 1px oklch(0 0 0 / 0.03)",
            aspectRatio: "16 / 9",
          }}
        >
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              className="flex size-16 sm:size-20 items-center justify-center rounded-full transition-transform hover:scale-105"
              style={{
                background: "var(--mk-card)",
                boxShadow: "0 4px 20px oklch(0 0 0 / 0.12)",
              }}
              aria-label="Play video"
            >
              <Play
                className="size-6 sm:size-8 ml-1"
                style={{ color: "var(--mk-text)" }}
              />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {FEATURES.map((feature) => (
            <button
              key={feature.id}
              type="button"
              onClick={() => setActiveTab(feature.id)}
              className="rounded-full px-5 py-2.5 text-[14px] font-medium transition-all"
              style={
                activeTab === feature.id
                  ? {
                      background: "var(--mk-text)",
                      color: "var(--mk-bg)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--mk-text-muted)",
                    }
              }
            >
              {feature.label}
            </button>
          ))}
        </div>

        {/* Description */}
        <p
          className="mt-6 mx-auto max-w-xl text-center text-base leading-relaxed"
          style={{ color: "var(--mk-text-muted)" }}
        >
          {activeFeature.description}
        </p>
      </div>
    </section>
  )
}

import type React from "react"
import { Smartphone, Wallet, BarChart3, Users, Palette, QrCode, Zap, Bell } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Stagger, StaggerItem } from "./motion"

/* ─── Bento card ──────────────────────────────────────────────────── */

function FeatureCard({
  icon: Icon,
  title,
  description,
  size,
}: {
  icon: React.ElementType
  title: string
  description: string
  size: "large" | "small"
}) {
  const isLarge = size === "large"

  return (
    <div
      className={`group relative flex flex-col gap-4 p-8 hover:-translate-y-1 transition-all duration-250 h-full mk-card-glass overflow-hidden ${
        isLarge ? "sm:col-span-2" : ""
      }`}
    >
      {/* Top accent on hover — thicker gradient line */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(90deg, var(--mk-brand-purple), var(--mk-brand-green))",
        }}
      />

      <div className="flex flex-col gap-4">
        {/* Icon */}
        <Icon
          className="size-7 transition-colors duration-200 group-hover:text-[oklch(0.55_0.2_265)]"
          strokeWidth={1.5}
          style={{ color: "var(--mk-text-muted)" }}
        />

        {/* Text */}
        <div className="space-y-2">
          <h3
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--mk-text)" }}
          >
            {title}
          </h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--mk-text-muted)" }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Section ─────────────────────────────────────────────────────── */

export async function Features() {
  const t = await getTranslations("features")

  const features = [
    {
      icon: Smartphone,
      title: t("appleWallet.title"),
      description: t("appleWallet.description"),
      size: "large" as const,
    },
    {
      icon: Wallet,
      title: t("googleWallet.title"),
      description: t("googleWallet.description"),
      size: "small" as const,
    },
    {
      icon: BarChart3,
      title: t("analytics.title"),
      description: t("analytics.description"),
      size: "small" as const,
    },
    {
      icon: Palette,
      title: t("designer.title"),
      description: t("designer.description"),
      size: "large" as const,
    },
    {
      icon: QrCode,
      title: t("qr.title"),
      description: t("qr.description"),
      size: "small" as const,
    },
    {
      icon: Users,
      title: t("team.title"),
      description: t("team.description"),
      size: "small" as const,
    },
    {
      icon: Zap,
      title: t("passTypes.title"),
      description: t("passTypes.description"),
      size: "large" as const,
    },
    {
      icon: Bell,
      title: t("pushNotifications.title"),
      description: t("pushNotifications.description"),
      size: "large" as const,
    },
  ]

  return (
    <section
      id="features"
      className="relative py-16 sm:py-24 md:py-32 overflow-hidden"
      style={{ background: "var(--mk-bg)" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Stagger
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4 md:grid-rows-2"
          stagger={0.07}
        >
          {features.map((feature) => (
            <StaggerItem key={feature.title} className="h-full">
              <FeatureCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                size={feature.size}
              />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

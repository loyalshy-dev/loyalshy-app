import type React from "react"
import { Smartphone, Wallet, BarChart3, Users, Palette, QrCode, Zap, Shield } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { FadeIn, Stagger, StaggerItem } from "./motion"

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
      className={`group relative flex flex-col gap-4 p-6 rounded-2xl hover:-translate-y-1 transition-all duration-250 ${
        isLarge ? "sm:col-span-2" : ""
      }`}
      style={{
        background: "var(--mk-card)",
        border: "1px solid var(--mk-border)",
        boxShadow: "0 1px 3px oklch(0 0 0 / 0.06), 0 4px 16px oklch(0 0 0 / 0.04)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Top accent on hover */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.55 0.2 265 / 0.4), transparent)",
        }}
      />

      <div className="flex flex-col gap-4">
        {/* Icon */}
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 group-hover:bg-[oklch(0.55_0.2_265/0.08)]"
          style={{
            background: "var(--mk-surface)",
            border: "1px solid var(--mk-border)",
          }}
        >
          <Icon
            className="size-5 transition-colors duration-200 group-hover:text-[oklch(0.55_0.2_265)]"
            strokeWidth={1.5}
            style={{ color: "var(--mk-text-muted)" }}
          />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h3
            className="text-[15px] font-semibold"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.01em" }}
          >
            {title}
          </h3>
          <p
            className="text-[14px] leading-relaxed"
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
      icon: Shield,
      title: t("security.title"),
      description: t("security.description"),
      size: "large" as const,
    },
  ]

  return (
    <section
      id="features"
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: "var(--mk-surface)" }}
    >
      {/* Gradient mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 50% 60% at 20% 40%, oklch(0.55 0.2 265 / 0.04) 0%, transparent 70%),
            radial-gradient(ellipse 50% 50% at 80% 60%, oklch(0.55 0.17 155 / 0.03) 0%, transparent 70%)
          `,
        }}
      />

      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-14 sm:mb-16">
            <p
              className="text-[13px] font-medium uppercase tracking-widest mb-3"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="text-3xl sm:text-[2.75rem] font-bold"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.035em" }}
            >
              {t("title")}
            </h2>
            <p
              className="mt-4 text-[16px] leading-relaxed"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("subtitle")}
            </p>
          </div>
        </FadeIn>

        <Stagger
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          stagger={0.07}
        >
          {features.map((feature) => (
            <StaggerItem key={feature.title}>
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

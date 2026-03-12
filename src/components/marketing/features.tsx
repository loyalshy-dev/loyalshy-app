import { Smartphone, Wallet, BarChart3, Users, Palette, QrCode, Zap, Shield } from "lucide-react"
import { FadeIn, Stagger, StaggerItem } from "./motion"

const features = [
  {
    icon: Smartphone,
    title: "Apple Wallet",
    description:
      "Native passes that live right next to boarding passes and tickets. Auto-update on every visit.",
    size: "large" as const,
  },
  {
    icon: Wallet,
    title: "Google Wallet",
    description:
      "Full Android support. Passes update automatically — no app needed.",
    size: "small" as const,
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description:
      "Track visits, rewards, and engagement with beautiful dashboards and exportable reports.",
    size: "small" as const,
  },
  {
    icon: Palette,
    title: "Card Designer",
    description:
      "Design stunning loyalty cards with our visual studio. Upload logos, choose colors, pick patterns — make it yours.",
    size: "large" as const,
  },
  {
    icon: QrCode,
    title: "QR Onboarding",
    description:
      "Print a QR code, place it at your counter. Customers join in seconds — no app downloads.",
    size: "small" as const,
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Invite staff with role-based access. Owners and staff see different views.",
    size: "small" as const,
  },
  {
    icon: Zap,
    title: "10 Pass Types",
    description:
      "Stamp cards, coupons, memberships, points, prepaid, gift cards, tickets, access passes, transit, and business IDs.",
    size: "large" as const,
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description:
      "Enterprise-grade encryption, secure auth, and GDPR-ready. Your customer data stays yours.",
    size: "small" as const,
  },
]

/* ─── Bento card ──────────────────────────────────────────────────── */

function FeatureCard({
  icon: Icon,
  title,
  description,
  size,
}: {
  icon: typeof features[number]["icon"]
  title: string
  description: string
  size: "large" | "small"
}) {
  const isLarge = size === "large"

  return (
    <div
      className={`group relative mk-card-glass flex flex-col gap-4 p-6 hover:-translate-y-1 ${
        isLarge ? "sm:col-span-2" : ""
      }`}
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

      <div className={`flex ${isLarge ? "flex-row items-start gap-5" : "flex-col gap-4"}`}>
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

export function Features() {
  return (
    <section
      id="features"
      className="py-24 sm:py-32"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-14 sm:mb-16">
            <p
              className="text-[13px] font-medium uppercase tracking-widest mb-3"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              Features
            </p>
            <h2
              className="text-3xl sm:text-[2.5rem] font-bold"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
            >
              Everything you need to grow loyalty
            </h2>
            <p
              className="mt-4 text-[16px] leading-relaxed"
              style={{ color: "var(--mk-text-muted)" }}
            >
              A complete platform built for businesses that take customer retention seriously
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

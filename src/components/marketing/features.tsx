import { Smartphone, Wallet, BarChart3, Users, Palette, QrCode } from "lucide-react"

const features = [
  {
    icon: Smartphone,
    title: "Apple Wallet",
    description:
      "Native Apple Wallet passes that live right next to boarding passes and tickets.",
  },
  {
    icon: Wallet,
    title: "Google Wallet",
    description:
      "Full Google Wallet support for Android users. Auto-updates on every visit.",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description:
      "Track visits, rewards, and customer engagement with beautiful dashboards.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Invite staff with role-based access. Owners and staff see different views.",
  },
  {
    icon: Palette,
    title: "Custom Branding",
    description:
      "Your logo, your colors. Every pass and page matches your restaurant's identity.",
  },
  {
    icon: QrCode,
    title: "QR Onboarding",
    description:
      "Print a QR code, place it at your counter. Customers join in seconds.",
  },
] as const

type FeatureCardProps = {
  icon: typeof features[number]["icon"]
  title: string
  description: string
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative mk-card-glass flex flex-col gap-4 p-6 hover:-translate-y-1">
      {/* Top-edge accent on hover */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: "linear-gradient(90deg, transparent, oklch(0.55 0.2 265 / 0.4), transparent)",
        }}
      />

      <div
        className="flex size-10 items-center justify-center rounded-lg transition-colors duration-200 group-hover:bg-[oklch(0.55_0.2_265/0.08)]"
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

      <div className="space-y-1.5">
        <h3
          className="text-[14px] font-semibold"
          style={{ color: "var(--mk-text)", letterSpacing: "-0.01em" }}
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
    </div>
  )
}

export function Features() {
  return (
    <section
      id="features"
      className="py-24 sm:py-32"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-14 sm:mb-16">
          <p
            className="text-[13px] font-medium uppercase tracking-widest mb-3"
            style={{ color: "var(--mk-brand-purple)" }}
          >
            Features
          </p>
          <h2
            className="text-3xl sm:text-4xl font-semibold"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.025em" }}
          >
            Everything you need
          </h2>
          <p
            className="mt-4 text-[15px] leading-relaxed"
            style={{ color: "var(--mk-text-muted)" }}
          >
            Built for restaurants that take customer loyalty seriously
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

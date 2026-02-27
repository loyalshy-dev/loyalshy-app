/**
 * Features — Marketing section component
 *
 * Usage:
 *   import { Features } from "@/components/marketing/features"
 *   <Features />
 *
 * Server Component — no client-side interactivity required.
 */

import { Smartphone, Wallet, BarChart3, Users, Palette, QrCode } from "lucide-react"

// ─── Feature Data ──────────────────────────────────────────

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

// ─── Feature Card ──────────────────────────────────────────

type FeatureCardProps = {
  icon: typeof features[number]["icon"]
  title: string
  description: string
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border/80">
      {/* Subtle top-edge gradient accent on hover */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-brand/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />

      {/* Icon */}
      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/60 transition-colors duration-200 group-hover:bg-brand/8 group-hover:border-brand/20">
        <Icon className="size-5 text-muted-foreground transition-colors duration-200 group-hover:text-brand" strokeWidth={1.5} />
      </div>

      {/* Text */}
      <div className="space-y-1.5">
        <h3 className="text-[14px] font-semibold text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────

export function Features() {
  return (
    <section
      id="features"
      className="py-24 sm:py-32 bg-muted/30"
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">

        {/* — Heading — */}
        <div className="mx-auto max-w-2xl text-center mb-14 sm:mb-16">
          <p className="text-[13px] font-medium text-brand uppercase tracking-widest mb-3">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Everything you need
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Built for restaurants that take customer loyalty seriously
          </p>
        </div>

        {/* — Grid — */}
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

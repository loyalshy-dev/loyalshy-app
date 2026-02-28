"use client"

import * as React from "react"
import Link from "next/link"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"

// ─── Plan Data (client-safe, no server import) ────────────────────────────────

type PlanDef = {
  name: string
  description: string
  monthlyPrice: number | null
  annualPrice: number | null
  customerLimit: number
  staffLimit: number
  features: string[]
}

const PLANS: Record<"STARTER" | "PRO" | "BUSINESS", PlanDef> = {
  STARTER: {
    name: "Starter",
    description: "For small restaurants getting started",
    monthlyPrice: 15,
    annualPrice: 12,
    customerLimit: 200,
    staffLimit: 2,
    features: [
      "Up to 200 customers",
      "2 staff members",
      "Apple & Google Wallet passes",
      "Card design studio",
      "Dashboard analytics",
    ],
  },
  PRO: {
    name: "Pro",
    description: "For growing restaurants",
    monthlyPrice: 39,
    annualPrice: 31,
    customerLimit: 1_000,
    staffLimit: 5,
    features: [
      "Up to 1,000 customers",
      "5 staff members",
      "Apple & Google Wallet passes",
      "Card design studio",
      "Dashboard analytics",
      "Email support",
    ],
  },
  BUSINESS: {
    name: "Business",
    description: "For serious loyalty programs",
    monthlyPrice: 79,
    annualPrice: 63,
    customerLimit: Infinity,
    staffLimit: 15,
    features: [
      "Unlimited customers",
      "15 staff members",
      "Apple & Google Wallet passes",
      "Card design studio",
      "Dashboard analytics",
      "Priority support",
    ],
  },
}

const ENTERPRISE = {
  name: "Enterprise",
  description: "Custom solutions for large chains",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price === null) return "Custom"
  return `$${price}`
}

function formatLimit(limit: number): string {
  return limit === Infinity ? "Unlimited" : limit.toString()
}

// ─── Billing Toggle ───────────────────────────────────────────────────────────

type BillingPeriod = "monthly" | "annual"

function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod
  onChange: (p: BillingPeriod) => void
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={[
          "rounded-lg px-4 py-2 text-[13px] font-medium transition-all",
          period === "monthly"
            ? "bg-foreground text-background shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={[
          "rounded-lg px-4 py-2 text-[13px] font-medium transition-all relative",
          period === "annual"
            ? "bg-foreground text-background shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        Annual
        <span
          className="absolute -top-2.5 -right-10 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
          style={{
            background: "oklch(0.58 0.16 145 / 0.15)",
            color: "var(--success)",
          }}
        >
          -20%
        </span>
      </button>
    </div>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

type PlanCardProps = {
  planKey: "STARTER" | "PRO" | "BUSINESS"
  highlighted?: boolean
  period: BillingPeriod
}

function PlanCard({ planKey, highlighted = false, period }: PlanCardProps) {
  const plan = PLANS[planKey]
  const price = period === "annual" ? plan.annualPrice : plan.monthlyPrice

  return (
    <div
      className={[
        "relative flex flex-col rounded-xl border p-6 transition-shadow",
        highlighted
          ? "border-brand bg-card shadow-[0_0_0_1px_var(--brand),0_8px_32px_oklch(0_0_0/0.08)]"
          : "border-border bg-card shadow-[0_2px_8px_oklch(0_0_0/0.04)]",
      ].join(" ")}
    >
      {/* Most Popular badge */}
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className="inline-flex items-center rounded-full px-3 py-0.5 text-[11px] font-semibold tracking-wide uppercase"
            style={{
              background: "var(--brand)",
              color: "var(--brand-foreground)",
              letterSpacing: "0.07em",
            }}
          >
            Most Popular
          </span>
        </div>
      )}

      {/* Plan name + description */}
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
          {plan.name}
        </p>
        <p className="text-[13px] text-muted-foreground">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-foreground">
          {formatPrice(price)}
        </span>
        <span className="text-[13px] text-muted-foreground">/ month</span>
      </div>

      {/* Annual savings badge */}
      {period === "annual" && plan.monthlyPrice !== null && (
        <p className="text-[12px] text-success font-medium -mt-4 mb-4">
          ${(plan.monthlyPrice - (plan.annualPrice ?? 0)) * 12} saved per year
        </p>
      )}

      {/* CTA */}
      <Button
        asChild
        variant={highlighted ? "default" : "outline"}
        size="lg"
        className={[
          "w-full mb-6 text-[13px] font-medium",
          highlighted
            ? "bg-brand text-brand-foreground hover:opacity-90 border-transparent"
            : "",
        ].join(" ")}
      >
        <Link href="/register">Start Free Trial</Link>
      </Button>

      {/* Divider */}
      <div className="border-t border-border mb-5" />

      {/* Features */}
      <ul className="flex flex-col gap-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 shrink-0"
              style={{
                width: 15,
                height: 15,
                color: highlighted ? "var(--brand)" : "var(--success)",
              }}
            />
            <span className="text-[13px] text-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Limits sub-line */}
      <p className="mt-5 text-[12px] text-muted-foreground">
        Up to {formatLimit(plan.customerLimit)} customers · {formatLimit(plan.staffLimit)} staff
        {plan.staffLimit === 1 ? " member" : " members"}
      </p>
    </div>
  )
}

// ─── Pricing Section ──────────────────────────────────────────────────────────

export function Pricing() {
  const [period, setPeriod] = React.useState<BillingPeriod>("monthly")

  return (
    <section
      id="pricing"
      className="relative py-24 px-4 sm:px-6 overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, oklch(0.55 0.2 265 / 0.05) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl">
        {/* Heading */}
        <div className="text-center mb-10">
          <p className="mb-3 inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
            Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-md mx-auto">
            Start with a 14-day free trial. No credit card required.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mb-10">
          <BillingToggle period={period} onChange={setPeriod} />
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 items-start">
          <PlanCard planKey="STARTER" period={period} />
          <PlanCard planKey="PRO" highlighted period={period} />
          <PlanCard planKey="BUSINESS" period={period} />
        </div>

        {/* Enterprise footer */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-border bg-card px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold text-foreground mb-0.5">
              {ENTERPRISE.name} — {ENTERPRISE.description}
            </p>
            <p className="text-[13px] text-muted-foreground">
              Need more? Contact us for Enterprise pricing with unlimited staff, dedicated support, and SLA guarantees.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 text-[13px]">
            <Link href="mailto:sales@fidelio.app">Contact Sales</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

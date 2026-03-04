"use client"

import * as React from "react"
import Link from "next/link"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PLANS, type PlanId } from "@/lib/plans"

const ENTERPRISE = PLANS.ENTERPRISE

function formatPrice(price: number | null): string {
  if (price === null) return "Custom"
  return `${price}€`
}

function formatLimit(limit: number): string {
  return limit === Infinity ? "Unlimited" : limit.toString()
}

type BillingPeriod = "monthly" | "annual"

function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod
  onChange: (p: BillingPeriod) => void
}) {
  return (
    <div
      className="flex items-center justify-center gap-1 rounded-full p-1"
      style={{ background: "var(--mk-surface)", border: "1px solid var(--mk-border)" }}
    >
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className="rounded-full px-4 py-2 text-[13px] font-medium transition-all"
        style={{
          background: period === "monthly" ? "var(--mk-text)" : "transparent",
          color: period === "monthly" ? "var(--mk-bg)" : "var(--mk-text-muted)",
        }}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className="relative rounded-full px-4 py-2 text-[13px] font-medium transition-all"
        style={{
          background: period === "annual" ? "var(--mk-text)" : "transparent",
          color: period === "annual" ? "var(--mk-bg)" : "var(--mk-text-muted)",
        }}
      >
        Annual
        <span
          className="absolute -top-2.5 -right-10 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
          style={{
            background: "oklch(0.50 0.16 145 / 0.12)",
            color: "oklch(0.45 0.16 145)",
          }}
        >
          -20%
        </span>
      </button>
    </div>
  )
}

type PlanCardProps = {
  planKey: Exclude<PlanId, "ENTERPRISE">
  highlighted?: boolean
  period: BillingPeriod
}


function PlanCard({ planKey, highlighted = false, period }: PlanCardProps) {
  const plan = PLANS[planKey]
  const price = period === "annual" ? plan.annualPrice : plan.price

  return (
    <div
      className="relative flex flex-col rounded-2xl p-6 transition-shadow"
      style={{
        background: "var(--mk-card)",
        border: highlighted
          ? "1px solid oklch(0.55 0.2 265 / 0.3)"
          : "1px solid var(--mk-border)",
        boxShadow: highlighted
          ? "0 0 0 1px oklch(0.55 0.2 265 / 0.15), 0 8px 32px oklch(0 0 0 / 0.08)"
          : "0 1px 3px oklch(0 0 0 / 0.04)",
      }}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className="inline-flex items-center rounded-full px-3 py-0.5 text-[11px] font-semibold tracking-wide uppercase"
            style={{
              background: "linear-gradient(135deg, oklch(0.55 0.2 265), oklch(0.55 0.17 155))",
              color: "oklch(0.99 0 0)",
              letterSpacing: "0.07em",
            }}
          >
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-4">
        <p
          className="text-[13px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          {plan.name}
        </p>
        <p className="text-[13px]" style={{ color: "var(--mk-text-muted)" }}>
          {plan.description}
        </p>
      </div>

      <div className="mb-6 flex items-baseline gap-1">
        <span
          className="text-4xl font-bold tracking-tight"
          style={{ color: "var(--mk-text)" }}
        >
          {formatPrice(price)}
        </span>
        <span className="text-[13px]" style={{ color: "var(--mk-text-dimmed)" }}>
          / month
        </span>
      </div>

      {period === "annual" && plan.price !== null && (
        <p className="text-[12px] font-medium -mt-4 mb-4" style={{ color: "oklch(0.45 0.16 145)" }}>
          {(plan.price - (plan.annualPrice ?? 0)) * 12}€ saved per year
        </p>
      )}

      {highlighted ? (
        <Link
          href="/register"
          className="mk-btn-primary w-full text-center mb-6"
        >
          Start Free Trial
        </Link>
      ) : (
        <Button
          asChild
          variant="outline"
          size="lg"
          className="w-full mb-6 text-[13px] font-medium"
        >
          <Link href="/register">Start Free Trial</Link>
        </Button>
      )}

      <div className="mb-5" style={{ borderTop: "1px solid var(--mk-border)" }} />

      <ul className="flex flex-col gap-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 shrink-0"
              style={{
                width: 15,
                height: 15,
                color: highlighted ? "oklch(0.55 0.2 265)" : "oklch(0.50 0.16 145)",
              }}
            />
            <span className="text-[13px]" style={{ color: "var(--mk-text)" }}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[12px]" style={{ color: "var(--mk-text-dimmed)" }}>
        Up to {formatLimit(plan.customerLimit)} customers · {formatLimit(plan.staffLimit)} staff
        {plan.staffLimit === 1 ? " member" : " members"}
      </p>
    </div>
  )
}

export function Pricing() {
  const [period, setPeriod] = React.useState<BillingPeriod>("monthly")

  return (
    <section
      id="pricing"
      className="relative py-24 px-4 sm:px-6 overflow-hidden"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="relative mx-auto max-w-5xl">
        <div className="text-center mb-10">
          <p
            className="mb-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase"
            style={{
              border: "1px solid var(--mk-border)",
              background: "var(--mk-card)",
              color: "var(--mk-text-dimmed)",
            }}
          >
            Pricing
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold mb-4"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.025em" }}
          >
            Simple, transparent pricing
          </h2>
          <p
            className="text-[15px] max-w-md mx-auto"
            style={{ color: "var(--mk-text-muted)" }}
          >
            Start with a 14-day free trial. No credit card required.
          </p>
        </div>

        <div className="mb-10">
          <BillingToggle period={period} onChange={setPeriod} />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 items-start">
          <PlanCard planKey="STARTER" period={period} />
          <PlanCard planKey="GROWTH" highlighted period={period} />
          <PlanCard planKey="SCALE" period={period} />
        </div>

        <div className="mk-card-glass mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold mb-0.5" style={{ color: "var(--mk-text)" }}>
              {ENTERPRISE.name} — {ENTERPRISE.description}
            </p>
            <p className="text-[13px]" style={{ color: "var(--mk-text-muted)" }}>
              Need more? Contact us for Enterprise pricing with unlimited staff, dedicated support, and SLA guarantees.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 text-[13px]">
            <Link href="mailto:sales@loyalshy.com">Contact Sales</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

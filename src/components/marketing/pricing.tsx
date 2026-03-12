"use client"

import * as React from "react"
import Link from "next/link"
import { Check, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PLANS, type PlanId } from "@/lib/plans"
import { FadeIn, Stagger, StaggerItem } from "./motion"

const ENTERPRISE = PLANS.ENTERPRISE

function formatPrice(price: number | null): string {
  if (price === null) return "Custom"
  return `${price}`
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
      className="inline-flex items-center gap-1 rounded-full p-1"
      style={{
        background: "var(--mk-surface)",
        border: "1px solid var(--mk-border)",
      }}
    >
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className="rounded-full px-5 py-2 text-[14px] font-medium transition-all"
        style={{
          background:
            period === "monthly" ? "var(--mk-text)" : "transparent",
          color:
            period === "monthly" ? "var(--mk-bg)" : "var(--mk-text-muted)",
        }}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className="relative rounded-full px-5 py-2 text-[14px] font-medium transition-all"
        style={{
          background:
            period === "annual" ? "var(--mk-text)" : "transparent",
          color:
            period === "annual" ? "var(--mk-bg)" : "var(--mk-text-muted)",
        }}
      >
        Annual
        <span
          className="absolute -top-2.5 -right-12 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
          style={{
            background: "oklch(0.55 0.17 155 / 0.12)",
            color: "oklch(0.45 0.17 155)",
          }}
        >
          Save 20%
        </span>
      </button>
    </div>
  )
}

/* ─── Free tier card (marketing-only, not in billing system) ─────── */

function FreePlanCard() {
  return (
    <div
      className="relative flex flex-col rounded-2xl p-7 transition-all duration-300"
      style={{
        background: "var(--mk-card)",
        border: "1px solid var(--mk-border)",
        boxShadow: "0 1px 3px oklch(0 0 0 / 0.04)",
      }}
    >
      <div className="mb-5">
        <p
          className="text-[13px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          Free
        </p>
        <p
          className="text-[14px]"
          style={{ color: "var(--mk-text-muted)" }}
        >
          Try Loyalshy with your first customers
        </p>
      </div>

      <div className="mb-2 flex items-baseline gap-1">
        <span
          className="text-5xl font-bold tracking-tight"
          style={{ color: "var(--mk-text)" }}
        >
          0
        </span>
        <span
          className="text-[15px] font-medium"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          &euro;/mo
        </span>
      </div>

      <div className="mb-5" />

      <Button
        asChild
        variant="outline"
        size="lg"
        className="w-full mb-6 text-[14px] font-medium"
      >
        <Link href="/register">Get Started</Link>
      </Button>

      <div
        className="mb-5"
        style={{ borderTop: "1px solid var(--mk-border)" }}
      />

      <ul className="flex flex-col gap-3">
        {[
          "Up to 50 contacts",
          "1 stamp card program",
          "1 staff member",
          "Apple & Google Wallet passes",
          "Card design studio",
          "Dashboard analytics",
        ].map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <div
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: "oklch(0.55 0.17 155 / 0.1)" }}
            >
              <Check
                className="size-3"
                strokeWidth={2.5}
                style={{ color: "oklch(0.50 0.16 145)" }}
              />
            </div>
            <span
              className="text-[14px]"
              style={{ color: "var(--mk-text)" }}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <p
        className="mt-6 text-[13px]"
        style={{ color: "var(--mk-text-dimmed)" }}
      >
        Includes &ldquo;Powered by Loyalshy&rdquo; on passes
      </p>
    </div>
  )
}

/* ─── Plan card ───────────────────────────────────────────────────── */

type PlanCardProps = {
  planKey: Exclude<PlanId, "ENTERPRISE">
  highlighted?: boolean
  period: BillingPeriod
}

function PlanCard({
  planKey,
  highlighted = false,
  period,
}: PlanCardProps) {
  const plan = PLANS[planKey]
  const price = period === "annual" ? plan.annualPrice : plan.price

  return (
    <div
      className="relative flex flex-col rounded-2xl p-7 transition-all duration-300"
      style={{
        background: "var(--mk-card)",
        border: highlighted
          ? "1px solid oklch(0.55 0.2 265 / 0.3)"
          : "1px solid var(--mk-border)",
        boxShadow: highlighted
          ? "0 0 0 1px oklch(0.55 0.2 265 / 0.1), 0 16px 48px oklch(0 0 0 / 0.08), 0 0 80px oklch(0.55 0.2 265 / 0.04)"
          : "0 1px 3px oklch(0 0 0 / 0.04)",
        transform: highlighted ? "scale(1.02)" : "scale(1)",
      }}
    >
      {highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span
            className="inline-flex items-center rounded-full px-4 py-1 text-[11px] font-bold tracking-wide uppercase"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.55 0.2 265), oklch(0.55 0.17 155))",
              color: "oklch(0.99 0 0)",
              letterSpacing: "0.08em",
              boxShadow: "0 2px 12px oklch(0.55 0.2 265 / 0.3)",
            }}
          >
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-5">
        <p
          className="text-[13px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          {plan.name}
        </p>
        <p
          className="text-[14px]"
          style={{ color: "var(--mk-text-muted)" }}
        >
          {plan.description}
        </p>
      </div>

      <div className="mb-2 flex items-baseline gap-1">
        <span
          className="text-5xl font-bold tracking-tight"
          style={{ color: "var(--mk-text)" }}
        >
          {formatPrice(price)}
        </span>
        <span
          className="text-[15px] font-medium"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          &euro;/mo
        </span>
      </div>

      {period === "annual" && plan.price !== null && (
        <p
          className="text-[13px] font-medium mb-5"
          style={{ color: "oklch(0.45 0.17 155)" }}
        >
          {(plan.price - (plan.annualPrice ?? 0)) * 12}&euro; saved per year
        </p>
      )}
      {period === "monthly" && <div className="mb-5" />}

      {highlighted ? (
        <Link
          href="/register"
          className="mk-btn-primary w-full text-center mb-6 gap-2"
        >
          Get Started
          <ArrowRight className="size-4" />
        </Link>
      ) : (
        <Button
          asChild
          variant="outline"
          size="lg"
          className="w-full mb-6 text-[14px] font-medium"
        >
          <Link href="/register">Get Started</Link>
        </Button>
      )}

      <div
        className="mb-5"
        style={{ borderTop: "1px solid var(--mk-border)" }}
      />

      <ul className="flex flex-col gap-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <div
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
              style={{
                background: highlighted
                  ? "oklch(0.55 0.2 265 / 0.1)"
                  : "oklch(0.55 0.17 155 / 0.1)",
              }}
            >
              <Check
                className="size-3"
                strokeWidth={2.5}
                style={{
                  color: highlighted
                    ? "oklch(0.55 0.2 265)"
                    : "oklch(0.50 0.16 145)",
                }}
              />
            </div>
            <span
              className="text-[14px]"
              style={{ color: "var(--mk-text)" }}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <p
        className="mt-6 text-[13px]"
        style={{ color: "var(--mk-text-dimmed)" }}
      >
        Up to {formatLimit(plan.customerLimit)} contacts &middot;{" "}
        {formatLimit(plan.staffLimit)} staff
        {plan.staffLimit === 1 ? " member" : " members"}
      </p>
    </div>
  )
}

/* ─── Section ─────────────────────────────────────────────────────── */

export function Pricing() {
  const [period, setPeriod] = React.useState<BillingPeriod>("monthly")

  return (
    <section
      id="pricing"
      className="relative py-24 sm:py-32 px-4 sm:px-6 overflow-hidden"
      style={{ background: "var(--mk-surface)" }}
    >
      {/* Subtle bg gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 20%, oklch(0.55 0.2 265 / 0.03), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <FadeIn>
          <div className="text-center mb-10">
            <p
              className="mb-3 inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-bold tracking-[0.08em] uppercase"
              style={{
                border: "1px solid var(--mk-border)",
                background: "var(--mk-card)",
                color: "var(--mk-text-dimmed)",
              }}
            >
              Pricing
            </p>
            <h2
              className="text-3xl sm:text-[2.5rem] font-bold mb-4"
              style={{
                color: "var(--mk-text)",
                letterSpacing: "-0.03em",
              }}
            >
              Start free, scale as you grow
            </h2>
            <p
              className="text-[16px] max-w-md mx-auto"
              style={{ color: "var(--mk-text-muted)" }}
            >
              No credit card required. Upgrade when you need more.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mb-10 flex justify-center">
            <BillingToggle period={period} onChange={setPeriod} />
          </div>
        </FadeIn>

        <Stagger
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 items-start"
          stagger={0.08}
        >
          <StaggerItem>
            <FreePlanCard />
          </StaggerItem>
          <StaggerItem>
            <PlanCard planKey="STARTER" period={period} />
          </StaggerItem>
          <StaggerItem>
            <PlanCard planKey="GROWTH" highlighted period={period} />
          </StaggerItem>
          <StaggerItem>
            <PlanCard planKey="SCALE" period={period} />
          </StaggerItem>
        </Stagger>

        {/* Enterprise */}
        <FadeIn delay={0.4}>
          <div
            className="mk-card-glass mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 px-7 py-6"
          >
            <div>
              <p
                className="text-[15px] font-semibold mb-1"
                style={{ color: "var(--mk-text)" }}
              >
                {ENTERPRISE.name}
              </p>
              <p
                className="text-[14px]"
                style={{ color: "var(--mk-text-muted)" }}
              >
                {ENTERPRISE.description}. Unlimited everything, white-label
                branding, dedicated support & SLA.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="shrink-0 text-[14px] font-medium"
            >
              <Link href="mailto:sales@loyalshy.com">Contact Sales</Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

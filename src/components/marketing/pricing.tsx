"use client"

import * as React from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { useTranslations } from "next-intl"
import { PLANS, type PlanId } from "@/lib/plans"
import { useLocalePath } from "@/i18n/use-locale-path"
import { SectionHeading } from "./section-heading"

// Apple's "compare" layout: centered columns, no box around them, a
// hairline under each header, the recommended plan is the one with the
// coral button. Prices come from the same plan table billing uses.

type BillingPeriod = "monthly" | "annual"
type Column = { key: "free" | "starter" | "growth" | "scale"; planId: Exclude<PlanId, "ENTERPRISE"> | null; recommended?: boolean }

const COLUMNS: Column[] = [
  { key: "free", planId: null },
  { key: "starter", planId: "STARTER" },
  { key: "growth", planId: "GROWTH", recommended: true },
  { key: "scale", planId: "SCALE" },
]

const PERIODS: BillingPeriod[] = ["monthly", "annual"]

function BillingToggle({ period, onChange }: { period: BillingPeriod; onChange: (p: BillingPeriod) => void }) {
  const t = useTranslations("pricing")
  // A radio group: Tab lands on the checked option, arrows move the check.
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return
    e.preventDefault()
    const next = PERIODS[(PERIODS.indexOf(period) + 1) % PERIODS.length]
    onChange(next)
    ;(e.currentTarget.parentElement?.querySelector(`[data-period="${next}"]`) as HTMLButtonElement | null)?.focus()
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div role="radiogroup" aria-label={t("billingPeriod")} className="inline-flex rounded-full p-1" style={{ border: "1px solid var(--mk-border)" }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            tabIndex={period === p ? 0 : -1}
            data-period={p}
            onClick={() => onChange(p)}
            onKeyDown={onKeyDown}
            className="rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors"
            style={{ background: period === p ? "var(--mk-text)" : "transparent", color: period === p ? "var(--mk-bg)" : "var(--mk-text-muted)" }}
          >
            {t(p)}
          </button>
        ))}
      </div>
      <span className="mk-caption font-medium" style={{ color: "var(--mk-text-muted)" }} aria-live="polite">
        {period === "annual" ? t("billedYearly") : t("save20")}
      </span>
    </div>
  )
}

export function Pricing() {
  const [period, setPeriod] = React.useState<BillingPeriod>("monthly")
  const t = useTranslations("pricing")
  const tc = useTranslations("common")
  const lp = useLocalePath()

  return (
    <section id="pricing" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap py-20 lg:py-28">
        <SectionHeading title={t("title")} lead={t("subtitle")} align="center" />
        <div className="mt-8 flex justify-center">
          <BillingToggle period={period} onChange={setPeriod} />
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-x-8">
          {COLUMNS.map((col) => {
            const plan = col.planId ? PLANS[col.planId] : null
            const monthly = plan?.price ?? 0
            const price = period === "annual" ? (plan?.annualPrice ?? 0) : monthly
            const saved = plan && period === "annual" ? (monthly - (plan.annualPrice ?? 0)) * 12 : 0
            const features = Object.values(t.raw(`${col.key}.features`) as Record<string, string>)
            return (
              <div key={col.key} className="flex flex-col items-center text-center">
                <p className="mk-caption min-h-[1lh] font-semibold" style={{ color: "var(--mk-text)" }}>
                  {col.recommended ? t("mostPopular") : ""}
                </p>
                <h3 className="mk-title-4 mt-2" style={{ color: "var(--mk-text)" }}>
                  {t(`${col.key}.name`)}
                </h3>
                <p className="mk-body-sm mt-1 min-h-[2lh] max-w-[26ch]" style={{ color: "var(--mk-text-muted)" }}>
                  {t(`${col.key}.description`)}
                </p>
                <p className="mt-5 flex items-baseline gap-1" aria-live="polite" style={{ color: "var(--mk-text)" }}>
                  <span className="font-display text-5xl font-bold leading-none tracking-tight tabular-nums">{price}</span>
                  <span className="text-[15px] font-medium" style={{ color: "var(--mk-text-dimmed)" }}>{tc("perMonth")}</span>
                </p>
                <p className="mk-caption mt-2 min-h-[1lh]" style={{ color: "var(--mk-text-dimmed)" }}>
                  {saved > 0 ? `${price * 12} € ${t("perYear")} · ${saved} € ${t("savedPerYear")}` : ""}
                </p>
                <Link href="/register" className={col.recommended ? "mk-btn-primary mt-5 w-full" : "mk-btn-ghost mt-5 w-full"} aria-label={`${tc("getStarted")} · ${t(`${col.key}.name`)}`}>
                  {tc("getStarted")}
                </Link>
                <ul className="mt-6 w-full border-t pt-5 text-left" style={{ borderColor: "var(--mk-border)" }}>
                  {features.map((feature) => (
                    <li key={feature} className="mk-body-sm flex items-start gap-2.5 py-1.5" style={{ color: "var(--mk-text)" }}>
                      <Check className="mt-[3px] size-4 shrink-0" strokeWidth={2} style={{ color: "var(--mk-text)" }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Several locations or a chain: a word, not a column */}
        <p className="mk-body mt-14 text-center" style={{ color: "var(--mk-text-muted)" }}>
          {t("multiLocation")}{" "}
          <Link href={`${lp("/contact")}?type=sales`} className="font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
            {t("multiLocationCta")}
          </Link>
        </p>
      </div>
    </section>
  )
}

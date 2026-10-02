"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { WINBACK_MIN_GROUP, type WinbackGroup, type WinbackResults } from "@/lib/winback/results-math"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const PERIODS = [30, 90, 365] as const

/**
 * Win-back results: one hero figure (customers who came back BECAUSE of the
 * message, when measurable), then an emphasis comparison — messaged in the
 * accent (--chart-1), comparison group in context gray (--chart-3) — on a
 * shared 0–100% scale, direct-labeled, with a per-bar tooltip and a
 * screen-reader table.
 */
export function WinbackResultsCard({ results, holdoutOn }: { results: WinbackResults; holdoutOn: boolean }) {
  const t = useTranslations("dashboard.winback")
  const locale = useLocale()
  const pathname = usePathname()
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 })
  const nf = new Intl.NumberFormat(locale)

  const { messaged, comparison, rateMessaged, rateComparison, extraCustomers } = results
  const hasOutcomes = messaged.sent + comparison.sent > 0

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{t("resultsTitle")}</h3>
          <p className="text-[13px] text-muted-foreground">{t("resultsDescription")}</p>
        </div>
        <div className="flex gap-1" role="group" aria-label={t("resultsPeriodLabel")}>
          {PERIODS.map((p) => (
            <Button
              key={p}
              asChild
              size="xs"
              variant={results.periodDays === p ? "ink" : "outline"}
              aria-current={results.periodDays === p ? "true" : undefined}
            >
              <Link href={`${pathname}?period=${p}`} scroll={false}>
                {t("resultsPeriod", { days: p })}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {!hasOutcomes ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          {results.measuring > 0
            ? t("resultsMeasuringOnly", { count: results.measuring })
            : t("resultsEmpty")}
        </p>
      ) : (
        <>
          {/* Hero figure — exactly one, Inter, proportional figures */}
          <div className="space-y-1">
            {extraCustomers !== null && extraCustomers > 0 ? (
              <>
                <p className="text-5xl font-semibold tracking-tight">+{nf.format(extraCustomers)}</p>
                <p className="text-[13px]">{t("heroExtra", { count: extraCustomers })}</p>
              </>
            ) : (
              <>
                <p className="text-5xl font-semibold tracking-tight">
                  {rateMessaged !== null ? pct.format(rateMessaged) : "—"}
                </p>
                <p className="text-[13px]">{t("heroRate")}</p>
              </>
            )}
            <p className="text-[12px] text-muted-foreground">
              {extraCustomers !== null
                ? extraCustomers > 0
                  ? t("heroExtraHint")
                  : t("heroNoDifference")
                : holdoutOn
                  ? t("heroNeedComparison", { min: WINBACK_MIN_GROUP, count: comparison.sent })
                  : t("heroHoldoutOff")}
            </p>
          </div>

          <div className="space-y-4">
            <ComparisonBar
              label={t("barMessaged")}
              group={messaged}
              rate={rateMessaged}
              color="var(--chart-1)"
              valueLabel={rateMessaged !== null ? pct.format(rateMessaged) : "—"}
              countLabel={t("barCount", { back: messaged.back, sent: messaged.sent })}
              tooltip={t("barTooltip", { back: messaged.back, sent: messaged.sent })}
            />
            {comparison.sent > 0 && (
              <ComparisonBar
                label={t("barComparison")}
                group={comparison}
                rate={rateComparison}
                color="var(--chart-3)"
                valueLabel={rateComparison !== null ? pct.format(rateComparison) : "—"}
                countLabel={t("barCount", { back: comparison.back, sent: comparison.sent })}
                tooltip={t("barTooltip", { back: comparison.back, sent: comparison.sent })}
              />
            )}
          </div>

          {/* Table view of the same numbers. The wrapper carries sr-only:
              a <table> ignores the 1px width and would widen the page. */}
          <div className="sr-only">
            <table>
              <caption>{t("resultsTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("tableGroup")}</th>
                  <th scope="col">{t("tableSent")}</th>
                  <th scope="col">{t("tableBack")}</th>
                  <th scope="col">{t("tableRate")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: t("barMessaged"), g: messaged, r: rateMessaged },
                  { label: t("barComparison"), g: comparison, r: rateComparison },
                ].map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.g.sent}</td>
                    <td>{row.g.back}</td>
                    <td>{row.r !== null ? pct.format(row.r) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(results.measuring > 0 || results.unreachable > 0) && hasOutcomes && (
        <p className="text-[12px] text-muted-foreground">
          {[
            results.measuring > 0 ? t("footerMeasuring", { count: results.measuring }) : null,
            results.unreachable > 0 ? t("footerUnreachable", { count: results.unreachable }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </Card>
  )
}

function ComparisonBar({
  label,
  group,
  rate,
  color,
  valueLabel,
  countLabel,
  tooltip,
}: {
  label: string
  group: WinbackGroup
  rate: number | null
  color: string
  valueLabel: string
  countLabel: string
  tooltip: string
}) {
  const width = rate !== null ? Math.max(rate * 100, group.back > 0 ? 1 : 0) : 0
  return (
    // The whole row is the hover/focus target (bigger than the mark).
    <div className="group relative space-y-1.5 outline-none" tabIndex={0} aria-label={`${label}: ${valueLabel}. ${tooltip}`}>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 text-muted-foreground">{label}</span>
        <span className="shrink-0 whitespace-nowrap">
          <span className="font-medium">{valueLabel}</span>{" "}
          <span className="text-[11px] text-muted-foreground">{countLabel}</span>
        </span>
      </div>
      <div className="relative h-2.5 border-l border-border">
        <div
          className="h-full rounded-r-[4px]"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute -top-9 left-0 z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-[12px] shadow-md",
          "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      >
        {tooltip}
      </div>
    </div>
  )
}

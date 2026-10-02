"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ReviewsDashboardData } from "@/lib/reviews/dashboard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ReviewSettingsCard } from "./review-settings-card"

type ReviewsViewProps = {
  data: ReviewsDashboardData
  organizationName: string
  canManageBilling: boolean
}

export function ReviewsView({ data, organizationName, canManageBilling }: ReviewsViewProps) {
  const t = useTranslations("dashboard.reviews")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(locale)

  const { funnel, ratings } = data
  const openRate = funnel.asked30d > 0 ? Math.round((funnel.opened30d / funnel.asked30d) * 100) : null
  const first = ratings[0]
  const latest = ratings[ratings.length - 1]
  const gained = first && latest ? latest.ratingCount - first.ratingCount : 0

  return (
    <div className="space-y-6">
      {!data.planAllowed && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
            <p className="text-[13px]">{t("planRequired")}</p>
          </div>
          {canManageBilling ? (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/dashboard/settings?tab=billing">{t("upgradeCta")}</Link>
            </Button>
          ) : (
            <span className="text-[12px] text-muted-foreground">{t("askOwner")}</span>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("statAsked")} value={nf.format(funnel.asked30d)} hint={t("last30Days")} />
        <Stat
          label={t("statOpened")}
          value={nf.format(funnel.opened30d)}
          hint={openRate !== null ? t("openRate", { rate: openRate }) : t("last30Days")}
        />
        <Stat
          label={t("statReviews")}
          value={latest ? nf.format(latest.ratingCount) : "—"}
          hint={
            latest && ratings.length > 1
              ? t("gainedSince", { count: gained, date: formatDay(first.date, locale) })
              : t("notTracked")
          }
        />
        <Stat
          label={t("statRating")}
          value={latest?.rating != null ? latest.rating.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}
          hint={latest?.rating != null ? t("ratingHint") : t("notTracked")}
        />
      </div>

      <RatingChart ratings={ratings} />

      <ReviewSettingsCard
        initial={data.settings}
        planAllowed={data.planAllowed}
        placesConfigured={data.placesConfigured}
        organizationName={organizationName}
      />

      <p className="text-[12px] text-muted-foreground">{t("policyNote")}</p>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="space-y-2 p-4">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </Card>
  )
}

const subscribeNoop = () => () => {}

function formatDay(isoDate: string, locale: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function RatingChart({ ratings }: { ratings: ReviewsDashboardData["ratings"] }) {
  const t = useTranslations("dashboard.reviews")
  const locale = useLocale()
  // Recharts measures the DOM — render only on the client (false during SSR + hydration).
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-[13px] font-medium text-muted-foreground">{t("chartTitle")}</h3>
      {ratings.length < 2 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          {ratings.length === 0 ? t("chartEmpty") : t("chartStarted")}
        </p>
      ) : (
        <div className="h-50 sm:h-60">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ratings} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reviewsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => formatDay(d, locale)}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  domain={["dataMin", "dataMax"]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as ReviewsDashboardData["ratings"][number] | undefined
                    if (!active || !point) return null
                    return (
                      <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md">
                        <p className="text-xs text-muted-foreground">{formatDay(point.date, locale)}</p>
                        <p className="text-sm font-medium tabular-nums">
                          {t("chartTooltip", { count: point.ratingCount })}
                          {point.rating != null ? ` · ${point.rating.toFixed(1)}★` : ""}
                        </p>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ratingCount"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#reviewsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </Card>
  )
}

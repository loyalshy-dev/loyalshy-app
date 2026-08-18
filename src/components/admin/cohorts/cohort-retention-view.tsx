"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import type { CohortRow, CohortSegments } from "@/server/cohort-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Segment = "all" | "partner" | "organic"

/**
 * Weighted retention at month N across every cohort old enough to have
 * that month: sum of retained orgs / sum of cohort sizes.
 */
function weightedRetention(rows: CohortRow[], monthIndex: number): number | null {
  let retained = 0
  let total = 0
  for (const row of rows) {
    const pct = row.retention[monthIndex]
    if (pct === null || pct === undefined) continue
    retained += (pct / 100) * row.orgCount
    total += row.orgCount
  }
  if (total === 0) return null
  return Math.round((retained / total) * 100)
}

function heatStyle(pct: number | null): React.CSSProperties {
  if (pct === null) return {}
  // Teal heat scaled by retention; text stays readable via low max alpha
  return { backgroundColor: `oklch(0.7 0.12 180 / ${(pct / 100) * 0.55})` }
}

function formatCohortLabel(cohortMonth: string): string {
  const [y, m] = cohortMonth.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

type CohortRetentionViewProps = {
  segments: CohortSegments
}

export function CohortRetentionView({ segments }: CohortRetentionViewProps) {
  const t = useTranslations("admin.cohorts")
  const [segment, setSegment] = useState<Segment>("all")

  const rows = segments[segment]
  const partnerM1 = weightedRetention(segments.partner, 1)
  const organicM1 = weightedRetention(segments.organic, 1)
  const partnerM3 = weightedRetention(segments.partner, 3)
  const organicM3 = weightedRetention(segments.organic, 3)

  const partnerOrgTotal = segments.partner.reduce((a, r) => a + r.orgCount, 0)
  const organicOrgTotal = segments.organic.reduce((a, r) => a + r.orgCount, 0)

  const segmentOptions: { key: Segment; label: string }[] = [
    { key: "all", label: t("segmentAll") },
    { key: "partner", label: t("segmentPartner") },
    { key: "organic", label: t("segmentOrganic") },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Channel comparison */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ComparisonCard
          label={t("partnerM1", { count: partnerOrgTotal })}
          value={partnerM1}
        />
        <ComparisonCard
          label={t("organicM1", { count: organicOrgTotal })}
          value={organicM1}
        />
        <ComparisonCard label={t("partnerM3")} value={partnerM3} />
        <ComparisonCard label={t("organicM3")} value={organicM3} />
      </div>

      {/* Segment toggle */}
      <div className="flex gap-1.5">
        {segmentOptions.map((opt) => (
          <Button
            key={opt.key}
            size="sm"
            variant={segment === opt.key ? "default" : "outline"}
            onClick={() => setSegment(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Cohort grid */}
      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colCohort")}</TableHead>
                <TableHead className="text-right">{t("colOrgs")}</TableHead>
                <TableHead className="text-right">{t("colPaid")}</TableHead>
                <TableHead className="text-right">{t("colSubscribed")}</TableHead>
                {Array.from({ length: segments.maxMonths }, (_, n) => (
                  <TableHead key={n} className="text-center min-w-12">
                    M{n}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4 + segments.maxMonths}
                    className="text-center text-muted-foreground py-6"
                  >
                    {t("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.cohortMonth}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatCohortLabel(row.cohortMonth)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.orgCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.paidCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.subscribedCount}
                    </TableCell>
                    {row.retention.map((pct, n) => (
                      <TableCell
                        key={n}
                        className="text-center tabular-nums text-xs"
                        style={heatStyle(pct)}
                      >
                        {pct === null ? "" : `${pct}%`}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("methodology")}</p>
    </div>
  )
}

function ComparisonCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{value === null ? "—" : `${value}%`}</p>
      </CardContent>
    </Card>
  )
}

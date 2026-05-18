import { Suspense } from "react"
import Link from "next/link"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import { assertAdminRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"

type Range = "7d" | "30d" | "90d" | "all"

const RANGE_DAYS: Record<Exclude<Range, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
}

function parseRange(value: string | string[] | undefined): Range {
  if (value === "7d" || value === "30d" || value === "90d" || value === "all") {
    return value
  }
  return "30d"
}

type FunnelRow = {
  stage_signed_up: bigint
  stage_org_created: bigint
  stage_program_created: bigint
  stage_program_active: bigint
  stage_pass_issued: bigint
}

/**
 * Cohort-anchored 5-stage funnel. Each row counts UNIQUE users from the
 * signup cohort who have reached the corresponding stage. Drop-off is
 * computed at render time so we get fractional cohort retention rather
 * than Plausible's same-day-only event approximation.
 */
async function fetchFunnel(range: Range): Promise<FunnelRow> {
  // Build the cohort lower bound. "all" → epoch sentinel so the rest of
  // the query stays one shape.
  const since: Date =
    range === "all"
      ? new Date("1970-01-01T00:00:00Z")
      : new Date(Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000)

  const rows = await db.$queryRaw<FunnelRow[]>`
    WITH cohort AS (
      SELECT id FROM "user" WHERE "createdAt" >= ${since}
    ),
    owned_orgs AS (
      SELECT DISTINCT c.id AS user_id, m."organizationId" AS org_id
      FROM cohort c
      JOIN member m ON m."userId" = c.id AND m.role = 'owner'
    )
    SELECT
      (SELECT COUNT(*) FROM cohort)::bigint AS stage_signed_up,
      (SELECT COUNT(DISTINCT user_id) FROM owned_orgs)::bigint AS stage_org_created,
      (SELECT COUNT(DISTINCT user_id) FROM owned_orgs o
        WHERE EXISTS (
          SELECT 1 FROM pass_template pt WHERE pt."organizationId" = o.org_id
        ))::bigint AS stage_program_created,
      (SELECT COUNT(DISTINCT user_id) FROM owned_orgs o
        WHERE EXISTS (
          SELECT 1 FROM pass_template pt
          WHERE pt."organizationId" = o.org_id AND pt.status = 'active'::template_status
        ))::bigint AS stage_program_active,
      (SELECT COUNT(DISTINCT user_id) FROM owned_orgs o
        WHERE EXISTS (
          SELECT 1 FROM pass_instance pi
          JOIN pass_template pt ON pt.id = pi."passTemplateId"
          WHERE pt."organizationId" = o.org_id
        ))::bigint AS stage_pass_issued
  `

  return (
    rows[0] ?? {
      stage_signed_up: BigInt(0),
      stage_org_created: BigInt(0),
      stage_program_created: BigInt(0),
      stage_program_active: BigInt(0),
      stage_pass_issued: BigInt(0),
    }
  )
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—"
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

async function FunnelContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  await assertAdminRole("ADMIN_SUPPORT")
  const t = await getTranslations("admin.funnel")

  const params = await searchParams
  const range = parseRange(params.range)
  const row = await fetchFunnel(range)

  const stages: { key: string; label: string; count: number }[] = [
    { key: "signedUp", label: t("stageSignedUp"), count: Number(row.stage_signed_up) },
    { key: "orgCreated", label: t("stageOrgCreated"), count: Number(row.stage_org_created) },
    { key: "programCreated", label: t("stageProgramCreated"), count: Number(row.stage_program_created) },
    { key: "programActive", label: t("stageProgramActive"), count: Number(row.stage_program_active) },
    { key: "passIssued", label: t("stagePassIssued"), count: Number(row.stage_pass_issued) },
  ]
  const stage1 = stages[0].count
  const maxCount = Math.max(...stages.map((s) => s.count), 1)

  const rangeOptions: { key: Range; label: string }[] = [
    { key: "7d", label: t("range7d") },
    { key: "30d", label: t("range30d") },
    { key: "90d", label: t("range90d") },
    { key: "all", label: t("rangeAll") },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("subtitle")}
          </p>
        </div>

        {/* Range toggle */}
        <div
          role="tablist"
          aria-label={t("rangeAriaLabel")}
          className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
        >
          {rangeOptions.map((opt) => {
            const active = opt.key === range
            return (
              <Link
                key={opt.key}
                href={opt.key === "30d" ? "/admin/funnel" : `/admin/funnel?range=${opt.key}`}
                role="tab"
                aria-selected={active}
                className={cn(
                  "px-3 py-1 rounded-full text-[12px] font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Funnel stages */}
      <div className="space-y-3">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].count : null
          const barWidth = `${(s.count / maxCount) * 100}%`
          return (
            <div
              key={s.key}
              className="rounded-lg border border-border bg-card p-4 space-y-2"
            >
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    aria-hidden
                    className="flex size-6 items-center justify-center rounded-md bg-muted text-[11px] font-medium text-muted-foreground"
                  >
                    {i + 1}
                  </div>
                  <h2 className="text-sm font-medium truncate">{s.label}</h2>
                </div>
                <div className="flex items-baseline gap-4 text-right shrink-0">
                  <span className="text-2xl font-semibold tabular-nums">
                    {s.count.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-16">
                    {i === 0 ? t("ofCohort") : pct(s.count, stage1)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-24">
                    {prev === null ? "" : t("ofPrev", { value: pct(s.count, prev) })}
                  </span>
                </div>
              </div>
              {/* Bar */}
              <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full"
                  style={{ width: barWidth }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">{t("cohortNote")}</p>
    </div>
  )
}

export default function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense>
      <FunnelContent searchParams={searchParams} />
    </Suspense>
  )
}

import { Check, Minus } from "lucide-react"
import { getTranslations } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { PLANS, type PlanId } from "@/lib/plans"

// The plans side by side, row by row, on hairlines. Limits come from the
// same plan table billing uses; names from the `pricing` namespace. Ink
// checks (coral is for the button only). No prices here: the grid above
// shows them, and its toggle may be on Annual. The six rows that are `true`
// everywhere are the features no plan gates.

type Column = { key: "free" | "starter" | "growth" | "scale"; planId: PlanId }
const COLUMNS: Column[] = [
  { key: "free", planId: "FREE" },
  { key: "starter", planId: "STARTER" },
  { key: "growth", planId: "GROWTH" },
  { key: "scale", planId: "SCALE" },
]

type Cell = { kind: "text"; value: string } | { kind: "bool"; value: boolean }

export async function PlanCompare({ locale }: { locale: Locale }) {
  const t = await getTranslations("pages.pricing")
  const tp = await getTranslations("pricing")
  const n = new Intl.NumberFormat(locale)
  const count = (v: number) => (Number.isFinite(v) ? n.format(v) : t("values.unlimited"))

  const rows: { key: string; cells: Cell[] }[] = [
    { key: "customers", cells: COLUMNS.map((c) => ({ kind: "text", value: count(PLANS[c.planId].customerLimit) })) },
    { key: "programs", cells: COLUMNS.map((c) => ({ kind: "text", value: count(PLANS[c.planId].programLimit) })) },
    { key: "team", cells: COLUMNS.map((c) => ({ kind: "text", value: count(PLANS[c.planId].staffLimit) })) },
    {
      key: "announcements",
      cells: COLUMNS.map((c) => {
        const plan = PLANS[c.planId]
        return { kind: "text", value: plan.announcementPeriod === "lifetime" ? t("values.lifetime", { count: plan.announcementLimit }) : t("values.perWeek", { count: plan.announcementLimit }) }
      }),
    },
    { key: "reviews", cells: COLUMNS.map((c) => ({ kind: "bool", value: PLANS[c.planId].reviewPrompts })) },
    { key: "winback", cells: COLUMNS.map((c) => ({ kind: "bool", value: PLANS[c.planId].winback })) },
    { key: "nearby", cells: COLUMNS.map(() => ({ kind: "bool", value: true })) },
    { key: "private", cells: COLUMNS.map(() => ({ kind: "bool", value: true })) },
    { key: "wallets", cells: COLUMNS.map(() => ({ kind: "bool", value: true })) },
    { key: "staffApp", cells: COLUMNS.map(() => ({ kind: "bool", value: true })) },
    { key: "studio", cells: COLUMNS.map(() => ({ kind: "bool", value: true })) },
    { key: "export", cells: COLUMNS.map(() => ({ kind: "bool", value: true })) },
  ]

  return (
    // `relative` so the sr-only (absolutely positioned) cell labels are clipped
    // by this scroll container instead of widening the page on phones.
    <div className="relative -mx-6 overflow-x-auto px-6 lg:mx-0 lg:px-0">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--mk-border)" }}>
            <th scope="col" className="w-[32%] py-4 pr-4 align-bottom">
              <span className="sr-only">{t("compareTitle")}</span>
            </th>
            {COLUMNS.map((c) => {
              return (
                <th key={c.key} scope="col" className="py-4 pr-4 align-bottom">
                  <span className="mk-title-4 block" style={{ color: "var(--mk-text)" }}>{tp(`${c.key}.name`)}</span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b" style={{ borderColor: "var(--mk-border)" }}>
              <th scope="row" className="mk-body-sm py-3.5 pr-4 font-medium" style={{ color: "var(--mk-text)" }}>
                {t(`rows.${row.key}`)}
              </th>
              {row.cells.map((cell, i) => (
                <td key={COLUMNS[i].key} className="mk-body-sm py-3.5 pr-4 tabular-nums" style={{ color: "var(--mk-text)" }}>
                  {cell.kind === "text" ? (
                    cell.value
                  ) : cell.value ? (
                    <>
                      <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                      <span className="sr-only">{t("values.included")}</span>
                    </>
                  ) : (
                    <>
                      <Minus className="size-4" strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--mk-text-dimmed)" }} />
                      <span className="sr-only">{t("values.notIncluded")}</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

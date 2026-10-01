"use client"

import { motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { Activity, Gift, Trophy, Users } from "lucide-react"

// The owner's panel, built from the same blocks as the real overview
// (stat cards, the activity chart, busiest days, recent activity, top
// customers, programs) with Café Sol's numbers. It is DOM, in the page's
// language, so it reads like the product and not like a brochure. The
// chart draws itself and the bars rise once the panel scrolls into view.

const CHART = [6, 7, 7, 9, 10, 10, 12, 13, 12, 14, 16, 17, 17, 19, 21, 20, 23, 25, 26, 25, 28, 30, 31, 33, 32, 35, 37, 38, 40, 43]
const DAYS = [31, 44, 39, 52, 68, 91, 57]
const TOP = [
  { name: "Marta G.", initials: "MG", stamps: 23, hue: 32 },
  { name: "Leo R.", initials: "LR", stamps: 19, hue: 200 },
  { name: "Nora P.", initials: "NP", stamps: 17, hue: 140 },
  { name: "Iván S.", initials: "IS", stamps: 14, hue: 280 },
]

function areaPath(values: number[], w: number, h: number, pad = 4) {
  const max = Math.max(...values)
  const step = (w - pad * 2) / (values.length - 1)
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const)
  const line = pts.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`)).join(" ")
  return { line, area: `${line} L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z` }
}

const card = "rounded-xl border p-4"
const cardStyle = { borderColor: "var(--mk-border)", background: "var(--mk-card)" }
const label = "text-[12px] font-medium"
const muted = { color: "var(--mk-text-muted)" }
const ink = { color: "var(--mk-text)" }

function Stat({ title, value, change, icon, children }: { title: string; value: string; change?: string; icon: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={`${card} flex flex-col gap-2.5`} style={cardStyle}>
      <div className="flex items-center justify-between">
        <span className={label} style={muted}>{title}</span>
        <span style={{ color: "var(--mk-text-dimmed)" }}>{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[22px] font-semibold leading-none tracking-tight tabular-nums" style={ink}>{value}</span>
        {change && <span className="pb-px text-[11px] font-medium" style={{ color: "oklch(0.55 0.15 150)" }}>{change}</span>}
      </div>
      {children}
    </div>
  )
}

export function PanelMock() {
  const t = useTranslations("featureShowcase.mock")
  const tHero = useTranslations("hero")
  const reduced = useReducedMotion()
  const W = 560
  const H = 150
  const { line, area } = areaPath(CHART, W, H)
  const dayMax = Math.max(...DAYS)
  const days = (t.raw("days") as string[]) ?? []
  const inView = { once: true, amount: 0.4 }

  return (
    <div className="overflow-hidden rounded-2xl text-[13px]" style={{ border: "1px solid var(--mk-border)", background: "var(--mk-surface)", boxShadow: "0 30px 60px -30px oklch(0 0 0 / 0.25), 0 1px 0 oklch(1 0 0 / 0.6) inset", color: "var(--mk-text)" }} aria-hidden="true">
      {/* top bar, as the dashboard's */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--mk-border)", background: "var(--mk-card)" }}>
        <div className="flex items-center gap-3">
          <span className="grid size-6 place-items-center rounded-md text-[11px] font-semibold text-white" style={{ background: "var(--mk-accent)" }}>C</span>
          <span className="font-semibold" style={ink}>{tHero("card.business")}</span>
          <span className="hidden sm:inline" style={{ color: "var(--mk-text-dimmed)" }}>/</span>
          <span className="hidden sm:inline" style={muted}>{t("overview")}</span>
        </div>
        <span className="rounded-full px-3 py-1 text-[12px] font-medium text-white" style={{ background: "var(--mk-accent)" }}>{t("newAction")}</span>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {/* stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat title={t("contacts")} value="312" change="+12%" icon={<Users className="size-4" />} />
          <Stat title={t("activePasses")} value="298" icon={<Activity className="size-4" />}>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--mk-surface)", ...muted }}>241 {t("stamps")}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--mk-surface)", ...muted }}>57 {t("coupons")}</span>
            </div>
          </Stat>
          <Stat title={t("activityMonth")} value="1.284" change="+18%" icon={<Gift className="size-4" />} />
          <Stat title={t("redeemedMonth")} value="96" change="+9%" icon={<Trophy className="size-4" />} />
        </div>

        {/* the activity chart + busiest days */}
        <div className="grid gap-3 lg:grid-cols-3">
          <div className={`${card} lg:col-span-2`} style={cardStyle}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium" style={ink}>{t("activity")}</span>
              <span className="flex gap-0.5 rounded-md p-0.5" style={{ background: "var(--mk-surface)" }}>
                {["7d", "30d", "90d", "12m"].map((r) => (
                  <span key={r} className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={r === "30d" ? { background: "var(--mk-card)", ...ink, boxShadow: "0 1px 2px oklch(0 0 0 / 0.08)" } : muted}>{r}</span>
                ))}
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="mk-panel-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--mk-accent)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--mk-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--mk-border)" strokeDasharray="3 3" />
              ))}
              <motion.path d={area} fill="url(#mk-panel-fill)" initial={reduced ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={inView} transition={{ duration: 0.8, delay: 0.9 }} />
              <motion.path d={line} fill="none" stroke="var(--mk-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={inView} transition={{ duration: 1.4, ease: "easeInOut" }} />
            </svg>
            <div className="mt-1.5 flex justify-between text-[10px]" style={muted}>
              {(t.raw("chartTicks") as string[]).map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </div>
          <div className={card} style={cardStyle}>
            <span className="font-medium" style={ink}>{t("busiestDays")}</span>
            <div className="mt-4 flex h-[150px] items-end gap-2">
              {DAYS.map((v, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <motion.div
                      className="w-full rounded-t-[4px]"
                      style={{ height: `${(v / dayMax) * 100}%`, background: v === dayMax ? "var(--mk-accent)" : "var(--mk-border)", transformOrigin: "bottom" }}
                      initial={reduced ? false : { scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={inView}
                      transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  </div>
                  <span className="text-[10px]" style={muted}>{days[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* recent activity, top customers, programs */}
        <div className="hidden gap-3 md:grid md:grid-cols-3">
          <div className={card} style={cardStyle}>
            <span className="font-medium" style={ink}>{t("recent")}</span>
            <ul className="mt-2">
              {[
                { text: t("recentStamp"), who: "Marta G.", when: t("ago2") },
                { text: t("recentRedeem"), who: "Leo R.", when: t("ago14") },
                { text: t("recentJoin"), who: "Nora P.", when: t("ago1h") },
              ].map((it) => (
                <li key={it.who} className="flex items-start justify-between gap-3 py-2" style={{ borderBottom: "1px solid var(--mk-border)" }}>
                  <div>
                    <p className="font-medium" style={ink}>{it.who}</p>
                    <p className="text-[12px]" style={muted}>{it.text}</p>
                  </div>
                  <span className="shrink-0 text-[11px]" style={{ color: "var(--mk-text-dimmed)" }}>{it.when}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={card} style={cardStyle}>
            <span className="font-medium" style={ink}>{t("topCustomers")}</span>
            <ul className="mt-2">
              {TOP.map((c) => (
                <li key={c.name} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--mk-border)" }}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: `oklch(0.62 0.12 ${c.hue})` }}>{c.initials}</span>
                  <span className="flex-1 font-medium" style={ink}>{c.name}</span>
                  <span className="text-[12px] tabular-nums" style={muted}>{c.stamps} {t("stamps")}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={card} style={cardStyle}>
            <span className="font-medium" style={ink}>{t("programs")}</span>
            <ul className="mt-2">
              {[
                { name: tHero("card.program"), count: 241, kind: t("stamps") },
                { name: t("couponProgram"), count: 57, kind: t("coupons") },
              ].map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: "1px solid var(--mk-border)" }}>
                  <div>
                    <p className="font-medium" style={ink}>{p.name}</p>
                    <p className="text-[12px]" style={muted}>{p.count} {t("enrolled")}</p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "oklch(0.93 0.05 150)", color: "oklch(0.4 0.12 150)" }}>{t("active")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

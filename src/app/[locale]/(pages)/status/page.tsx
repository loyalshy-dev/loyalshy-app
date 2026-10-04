import type { Metadata } from "next"
import { Suspense } from "react"
import { connection } from "next/server"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { siteUrl } from "@/i18n/marketing"
import { runHealthChecks, type CheckStatus } from "@/lib/health"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { MarketingPage } from "@/components/marketing/pages/shell"
import { PageSection } from "@/components/marketing/pages/section"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/status", "status")
}

// Each provider publishes its own status page.
const PROVIDERS = [
  { key: "vercel", name: "Vercel", href: "https://www.vercel-status.com" },
  { key: "neon", name: "Neon", href: "https://neonstatus.com" },
  { key: "upstash", name: "Upstash", href: "https://status.upstash.com" },
  { key: "stripe", name: "Stripe", href: "https://status.stripe.com" },
  { key: "trigger", name: "Trigger.dev", href: "https://status.trigger.dev" },
  { key: "resend", name: "Resend", href: "https://resend-status.com" },
  { key: "apple", name: "Apple Wallet", href: "https://developer.apple.com/system-status/" },
  { key: "google", name: "Google Wallet", href: "https://status.cloud.google.com" },
] as const

function Dot({ status }: { status: CheckStatus }) {
  const color = status === "ok" ? "oklch(0.65 0.17 150)" : status === "down" ? "oklch(0.6 0.2 25)" : "var(--mk-text-dimmed)"
  return <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />
}

function Row({ status, name, desc, detail }: { status: CheckStatus; name: string; desc: string; detail?: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-x-4 border-b py-5" style={{ borderColor: "var(--mk-border)" }}>
      <span className="mt-[7px]"><Dot status={status} /></span>
      <div>
        <h3 className="mk-title-4" style={{ color: "var(--mk-text)" }}>{name}</h3>
        <p className="mk-body-sm mt-1 max-w-[60ch]" style={{ color: "var(--mk-text-muted)" }}>{desc}</p>
      </div>
      <p className="mk-body-sm text-right tabular-nums" style={{ color: "var(--mk-text-muted)" }}>{detail}</p>
    </li>
  )
}

// The live part: runs the same checks as /api/health at request time. It
// sits in its own Suspense boundary so the rest of the page prerenders.
async function LiveStatus() {
  await connection()
  const t = await getTranslations("pages.status")
  const report = await runHealthChecks()
  const time = report.timestamp.slice(11, 19)
  const label = (s: CheckStatus) => t(`states.${s}`)
  const detail = (s: CheckStatus, ms?: number) => (s === "ok" && ms !== undefined ? `${label(s)} · ${t("latency", { ms })}` : label(s))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-5" style={{ borderColor: "var(--mk-border)" }}>
        <p className="flex items-center gap-3 mk-title-4" style={{ color: "var(--mk-text)" }} role="status">
          <Dot status={report.status === "ok" ? "ok" : "down"} />
          {t(`overall.${report.status}`)}
        </p>
        <p className="mk-body-sm" style={{ color: "var(--mk-text-dimmed)" }}>{t("checkedAt", { time })}</p>
      </div>
      <ul role="list">
        <Row status="ok" name={t("components.web.name")} desc={t("components.web.desc")} detail={label("ok")} />
        <Row status={report.checks.database.status} name={t("components.database.name")} desc={t("components.database.desc")} detail={detail(report.checks.database.status, report.checks.database.latencyMs)} />
        <Row status={report.checks.redis.status} name={t("components.redis.name")} desc={t("components.redis.desc")} detail={detail(report.checks.redis.status, report.checks.redis.latencyMs)} />
      </ul>
    </div>
  )
}

function LiveStatusSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-7 w-64 rounded-md" style={{ background: "var(--mk-surface)" }} />
      <ul className="mt-5">
        {[0, 1, 2].map((i) => (
          <li key={i} className="border-b py-5" style={{ borderColor: "var(--mk-border)" }}>
            <div className="h-5 w-48 rounded-md" style={{ background: "var(--mk-surface)" }} />
            <div className="mt-2 h-4 w-80 max-w-full rounded-md" style={{ background: "var(--mk-surface)" }} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function StatusPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("pages.status")
  const healthUrl = `${siteUrl}/api/health`

  return (
    <MarketingPage>
      <section style={{ background: "var(--mk-bg)" }}>
        <div className="mk-wrap pt-12 lg:pt-20">
          <h1 className="font-display mk-display-1 max-w-[14ch]" style={{ color: "var(--mk-text)" }}>{t("title")}</h1>
          <p className="mk-lead mt-5 max-w-[52ch]">{t("lead")}</p>
        </div>
      </section>

      <PageSection tight>
        <Suspense fallback={<LiveStatusSkeleton />}>
          <LiveStatus />
        </Suspense>
        <p className="mk-body-sm mt-6" style={{ color: "var(--mk-text-muted)" }}>
          {t("apiNote")}{" "}
          <a href={healthUrl} className="font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
            {healthUrl.replace(/^https?:\/\//, "")}
          </a>
        </p>
      </PageSection>

      <PageSection title={t("providersTitle")} lead={t("providersLead")}>
        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2" role="list">
          {PROVIDERS.map((p) => (
            <li key={p.key} className="flex items-baseline justify-between gap-4 border-t py-4" style={{ borderColor: "var(--mk-border)" }}>
              <div>
                <span className="mk-body font-medium" style={{ color: "var(--mk-text)" }}>{p.name}</span>
                <span className="mk-body-sm block" style={{ color: "var(--mk-text-muted)" }}>{t(`providers.${p.key}`)}</span>
              </div>
              <a href={p.href} target="_blank" rel="noopener noreferrer" className="mk-body-sm shrink-0 font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
                {new URL(p.href).hostname}
              </a>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection tight>
        <div className="grid grid-cols-1 gap-4 border-t pt-8 lg:grid-cols-12 lg:gap-8" style={{ borderColor: "var(--mk-border)" }}>
          <h2 className="mk-title-4 lg:col-span-4" style={{ color: "var(--mk-text)" }}>{t("incidentsTitle")}</h2>
          <p className="mk-body max-w-[60ch] lg:col-span-7 lg:col-start-6" style={{ color: "var(--mk-text-muted)" }}>
            {t("incidentsBody")}{" "}
            <a href="mailto:hello@loyalshy.com" className="font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>hello@loyalshy.com</a>.
          </p>
        </div>
      </PageSection>
    </MarketingPage>
  )
}

import { getTranslations } from "next-intl/server"

/* ─── Stat counter ───────────────────────────────────────────────── */

function StatCounter({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="mk-gradient-text text-2xl font-bold tracking-tight sm:text-3xl"
      >
        {value}
      </span>
      <span
        className="text-[13px] font-medium"
        style={{ color: "var(--mk-text-dimmed)" }}
      >
        {label}
      </span>
    </div>
  )
}

/* ─── Trust badge ────────────────────────────────────────────────── */

function TrustBadge({ label }: { label: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-medium"
      style={{
        background: "var(--mk-surface)",
        border: "1px solid var(--mk-border)",
        color: "var(--mk-text-muted)",
      }}
    >
      <div
        className="size-1.5 rounded-full"
        style={{ background: "var(--mk-brand-green)" }}
      />
      {label}
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────────── */

export async function SocialProof() {
  const t = await getTranslations("socialProof")

  return (
    <section
      className="relative py-12 sm:py-16"
      style={{
        background: "var(--mk-bg)",
        borderTop: "1px solid var(--mk-border)",
        borderBottom: "1px solid var(--mk-border)",
      }}
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        {/* Stat counters */}
        <div className="hero-fade-in flex flex-wrap items-center justify-center gap-10 sm:gap-16" style={{ animationDelay: "400ms" }}>
          <StatCounter value={t("stat1Value")} label={t("stat1Label")} />
          <div
            className="hidden sm:block h-8 w-px"
            style={{ background: "var(--mk-border)" }}
          />
          <StatCounter value={t("stat2Value")} label={t("stat2Label")} />
          <div
            className="hidden sm:block h-8 w-px"
            style={{ background: "var(--mk-border)" }}
          />
          <StatCounter value={t("stat3Value")} label={t("stat3Label")} />
        </div>

        {/* Trust badges */}
        <div
          className="hero-fade-in mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "500ms" }}
        >
          <TrustBadge label={t("appleWallet")} />
          <TrustBadge label={t("googleWallet")} />
          <TrustBadge label={t("gdprCompliant")} />
          <TrustBadge label={t("secureByDesign")} />
        </div>
      </div>
    </section>
  )
}

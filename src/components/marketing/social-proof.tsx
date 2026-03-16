import { getTranslations } from "next-intl/server"

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
      className="relative py-10 sm:py-12"
      style={{
        background: "var(--mk-bg)",
        borderTop: "1px solid var(--mk-border)",
        borderBottom: "1px solid var(--mk-border)",
      }}
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        {/* Headline */}
        <div className="hero-fade-in" style={{ animationDelay: "400ms" }}>
          <p
            className="text-center text-[13px] font-medium uppercase tracking-widest mb-6"
            style={{ color: "var(--mk-text-dimmed)" }}
          >
            {t("headline")}
          </p>
        </div>

        {/* Trust badges */}
        <div
          className="hero-fade-in flex flex-wrap items-center justify-center gap-3"
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

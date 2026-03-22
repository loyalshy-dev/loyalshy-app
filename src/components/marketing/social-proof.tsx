import { getTranslations } from "next-intl/server"

/* ─── Trust badge ────────────────────────────────────────────────── */

function TrustBadge({ label }: { label: string }) {
  return (
    <div
      className="inline-flex items-center gap-3 rounded-full px-6 py-3 mk-card-glass border-none!"
    >
      <span
        className="size-2 rounded-full"
        style={{ background: "var(--mk-brand-green)" }}
      />
      <span
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: "var(--mk-text-muted)" }}
      >
        {label}
      </span>
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────────── */

export async function SocialProof() {
  const t = await getTranslations("socialProof")

  return (
    <section
      className="relative py-12"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Trust badges */}
        <div
          className="hero-fade-in flex flex-wrap items-center justify-center gap-6"
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

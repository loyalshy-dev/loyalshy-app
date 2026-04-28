import { getTranslations } from "next-intl/server"

/* ─── Trust badge ────────────────────────────────────────────────── */

function TrustBadge({ label }: { label: string }) {
  return (
    <div
      className="inline-flex shrink-0 items-center gap-3 rounded-full px-6 py-3 mk-card-glass border-none!"
    >
      <span
        className="size-2 rounded-full"
        style={{ background: "var(--mk-brand-green)" }}
      />
      <span
        className="text-xs font-bold uppercase tracking-widest whitespace-nowrap"
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

  const badges = [
    t("appleWallet"),
    t("googleWallet"),
    t("gdprCompliant"),
    t("secureByDesign"),
  ]

  // Duplicate the list so the -50% translation creates a seamless loop.
  // The second copy is decorative — hidden from assistive tech.
  const items = [
    ...badges.map((label, i) => ({ key: `a-${i}`, label, ariaHidden: false })),
    ...badges.map((label, i) => ({ key: `b-${i}`, label, ariaHidden: true })),
  ]

  return (
    <section
      className="relative py-12"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="hero-fade-in mk-marquee-mask overflow-hidden" style={{ animationDelay: "500ms" }}>
        <div className="mk-marquee-track" role="list" aria-label="Trust badges">
          {items.map((item) => (
            <div
              key={item.key}
              role={item.ariaHidden ? undefined : "listitem"}
              aria-hidden={item.ariaHidden || undefined}
              className="shrink-0 pr-6"
            >
              <TrustBadge label={item.label} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

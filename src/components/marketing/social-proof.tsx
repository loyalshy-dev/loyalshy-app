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

  // Render the list N times (N must be EVEN — `-50%` keyframe needs the first
  // half to be byte-identical to the second half). N=6 keeps the first half
  // (~3 copies × 4 badges = 12 items) wider than typical desktop viewports,
  // which prevents the visible blank gap on wide screens.
  // Only the first copy is exposed to assistive tech.
  const COPIES = 6
  const items = Array.from({ length: COPIES }, (_, copy) =>
    badges.map((label, i) => ({
      key: `${copy}-${i}`,
      label,
      ariaHidden: copy !== 0,
    })),
  ).flat()

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

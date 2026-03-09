import { Building2 } from "lucide-react"

const BUSINESSES = [
  { name: "Trattoria Bella", hue: 265 },
  { name: "Sushi Express", hue: 15 },
  { name: "Cafe Lumiere", hue: 145 },
  { name: "The Ember Grill", hue: 35 },
  { name: "Blue Horizon Bistro", hue: 220 },
  { name: "Fern & Root", hue: 160 },
] as const

const DOUBLE_BUSINESSES = [...BUSINESSES, ...BUSINESSES]

export function SocialProof() {
  return (
    <section
      className="py-10 sm:py-12 overflow-hidden"
      style={{
        background: "var(--mk-surface)",
        borderTop: "1px solid var(--mk-border)",
        borderBottom: "1px solid var(--mk-border)",
      }}
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <p
          className="text-center text-[12px] font-medium uppercase tracking-[0.12em] mb-8"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          Trusted by 200+ businesses worldwide
        </p>

        {/* Marquee container */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
            style={{ background: "linear-gradient(to right, var(--mk-surface), transparent)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
            style={{ background: "linear-gradient(to left, var(--mk-surface), transparent)" }}
          />

          <div
            className="flex w-max gap-x-10 sm:gap-x-14"
            data-mk-marquee
            style={{ animation: "mk-marquee 30s linear infinite" }}
          >
            {DOUBLE_BUSINESSES.map((r, i) => (
              <div
                key={`${r.name}-${i}`}
                className="flex items-center gap-2 opacity-50"
              >
                <Building2
                  className="size-4 shrink-0"
                  strokeWidth={1.5}
                  style={{ color: `oklch(0.55 0.12 ${r.hue})` }}
                />
                <span
                  className="text-[13px] font-medium whitespace-nowrap"
                  style={{ color: "var(--mk-text-muted)" }}
                >
                  {r.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

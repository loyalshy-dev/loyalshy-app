import { FadeIn } from "./motion"

const LOGOS = [
  { name: "Restaurant A", hue: 265 },
  { name: "Cafe B", hue: 15 },
  { name: "Bakery C", hue: 145 },
  { name: "Bar D", hue: 35 },
  { name: "Bistro E", hue: 220 },
  { name: "Kitchen F", hue: 160 },
  { name: "Deli G", hue: 330 },
  { name: "Grill H", hue: 50 },
] as const

const DOUBLE_LOGOS = [...LOGOS, ...LOGOS]

export function SocialProof() {
  return (
    <section
      className="py-12 sm:py-16 overflow-hidden"
      style={{
        background: "var(--mk-bg)",
        borderTop: "1px solid var(--mk-border)",
        borderBottom: "1px solid var(--mk-border)",
      }}
    >
      <FadeIn>
        <p
          className="text-center text-[13px] font-medium uppercase tracking-[0.1em] mb-8"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          Trusted by businesses worldwide
        </p>
      </FadeIn>

      {/* Marquee of logo placeholders */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 sm:w-32"
          style={{
            background: "linear-gradient(to right, var(--mk-bg), transparent)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 sm:w-32"
          style={{
            background: "linear-gradient(to left, var(--mk-bg), transparent)",
          }}
        />

        <div
          className="flex w-max gap-x-12 sm:gap-x-16"
          data-mk-marquee
          style={{ animation: "mk-marquee 35s linear infinite" }}
        >
          {DOUBLE_LOGOS.map((logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="flex items-center gap-3 opacity-40 hover:opacity-70 transition-opacity"
            >
              {/* Logo placeholder circle */}
              <div
                className="size-8 rounded-lg flex items-center justify-center text-[11px] font-bold"
                style={{
                  background: `oklch(0.55 0.12 ${logo.hue} / 0.1)`,
                  color: `oklch(0.55 0.12 ${logo.hue})`,
                  border: `1px solid oklch(0.55 0.12 ${logo.hue} / 0.15)`,
                }}
              >
                {logo.name[0]}
              </div>
              <span
                className="text-[14px] font-medium whitespace-nowrap"
                style={{ color: "var(--mk-text-muted)" }}
              >
                {logo.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

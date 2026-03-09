import Link from "next/link"

export function ClosingCTA() {
  return (
    <section
      className="relative isolate overflow-hidden py-24 sm:py-32"
      style={{ background: "var(--mk-surface)" }}
    >
      {/* Subtle brand gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(
            ellipse 70% 50% at 50% 50%,
            oklch(0.55 0.2 265 / 0.06) 0%,
            transparent 70%
          )`,
        }}
      />

      <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
        <h2
          className="text-3xl font-semibold sm:text-4xl"
          style={{ color: "var(--mk-text)", letterSpacing: "-0.025em" }}
        >
          Ready to grow your repeat business?
        </h2>
        <p
          className="mt-4 text-[15px] leading-relaxed"
          style={{ color: "var(--mk-text-muted)" }}
        >
          Join 200+ businesses using Loyalshy to turn first-time visitors into loyal regulars.
          Set up in 5 minutes, no credit card required.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/register" className="mk-btn-primary">
            Start Free Trial
          </Link>
          <Link href="#pricing" className="mk-btn-ghost">
            View Pricing
          </Link>
        </div>
      </div>
    </section>
  )
}

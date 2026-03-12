import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { FadeIn } from "./motion"

export function ClosingCTA() {
  return (
    <section
      className="relative isolate overflow-hidden py-24 sm:py-32"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* Gradient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 50% 80% at 20% 50%, oklch(0.55 0.2 265 / 0.06) 0%, transparent 70%),
            radial-gradient(ellipse 50% 80% at 80% 50%, oklch(0.55 0.17 155 / 0.05) 0%, transparent 70%)
          `,
        }}
      />

      {/* Top border accent */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.55 0.2 265 / 0.15), oklch(0.55 0.17 155 / 0.15), transparent)",
        }}
      />

      <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
        <FadeIn>
          <h2
            className="text-3xl font-bold sm:text-[2.5rem]"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
          >
            Ready to grow your{" "}
            <span className="mk-gradient-text">repeat business</span>?
          </h2>
          <p
            className="mt-5 text-[16px] leading-relaxed"
            style={{ color: "var(--mk-text-muted)" }}
          >
            Join businesses using Loyalshy to turn first-time visitors into
            loyal regulars. Set up in 5 minutes, no credit card required.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="mk-btn-primary !py-3.5 !px-8 !text-[15px] gap-2"
            >
              Get Started Free
              <ArrowRight className="size-4" />
            </Link>
            <Link href="#pricing" className="mk-btn-ghost !py-3.5 !px-8 !text-[15px]">
              View Pricing
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

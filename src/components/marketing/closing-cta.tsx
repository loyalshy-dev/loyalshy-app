import Link from "next/link"
import { Button } from "@/components/ui/button"

export function ClosingCTA() {
  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-32">
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(
              ellipse 70% 50% at 50% 50%,
              oklch(0.55 0.2 265 / 0.08) 0%,
              transparent 70%
            )
          `,
        }}
      />
      {/* Dot grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-25"
        style={{
          backgroundImage: `radial-gradient(
            circle,
            oklch(0.55 0.2 265 / 0.18) 1px,
            transparent 1px
          )`,
          backgroundSize: "28px 28px",
          maskImage: `radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 100%)`,
        }}
      />

      <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Ready to grow your repeat business?
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Join 200+ restaurants using Loyalshy to turn first-time visitors into loyal regulars.
          Set up in 5 minutes, no credit card required.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="h-11 rounded-lg px-8 text-sm font-medium shadow-sm"
            style={
              {
                background: "oklch(0.55 0.2 265)",
                color: "oklch(0.985 0 0)",
                "--tw-shadow-color": "oklch(0.55 0.2 265 / 0.35)",
              } as React.CSSProperties
            }
          >
            <Link href="/register">Start Free Trial</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 rounded-lg px-8 text-sm font-medium"
          >
            <Link href="#pricing">View Pricing</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

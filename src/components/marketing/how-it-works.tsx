/**
 * HowItWorks — Marketing section component
 *
 * Usage:
 *   import { HowItWorks } from "@/components/marketing/how-it-works"
 *   <HowItWorks />
 *
 * Server Component — no client-side interactivity required.
 */

import { Building2, QrCode, Smartphone } from "lucide-react"

// ─── Step Data ─────────────────────────────────────────────

const steps = [
  {
    number: "01",
    icon: Building2,
    title: "Set up your restaurant",
    description:
      "Create your account, customize your brand and loyalty program in minutes.",
  },
  {
    number: "02",
    icon: QrCode,
    title: "Print your QR code",
    description:
      "Download your unique QR code and place it at your counter or on tables.",
  },
  {
    number: "03",
    icon: Smartphone,
    title: "Customers scan & earn",
    description:
      "Customers scan the QR code, get a digital wallet pass, and start earning rewards.",
  },
] as const

// ─── Component ─────────────────────────────────────────────

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 sm:py-32 bg-background"
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">

        {/* — Heading — */}
        <div className="mx-auto max-w-2xl text-center mb-16 sm:mb-20">
          <p className="text-[13px] font-medium text-brand uppercase tracking-widest mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Three simple steps to launch your loyalty program
          </h2>
        </div>

        {/* — Steps — */}
        <div className="relative">

          {/* Horizontal connector line — desktop only */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-[2.75rem] left-[calc(16.666%+2.5rem)] right-[calc(16.666%+2.5rem)] h-px bg-border"
          />

          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 relative">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={step.number}
                  className="flex flex-col items-center text-center md:items-center"
                >
                  {/* Mobile: vertical connector above (skip first) */}
                  {index > 0 && (
                    <div
                      aria-hidden="true"
                      className="md:hidden w-px h-8 bg-border mb-10 -mt-10"
                    />
                  )}

                  {/* Number + Icon stack */}
                  <div className="relative mb-6 flex flex-col items-center gap-3">
                    {/* Numbered circle */}
                    <div className="flex size-11 items-center justify-center rounded-full border border-border bg-card shadow-sm relative z-10">
                      <span className="text-[11px] font-semibold text-muted-foreground tabular-nums tracking-wide">
                        {step.number}
                      </span>
                    </div>

                    {/* Icon square card */}
                    <div className="flex size-14 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                      <Icon className="size-6 text-brand" strokeWidth={1.5} />
                    </div>
                  </div>

                  {/* Text */}
                  <h3 className="text-[15px] font-semibold text-foreground mb-2 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground max-w-[220px]">
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

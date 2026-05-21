import Image from "next/image"
import { Palette, Send, ScanLine } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Stagger, StaggerItem } from "./motion"
import { StepVideo } from "./step-video"

/* ─── Step type ──────────────────────────────────────────────────── */

type StepBase = {
  number: string
  icon: LucideIcon
  title: string
  description: string
  alt: string
}
type Step = StepBase &
  (
    | { video: string; poster: string }
    | { image: string; width: number; height: number }
  )

/* ─── Icon colors per step ───────────────────────────────────────── */

const STEP_ICON_STYLES = [
  { bg: "oklch(0.704 0.193 32)", shadow: "oklch(0.704 0.193 32 / 0.2)" },
  { bg: "oklch(0.704 0.193 32)", shadow: "oklch(0.704 0.193 32 / 0.2)" },
  { bg: "oklch(0.2 0.005 285)", shadow: "oklch(0 0 0 / 0.2)" },
]

/* ─── Section ─────────────────────────────────────────────────────── */

export async function HowItWorks() {
  const t = await getTranslations("howItWorks")

  const steps: Step[] = [
    {
      number: "01",
      icon: Palette,
      title: t("steps.design.title"),
      description: t("steps.design.description"),
      video: "/steps/design.mp4",
      poster: "/steps/design-poster.webp",
      alt: t("steps.design.alt"),
    },
    {
      number: "02",
      icon: Send,
      title: t("steps.issue.title"),
      description: t("steps.issue.description"),
      image: "/steps/issue.webp",
      width: 1024,
      height: 1024,
      alt: t("steps.issue.alt"),
    },
    {
      number: "03",
      icon: ScanLine,
      title: t("steps.scan.title"),
      description: t("steps.scan.description"),
      image: "/steps/scan.webp",
      width: 1026,
      height: 1218,
      alt: t("steps.scan.alt"),
    },
  ]

  return (
    <section
      id="how-it-works"
      className="relative py-16 sm:py-24 md:py-32 overflow-hidden mk-mesh-bg"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Stagger className="grid grid-cols-1 gap-12 md:grid-cols-3" stagger={0.15}>
          {steps.map((step, i) => {
            const Icon = step.icon
            const iconStyle = STEP_ICON_STYLES[i]
            return (
              <StaggerItem key={step.number} className="h-full">
                <div className="relative h-full">
                  {/* Oversized faded step number */}
                  <span
                    aria-hidden="true"
                    className="absolute -top-10 -left-6 text-[9rem] font-black leading-none select-none pointer-events-none hidden md:block"
                    style={{ color: "oklch(0.704 0.193 32 / 0.04)" }}
                  >
                    {step.number}
                  </span>

                  <div className="relative z-10 flex h-full flex-col gap-4">
                    {/* Media first on mobile for visual hook */}
                    <div
                      className="aspect-square rounded-xl overflow-hidden md:order-last md:mt-auto"
                      style={{
                        boxShadow: "0 8px 32px oklch(0 0 0 / 0.08)",
                      }}
                    >
                      {"video" in step ? (
                        <StepVideo src={step.video} poster={step.poster} label={step.alt} />
                      ) : (
                        <Image
                          src={step.image}
                          alt={step.alt}
                          width={step.width}
                          height={step.height}
                          className="h-full w-full object-cover object-top"
                          loading="lazy"
                        />
                      )}
                    </div>

                    {/* Icon + title + description */}
                    <div className="flex items-center gap-3 mt-2">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{
                          background: iconStyle.bg,
                          boxShadow: `0 4px 12px ${iconStyle.shadow}`,
                        }}
                      >
                        <Icon className="size-5" strokeWidth={1.5} />
                      </div>
                      <h3
                        className="text-lg font-bold tracking-tight"
                        style={{ color: "var(--mk-text)" }}
                      >
                        {step.title}
                      </h3>
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--mk-text-muted)" }}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
      </div>
    </section>
  )
}

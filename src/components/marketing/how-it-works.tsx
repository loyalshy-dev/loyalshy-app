import Image from "next/image"
import { Building2, QrCode, Smartphone } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Stagger, StaggerItem } from "./motion"

/* ─── Icon colors per step ───────────────────────────────────────── */

const STEP_ICON_STYLES = [
  { bg: "oklch(0.55 0.2 265)", shadow: "oklch(0.55 0.2 265 / 0.2)" },
  { bg: "oklch(0.55 0.17 155)", shadow: "oklch(0.55 0.17 155 / 0.2)" },
  { bg: "oklch(0.2 0.005 285)", shadow: "oklch(0 0 0 / 0.2)" },
]

/* ─── Section ─────────────────────────────────────────────────────── */

export async function HowItWorks() {
  const t = await getTranslations("howItWorks")

  const steps = [
    {
      number: "01",
      icon: Building2,
      title: t("steps.setup.title"),
      description: t("steps.setup.description"),
      image: "/platform/studio.webp",
      alt: t("steps.setup.alt"),
    },
    {
      number: "02",
      icon: QrCode,
      title: t("steps.qr.title"),
      description: t("steps.qr.description"),
      image: "/platform/distribution.webp",
      alt: t("steps.qr.alt"),
    },
    {
      number: "03",
      icon: Smartphone,
      title: t("steps.earn.title"),
      description: t("steps.earn.description"),
      image: "/platform/passes.webp",
      alt: t("steps.earn.alt"),
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
              <StaggerItem key={step.number}>
                <div className="group relative">
                  {/* Oversized faded step number */}
                  <span
                    aria-hidden="true"
                    className="absolute -top-10 -left-6 text-[9rem] font-black leading-none select-none pointer-events-none hidden md:block"
                    style={{ color: "oklch(0.55 0.2 265 / 0.04)" }}
                  >
                    {step.number}
                  </span>

                  <div className="relative z-10 flex flex-col gap-4">
                    {/* Screenshot first on mobile for visual hook */}
                    <div
                      className={`rounded-xl overflow-hidden transition-transform duration-500 group-hover:-translate-y-2 md:order-last ${i === 0 ? "md:rotate-2" : i === 1 ? "md:-rotate-2" : ""}`}
                      style={{
                        border: "1px solid var(--mk-border)",
                        boxShadow: "0 8px 32px oklch(0 0 0 / 0.08)",
                      }}
                    >
                      <Image
                        src={step.image}
                        alt={step.alt}
                        width={800}
                        height={600}
                        className="w-full h-auto"
                        loading="lazy"
                      />
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

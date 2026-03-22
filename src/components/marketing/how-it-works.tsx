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
      className="relative py-32 overflow-hidden mk-mesh-bg"
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
                    className="absolute -top-10 -left-6 text-[9rem] font-black leading-none select-none pointer-events-none"
                    style={{ color: "oklch(0.55 0.2 265 / 0.04)" }}
                  >
                    {step.number}
                  </span>

                  <div className="relative z-10 flex flex-col gap-6">
                    {/* Icon box */}
                    <div
                      className="flex size-14 items-center justify-center rounded-2xl text-white"
                      style={{
                        background: iconStyle.bg,
                        boxShadow: `0 8px 24px ${iconStyle.shadow}`,
                      }}
                    >
                      <Icon className="size-6" strokeWidth={1.5} />
                    </div>

                    {/* Title + description */}
                    <h3
                      className="text-2xl font-bold tracking-tight"
                      style={{ color: "var(--mk-text)" }}
                    >
                      {step.title}
                    </h3>
                    <p
                      className="text-base leading-relaxed"
                      style={{ color: "var(--mk-text-muted)" }}
                    >
                      {step.description}
                    </p>

                    {/* Screenshot with hover lift */}
                    <div
                      className="mt-4 rounded-xl overflow-hidden transition-transform duration-500 group-hover:-translate-y-2"
                      style={{
                        border: "1px solid var(--mk-border)",
                        boxShadow: "0 8px 32px oklch(0 0 0 / 0.08)",
                        transform: i === 1 ? "rotate(-2deg)" : i === 0 ? "rotate(2deg)" : undefined,
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

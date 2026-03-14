import Image from "next/image"
import { Building2, QrCode, Smartphone } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { FadeIn, Stagger, StaggerItem } from "./motion"

/* ─── Section ─────────────────────────────────────────────────────── */

export async function HowItWorks() {
  const t = await getTranslations("howItWorks")

  const steps = [
    {
      number: "01",
      icon: Building2,
      title: t("steps.setup.title"),
      description: t("steps.setup.description"),
      image: "/platform/studio.png",
      alt: t("steps.setup.alt"),
    },
    {
      number: "02",
      icon: QrCode,
      title: t("steps.qr.title"),
      description: t("steps.qr.description"),
      image: "/platform/distribution.png",
      alt: t("steps.qr.alt"),
    },
    {
      number: "03",
      icon: Smartphone,
      title: t("steps.earn.title"),
      description: t("steps.earn.description"),
      image: "/platform/passes.png",
      alt: t("steps.earn.alt"),
    },
  ]

  return (
    <section
      id="how-it-works"
      className="py-24 sm:py-32"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-16 sm:mb-20">
            <p
              className="text-[13px] font-medium uppercase tracking-widest mb-3"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="text-3xl sm:text-[2.5rem] font-bold"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
            >
              {t("title")}
            </h2>
            <p
              className="mt-4 text-[16px] leading-relaxed"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("subtitle")}
            </p>
          </div>
        </FadeIn>

        <Stagger className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6" stagger={0.15}>
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <StaggerItem key={step.number}>
                <div className="group">
                  {/* Screenshot */}
                  <div
                    className="mb-6 rounded-xl overflow-hidden"
                    style={{
                      border: "1px solid var(--mk-border)",
                      boxShadow: "0 4px 16px oklch(0 0 0 / 0.06)",
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

                  {/* Step number + icon */}
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="text-[13px] font-bold tabular-nums"
                      style={{ color: "var(--mk-brand-purple)" }}
                    >
                      {step.number}
                    </span>
                    <div
                      className="flex size-9 items-center justify-center rounded-lg"
                      style={{
                        background: "oklch(0.55 0.2 265 / 0.06)",
                        border: "1px solid oklch(0.55 0.2 265 / 0.1)",
                      }}
                    >
                      <Icon
                        className="size-4"
                        strokeWidth={1.5}
                        style={{ color: "oklch(0.55 0.2 265)" }}
                      />
                    </div>
                  </div>

                  <h3
                    className="text-[16px] font-semibold mb-2"
                    style={{ color: "var(--mk-text)", letterSpacing: "-0.01em" }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-[15px] leading-relaxed"
                    style={{ color: "var(--mk-text-muted)" }}
                  >
                    {step.description}
                  </p>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
      </div>
    </section>
  )
}

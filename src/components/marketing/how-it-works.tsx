import Image from "next/image"
import { Building2, QrCode, Smartphone } from "lucide-react"
import { FadeIn, Stagger, StaggerItem } from "./motion"

const steps = [
  {
    number: "01",
    icon: Building2,
    title: "Set up your business",
    description:
      "Create your account, customize your brand and loyalty program in minutes.",
    image: "/platform/studio.png",
    alt: "Card design studio — customize your loyalty card",
  },
  {
    number: "02",
    icon: QrCode,
    title: "Print your QR code",
    description:
      "Download your unique QR code and place it at your counter or on tables.",
    image: "/platform/distribution.png",
    alt: "Distribution page with printable QR code and shareable link",
  },
  {
    number: "03",
    icon: Smartphone,
    title: "Customers scan & earn",
    description:
      "Customers scan, get a digital wallet pass, and start earning rewards instantly.",
    image: "/platform/passes.png",
    alt: "Pass management showing issued loyalty passes",
  },
] as const

/* ─── Section ─────────────────────────────────────────────────────── */

export function HowItWorks() {
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
              How it works
            </p>
            <h2
              className="text-3xl sm:text-[2.5rem] font-bold"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
            >
              Three steps to launch
            </h2>
            <p
              className="mt-4 text-[16px] leading-relaxed"
              style={{ color: "var(--mk-text-muted)" }}
            >
              Go from zero to live loyalty program in under 5 minutes
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

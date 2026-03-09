import { Building2, QrCode, Smartphone } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: Building2,
    title: "Set up your business",
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

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 sm:py-32"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center mb-16 sm:mb-20">
          <p
            className="text-[13px] font-medium uppercase tracking-widest mb-3"
            style={{ color: "var(--mk-brand-purple)" }}
          >
            How it works
          </p>
          <h2
            className="text-3xl sm:text-4xl font-semibold"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.025em" }}
          >
            Three simple steps to launch your loyalty program
          </h2>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Horizontal connector line — desktop only */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-[3.5rem] left-[calc(16.666%+2.5rem)] right-[calc(16.666%+2.5rem)] h-px"
            style={{ background: "var(--mk-border)" }}
          />

          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 relative">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={step.number}
                  className="mk-card-glass flex flex-col items-center text-center p-8"
                >
                  {index > 0 && (
                    <div
                      aria-hidden="true"
                      className="md:hidden w-px h-8 mb-6 -mt-14"
                      style={{ background: "var(--mk-border)" }}
                    />
                  )}

                  {/* Large faded step number */}
                  <div
                    className="text-[5rem] font-black leading-none select-none mb-4"
                    style={{ color: "oklch(0.55 0.2 265 / 0.1)" }}
                  >
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div
                    className="flex size-14 items-center justify-center rounded-xl mb-6"
                    style={{
                      background: "oklch(0.55 0.2 265 / 0.08)",
                      border: "1px solid oklch(0.55 0.2 265 / 0.15)",
                    }}
                  >
                    <Icon
                      className="size-6"
                      strokeWidth={1.5}
                      style={{ color: "oklch(0.55 0.2 265)" }}
                    />
                  </div>

                  <h3
                    className="text-[15px] font-semibold mb-2"
                    style={{ color: "var(--mk-text)", letterSpacing: "-0.01em" }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-[13px] leading-relaxed max-w-[220px]"
                    style={{ color: "var(--mk-text-muted)" }}
                  >
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

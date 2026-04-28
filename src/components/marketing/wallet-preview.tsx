import { Check, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { FadeIn } from "./motion"
import { PhoneMockupInteractive } from "./phone-mockup"

export async function WalletPreview() {
  const t = await getTranslations("walletPreview")

  const bullets = [
    t("badge1"),
    t("badge2"),
    t("badge3"),
  ]

  return (
    <section
      id="customer-view"
      className="relative py-24 overflow-hidden"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          {/* Text column */}
          <FadeIn direction="left" className="order-2 lg:order-1 flex flex-col gap-8">
            <p
              className="text-[13px] font-bold tracking-wide"
              style={{ color: "var(--mk-brand-green)" }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="mk-clamp-h2 font-black tracking-tight leading-tight"
              style={{ color: "var(--mk-text)" }}
            >
              {t("title")}
            </h2>

            <ul className="flex flex-col gap-6">
              {bullets.map((text) => (
                <li key={text} className="flex gap-4">
                  <div
                    className="flex size-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "oklch(0.704 0.193 32 / 0.15)" }}
                  >
                    <Check
                      className="size-3.5"
                      strokeWidth={2.5}
                      style={{ color: "oklch(0.50 0.16 145)" }}
                    />
                  </div>
                  <p
                    className="font-medium"
                    style={{ color: "var(--mk-text-muted)" }}
                  >
                    {text}
                  </p>
                </li>
              ))}
            </ul>

            <Link
              href="#pricing"
              className="inline-flex items-center gap-2 font-bold transition-colors group"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("seePricing")}
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </FadeIn>

          {/* Interactive phone mockup */}
          <FadeIn direction="right" delay={0.2} className="flex justify-center order-1 lg:order-2">
            <div className="relative">
              {/* Glow behind phone */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 scale-125 rounded-full blur-3xl"
                style={{
                  background: "radial-gradient(circle, oklch(0.704 0.193 32 / 0.08) 0%, transparent 70%)",
                }}
              />
              <PhoneMockupInteractive />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

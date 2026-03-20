import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { FadeIn } from "./motion"

export async function ClosingCTA() {
  const t = await getTranslations("closingCta")
  const tCommon = await getTranslations("common")

  return (
    <section
      className="relative isolate overflow-hidden py-28 sm:py-36"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* Gradient mesh background — strongest on the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 60% 70% at 30% 50%, oklch(0.55 0.2 265 / 0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 60% at 70% 40%, oklch(0.55 0.17 155 / 0.06) 0%, transparent 70%),
            radial-gradient(ellipse 80% 40% at 50% 80%, oklch(0.55 0.2 265 / 0.04) 0%, transparent 70%)
          `,
        }}
      />

      {/* Top border accent */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.55 0.2 265 / 0.2), oklch(0.55 0.17 155 / 0.2), transparent)",
        }}
      />

      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <FadeIn>
          {/* Biggest heading on the page */}
          <h2
            className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.05]"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.045em" }}
          >
            {t("title1")}{" "}
            <span className="mk-gradient-text">{t("titleHighlight")}</span>?
          </h2>
          <p
            className="mt-6 text-[17px] leading-relaxed mx-auto max-w-xl"
            style={{ color: "var(--mk-text-muted)" }}
          >
            {t("subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="mk-btn-primary py-4! px-10! text-[16px]! gap-2"
            >
              {tCommon("getStartedFree")}
              <ArrowRight className="size-4" />
            </Link>
            <Link href="#pricing" className="mk-btn-ghost py-4! px-10! text-[16px]!">
              {t("viewPricing")}
            </Link>
            <Link
              href="/contact"
              className="text-[15px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("talkToUs")}
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

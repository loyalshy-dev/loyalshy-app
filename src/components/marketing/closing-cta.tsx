import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { FadeIn } from "./motion"

export async function ClosingCTA() {
  const t = await getTranslations("closingCta")
  const tCommon = await getTranslations("common")

  return (
    <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6">
      <div
        className="relative mx-auto max-w-7xl rounded-3xl sm:rounded-[4rem] p-8 sm:p-16 md:p-24 overflow-hidden flex flex-col items-center text-center gap-12"
      >
        {/* Gradient overlay background */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, oklch(0.6 0.18 32), oklch(0.704 0.193 32), oklch(0.704 0.193 32))",
            opacity: 0.9,
          }}
        />
        <div aria-hidden="true" className="absolute inset-0 mk-mesh-bg opacity-20" />

        <FadeIn>
          <div className="relative z-10 flex flex-col items-center gap-8">
            {/* Biggest heading on the page */}
            <h2
              className="mk-clamp-h1 font-black leading-[0.9] max-w-4xl"
              style={{ color: "oklch(0.99 0 0)", letterSpacing: "-0.045em" }}
            >
              {t("title1")}{" "}
              <br />
              {t("titleHighlight")}?
            </h2>
            <p
              className="text-xl max-w-2xl font-medium"
              style={{ color: "oklch(1 0 0 / 0.85)" }}
            >
              {t("subtitle")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full px-10 py-5 text-lg font-bold transition-all active:scale-95"
                style={{
                  background: "oklch(0.99 0 0)",
                  color: "oklch(0.704 0.193 32)",
                }}
              >
                {tCommon("getStartedFree")}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="#pricing"
                className="inline-flex items-center justify-center rounded-full px-10 py-5 text-lg font-bold transition-all hover:bg-white/20"
                style={{
                  background: "oklch(1 0 0 / 0.1)",
                  backdropFilter: "blur(12px)",
                  color: "oklch(0.99 0 0)",
                  border: "1px solid oklch(1 0 0 / 0.2)",
                }}
              >
                {t("viewPricing")}
              </Link>
              <Link
                href="/contact"
                className="text-[15px] font-bold transition-opacity hover:opacity-70 flex items-center gap-2 ml-4"
                style={{ color: "oklch(0.99 0 0)" }}
              >
                {t("talkToUs")}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

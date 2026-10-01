import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { BrandMark } from "@/components/brand-mark"

// The one coral surface on the page: the app icon's colour, the mark in
// cream, one sentence, one button.
export async function ClosingCTA() {
  const t = await getTranslations("closingCta")
  const tCommon = await getTranslations("common")
  const locale = (await getLocale()) as Locale

  return (
    <section style={{ background: "var(--mk-accent)" }}>
      <div className="mk-wrap py-20 lg:py-28">
        <BrandMark className="h-5 text-white sm:h-6" />
        <h2 className="font-display mk-display-1 mt-8 max-w-[16ch] text-white">
          {t("title1")} {t("titleHighlight")}
        </h2>
        <p className="mk-lead mt-6 max-w-[46ch]" style={{ color: "oklch(1 0 0 / 0.85)" }}>
          {t("subtitle")}
        </p>
        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-semibold transition-colors hover:bg-white/90"
            style={{ color: "var(--mk-accent)" }}
          >
            {tCommon("getStartedFree")}
          </Link>
          <Link
            href={localePath(locale, "/contact")}
            className="text-base font-semibold text-white underline-offset-4 hover:underline"
          >
            {t("talkToUs")}
          </Link>
        </div>
      </div>
    </section>
  )
}

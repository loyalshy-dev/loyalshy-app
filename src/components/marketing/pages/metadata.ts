import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { marketingAlternates, marketingSocial, type MarketingPath } from "@/i18n/marketing"

/** Title, description, canonical, hreflang and social tags for a secondary marketing page. */
export async function pageMetadata(locale: Locale, path: MarketingPath, key: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `metadata.${key}` })
  return {
    title: t("title"),
    description: t("description"),
    alternates: marketingAlternates(locale, path),
    ...marketingSocial(locale, path, `${t("title")} — Loyalshy`, t("description")),
    robots: { index: true, follow: true },
  }
}

import type { MetadataRoute } from "next"
import { locales } from "@/i18n/config"
import { MARKETING_PATHS, marketingUrl } from "@/i18n/marketing"

// Every marketing page in every language, each entry listing its
// hreflang alternates. Bump LAST_MODIFIED when marketing copy changes.
const LAST_MODIFIED = "2026-09-29"

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.flatMap((path) => {
    const languages = Object.fromEntries(
      locales.map((l) => [l, marketingUrl(l, path)])
    )
    return locales.map((locale) => ({
      url: marketingUrl(locale, path),
      lastModified: LAST_MODIFIED,
      alternates: { languages },
    }))
  })
}

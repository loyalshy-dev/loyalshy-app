import type { MetadataRoute } from "next"
import { locales } from "@/i18n/config"
import { MARKETING_PATHS, marketingAlternates, marketingUrl, type MarketingPath } from "@/i18n/marketing"

// Every marketing page in every language, each entry listing its
// hreflang alternates (same helper as the pages, x-default included).
// Bump LAST_MODIFIED when most marketing copy changes; give a page its own
// date below when it changes alone — one date stamped on every URL at
// every deploy is what makes Google stop trusting lastmod.
const LAST_MODIFIED = "2026-10-04"
const LASTMOD_BY_PATH: Partial<Record<MarketingPath, string>> = {
  "/privacy": "2026-10-01",
  "/terms": "2026-10-01",
  "/cookies": "2026-10-01",
  "/legal-notice": "2026-10-05",
}

// Public but not for search: /status is operational, not content.
const UNLISTED = new Set<string>(["/status"])

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.filter((path) => !UNLISTED.has(path)).flatMap((path) =>
    locales.map((locale) => ({
      url: marketingUrl(locale, path),
      lastModified: LASTMOD_BY_PATH[path] ?? LAST_MODIFIED,
      alternates: { languages: marketingAlternates(locale, path).languages },
    }))
  )
}

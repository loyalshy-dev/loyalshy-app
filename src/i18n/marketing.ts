import { defaultLocale, locales, type Locale } from "./config"

// ─── Marketing URLs ─────────────────────────────────────────
// The marketing site (landing, contact, legal) lives under
// src/app/[locale] so every language has its own crawlable URL:
//   /            → English (default, no prefix; rewritten to /en)
//   /es, /fr     → Spanish, French
// The app (dashboard, auth, join, studio) keeps cookie-based locale.
// Rewrites/redirects for the unprefixed English URLs are in next.config.ts.
// ─────────────────────────────────────────────────────────────

export const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

/** Unprefixed marketing paths (the English URLs). */
export const MARKETING_PATHS = ["/", "/contact", "/privacy", "/terms", "/cookies"] as const
export type MarketingPath = (typeof MARKETING_PATHS)[number]

/** hreflang / Open Graph codes per locale. */
export const ogLocales: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

/** Localized path for a marketing page: ("es", "/contact") → "/es/contact". */
export function localePath(locale: Locale, path: string): string {
  if (locale === defaultLocale) return path
  return path === "/" ? `/${locale}` : `/${locale}${path}`
}

/** Absolute URL of a marketing page (the root has no trailing slash, like the canonical). */
export function marketingUrl(locale: Locale, path: string): string {
  const localized = localePath(locale, path)
  return localized === "/" ? siteUrl : `${siteUrl}${localized}`
}

/**
 * Splits a pathname into its marketing locale + unprefixed path.
 * Returns null when the pathname isn't a marketing page.
 */
export function parseMarketingPath(pathname: string): { locale: Locale; path: MarketingPath } | null {
  const [, first = "", ...rest] = pathname.split("/")
  const prefixed = first !== defaultLocale && isLocale(first)
  const locale: Locale = prefixed ? first : defaultLocale
  const path = prefixed ? `/${rest.join("/")}`.replace(/\/$/, "") || "/" : pathname
  return (MARKETING_PATHS as readonly string[]).includes(path)
    ? { locale, path: path as MarketingPath }
    : null
}

/** canonical + hreflang alternates for a marketing page. */
export function marketingAlternates(locale: Locale, path: MarketingPath) {
  const languages: Record<string, string> = {}
  for (const l of locales) languages[l] = marketingUrl(l, path)
  languages["x-default"] = marketingUrl(defaultLocale, path)
  return {
    canonical: marketingUrl(locale, path),
    languages,
  }
}

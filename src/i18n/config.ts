export const locales = ["en", "es", "ca", "fr", "it", "pt", "de"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "en"

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ca: "Català",
  fr: "Français",
  it: "Italiano",
  pt: "Português",
  de: "Deutsch",
}

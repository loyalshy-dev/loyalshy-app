import { useLocale } from "next-intl"
import type { Locale } from "./config"
import { localePath } from "./marketing"

/** Client-side localePath() bound to the current locale. */
export function useLocalePath() {
  const locale = useLocale() as Locale
  return (path: string) => localePath(locale, path)
}

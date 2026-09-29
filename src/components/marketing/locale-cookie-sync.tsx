"use client"

import { useEffect } from "react"
import type { Locale } from "@/i18n/config"

/**
 * Remembers the language of the marketing page being viewed so the app
 * (register, login, dashboard — cookie-based locale) continues in it, and
 * so "/" sends a returning visitor back to their language (next.config.ts).
 */
export function LocaleCookieSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    if (!document.cookie.split("; ").includes(`locale=${locale}`)) {
      document.cookie = `locale=${locale};path=/;max-age=31536000;samesite=lax`
    }
  }, [locale])
  return null
}

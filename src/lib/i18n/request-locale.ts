import "server-only"

import { getLocale } from "next-intl/server"
import { defaultLocale, type Locale } from "@/i18n/config"
import { toLocale } from "./messages"

/**
 * The language of the person behind the current request: the URL locale on
 * marketing pages, else the `locale` cookie, else Accept-Language (see
 * src/i18n/request.ts). English outside a request (an `after()` callback,
 * a Better Auth hook called without one).
 */
export async function requestLocale(): Promise<Locale> {
  try {
    return toLocale(await getLocale())
  } catch {
    return defaultLocale
  }
}

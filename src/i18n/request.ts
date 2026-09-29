import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import { defaultLocale, locales, type Locale } from "./config"

function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Marketing pages (src/app/[locale]) set the locale from the URL via
  // setRequestLocale — use it and skip cookies so those pages stay static.
  const requested = await requestLocale
  if (isLocale(requested)) {
    return {
      locale: requested,
      messages: (await import(`@/messages/${requested}.json`)).default,
    }
  }

  // App pages: `locale` cookie, then Accept-Language.
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get("locale")?.value

  let locale: Locale = defaultLocale

  if (isLocale(localeCookie)) {
    locale = localeCookie
  } else {
    const headerStore = await headers()
    const primary = (headerStore.get("accept-language") || "").slice(0, 2).toLowerCase()
    if (isLocale(primary)) {
      locale = primary
    }
  }

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  }
})

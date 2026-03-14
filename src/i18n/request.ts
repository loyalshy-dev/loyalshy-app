import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import { defaultLocale, locales, type Locale } from "./config"

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get("locale")?.value

  let locale: Locale = defaultLocale

  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale
  } else {
    const headerStore = await headers()
    const acceptLanguage = headerStore.get("accept-language") || ""
    if (acceptLanguage.includes("es")) {
      locale = "es"
    }
  }

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  }
})

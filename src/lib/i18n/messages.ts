// Messages outside a request (wallet passes, Trigger.dev tasks, route
// handlers that pick a locale themselves). Pages use src/i18n/request.ts.
import { createTranslator } from "next-intl"
import { defaultLocale, locales, type Locale } from "@/i18n/config"

type Messages = Record<string, unknown>

const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  en: () => import("@/messages/en.json"),
  es: () => import("@/messages/es.json"),
  ca: () => import("@/messages/ca.json"),
  fr: () => import("@/messages/fr.json"),
  it: () => import("@/messages/it.json"),
  pt: () => import("@/messages/pt.json"),
  de: () => import("@/messages/de.json"),
}

const cache = new Map<Locale, Messages>()

export async function loadMessages(locale: Locale): Promise<Messages> {
  const hit = cache.get(locale)
  if (hit) return hit
  const messages = (await loaders[locale]()).default
  cache.set(locale, messages)
  return messages
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
}

/** A supported locale from anything (payload field, cookie, header); English otherwise. */
export function toLocale(value: unknown): Locale {
  if (isLocale(value)) return value
  if (typeof value === "string") {
    const primary = value.slice(0, 2).toLowerCase()
    if (isLocale(primary)) return primary
  }
  return defaultLocale
}

export type Translate = (key: string, values?: Record<string, string | number>) => string

/** A plain `t(key, values)` for one namespace in one locale. */
export async function getTranslator(locale: Locale, namespace: string): Promise<Translate> {
  const messages = await loadMessages(locale)
  const t = createTranslator({ locale, messages, namespace })
  return (key, values) => (t as unknown as Translate)(key, values)
}

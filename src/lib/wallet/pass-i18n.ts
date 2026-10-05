// ─── Wallet pass text in every language ──────────────────────
// A pass is written once and read on phones in any language, so every
// system string goes into the pass in all seven: Apple through
// `<lang>.lproj/pass.strings` (keyed by the English text that pass.json
// carries), Google through LocalizedString.translatedValues. The phone
// picks its own language; anything without a match shows the English.
//
// The English output must stay byte-identical to what passes carried before
// localization: iOS banners a changeMessage field whenever its value changes,
// so a reworded English value would notify every holder on the next refresh.
// Merchant text (program name, custom labels, reward copy) is never translated.
// ─────────────────────────────────────────────────────────────
import { createTranslator } from "next-intl"
import { defaultLocale, locales, type Locale } from "@/i18n/config"
import { loadMessages, type Translate } from "@/lib/i18n/messages"
import { formatProgressValue, type ProgressStyle } from "./card-design"

/** BCP 47 tags for dates: Portuguese copy is pt-PT. */
const DATE_LOCALE: Record<Locale, string> = {
  en: "en-US",
  es: "es-ES",
  ca: "ca-ES",
  fr: "fr-FR",
  it: "it-IT",
  pt: "pt-PT",
  de: "de-DE",
}

export type GoogleLocalizedString = {
  defaultValue: { language: string; value: string }
  translatedValues?: { language: string; value: string }[]
}

export type PassLocalizer = {
  /** English text of `walletPass.<key>`; the other languages are recorded. */
  t(key: string, values?: Record<string, string | number>, format?: (s: string) => string): string
  /** Text that comes from code rather than messages (dates). */
  each(render: (locale: Locale, dateLocale: string) => string): string
  /** Google LocalizedString for an English text produced by this localizer. */
  localized(en: string): GoogleLocalizedString
  /** Same, or undefined when the text has no translation (merchant text). */
  localizedIf(en: string): GoogleLocalizedString | undefined
  /** Recorded translations per language, English → translated. */
  translations(): Partial<Record<Locale, Record<string, string>>>
  /** One English text in one language (the staff app's card preview). */
  in(locale: Locale, en: string): string
}

const others = locales.filter((l) => l !== defaultLocale)

export async function createPassLocalizer(): Promise<PassLocalizer> {
  const translators = Object.fromEntries(
    await Promise.all(
      locales.map(async (locale) => {
        const messages = await loadMessages(locale)
        const t = createTranslator({ locale, messages, namespace: "walletPass" })
        return [locale, t as unknown as Translate] as const
      })
    )
  ) as Record<Locale, Translate>

  // English text → its version in each other language.
  const dict = new Map<string, Partial<Record<Locale, string>>>()

  const record = (render: (locale: Locale) => string): string => {
    const en = render(defaultLocale)
    if (!dict.has(en)) {
      const row: Partial<Record<Locale, string>> = {}
      for (const locale of others) {
        const value = render(locale)
        if (value !== en) row[locale] = value
      }
      dict.set(en, row)
    }
    return en
  }

  const localized = (en: string): GoogleLocalizedString => {
    const row = dict.get(en) ?? {}
    const translatedValues = others
      .filter((locale) => row[locale] !== undefined)
      .map((locale) => ({ language: locale, value: row[locale] as string }))
    return {
      defaultValue: { language: defaultLocale, value: en },
      ...(translatedValues.length > 0 ? { translatedValues } : {}),
    }
  }

  return {
    t: (key, values, format = (s) => s) => {
      // Numbers go in as text: ICU would add thousands separators ("1,000"),
      // and the English must match what passes carried before. Only a
      // plural's `count` stays numeric.
      const args = values && Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, typeof v === "number" && k !== "count" ? String(v) : v])
      )
      return record((locale) => format(translators[locale](key, args)))
    },
    each: (render) => record((locale) => render(locale, DATE_LOCALE[locale])),
    localized,
    localizedIf(en) {
      const row = dict.get(en)
      return row && Object.keys(row).length > 0 ? localized(en) : undefined
    },
    in: (locale, en) => (locale === defaultLocale ? en : (dict.get(en)?.[locale] ?? en)),
    translations() {
      const out: Partial<Record<Locale, Record<string, string>>> = {}
      for (const [en, row] of dict) {
        for (const locale of others) {
          const value = row[locale]
          if (value === undefined) continue
          ;(out[locale] ??= {})[en] = value
        }
      }
      return out
    },
  }
}

/**
 * formatProgressValue, localized. Symbol and percentage styles carry no
 * words and pass straight through; a custom reward label is merchant text.
 */
export function localizedProgressValue(
  loc: PassLocalizer,
  current: number,
  total: number,
  style: ProgressStyle,
  hasReward: boolean,
): string {
  if (hasReward) return loc.t("values.rewardAvailable")
  if (style === "REMAINING") return loc.t("values.visitsLeft", { count: Math.max(0, total - current) })
  if (style === "NUMBERS" || !["CIRCLES", "SQUARES", "STARS", "STAMPS", "PERCENTAGE"].includes(style)) {
    return loc.t("values.visitsOf", { current, total })
  }
  return formatProgressValue(current, total, style, hasReward)
}

/** "Oct 5, 2026" in each language. */
export function localizedDate(loc: PassLocalizer, date: Date): string {
  return loc.each((_, tag) => date.toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" }))
}

/** "Oct 2026" in each language. */
export function localizedMonth(loc: PassLocalizer, date: Date): string {
  return loc.each((_, tag) => date.toLocaleDateString(tag, { month: "short", year: "numeric" }))
}

/** "Oct 5, 3:04 PM" in each language. */
export function localizedDateTime(loc: PassLocalizer, date: Date): string {
  return loc.each((_, tag) => date.toLocaleString(tag, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))
}

/** formatCouponValue, localized ("20% off", "$5 off", "Free item"). */
export function localizedCouponValue(
  loc: PassLocalizer,
  config: { discountType: "percentage" | "fixed" | "freebie"; discountValue: number },
): string {
  switch (config.discountType) {
    case "percentage":
      return loc.t("values.percentOff", { value: config.discountValue })
    case "fixed":
      return loc.t("values.amountOff", { value: config.discountValue })
    case "freebie":
      return loc.t("values.freeItem")
  }
}

/**
 * A Google text module whose header/body carry their translations. Merchant
 * text has none, so it goes out exactly as before.
 */
export function googleTextModule(loc: PassLocalizer, id: string, header: string, body: string) {
  const localizedHeader = loc.localizedIf(header)
  const localizedBody = loc.localizedIf(body)
  return {
    id,
    header,
    body,
    ...(localizedHeader ? { localizedHeader } : {}),
    ...(localizedBody ? { localizedBody } : {}),
  }
}

/** A Google message (TEXT_AND_NOTIFY) with translated header/body when they exist. */
export function googleMessage(loc: PassLocalizer, id: string, header: string, body: string) {
  const { localizedHeader, localizedBody } = googleTextModule(loc, id, header, body)
  return {
    id,
    header,
    body,
    ...(localizedHeader ? { localizedHeader } : {}),
    ...(localizedBody ? { localizedBody } : {}),
    messageType: "TEXT_AND_NOTIFY" as const,
  }
}

/** A Google label (loyaltyPoints.label) with its translations. */
export function googleLabel(loc: PassLocalizer, label: string) {
  const localizedLabel = loc.localizedIf(label)
  return { label, ...(localizedLabel ? { localizedLabel } : {}) }
}

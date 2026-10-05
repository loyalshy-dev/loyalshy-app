// @vitest-environment node
import { describe, expect, it } from "vitest"
import { createTranslator } from "next-intl"
import { locales } from "@/i18n/config"
import { loadMessages } from "@/lib/i18n/messages"
import { formatCouponValue } from "@/lib/pass-config"
import { formatProgressValue, type ProgressStyle } from "./card-design"
import {
  createPassLocalizer,
  googleMessage,
  googleTextModule,
  localizedCouponValue,
  localizedDateTime,
  localizedMonth,
  localizedProgressValue,
} from "./pass-i18n"

// The English a pass carries must not change: iOS banners a changeMessage
// field whenever its value changes, so a reworded English string would
// notify every holder on the next refresh.
describe("English stays byte-identical", () => {
  it("progress values match formatProgressValue for every style", async () => {
    const loc = await createPassLocalizer()
    const styles: ProgressStyle[] = ["NUMBERS", "CIRCLES", "SQUARES", "STARS", "STAMPS", "PERCENTAGE", "REMAINING"]
    for (const style of styles) {
      for (const [current, total] of [[0, 10], [1, 2], [9, 10], [3, 1000], [999, 1000]]) {
        expect(localizedProgressValue(loc, current, total, style, false)).toBe(formatProgressValue(current, total, style, false))
      }
      expect(localizedProgressValue(loc, 10, 10, style, true)).toBe(formatProgressValue(10, 10, style, true))
    }
  })

  it("coupon values match formatCouponValue", async () => {
    const loc = await createPassLocalizer()
    for (const config of [
      { discountType: "percentage" as const, discountValue: 20 },
      { discountType: "percentage" as const, discountValue: 12.5 },
      { discountType: "fixed" as const, discountValue: 5 },
      { discountType: "fixed" as const, discountValue: 1500 },
      { discountType: "freebie" as const, discountValue: 0 },
    ]) {
      expect(localizedCouponValue(loc, config)).toBe(formatCouponValue(config as Parameters<typeof formatCouponValue>[0]))
    }
  })

  it("sentences, change messages and dates keep their old English", async () => {
    const loc = await createPassLocalizer()
    expect(loc.t("values.programInfo", { visits: 10, reward: "A coffee", days: 30 })).toBe(
      "Earn a reward after every 10 visits! Your reward: A coffee. Rewards expire 30 days after being earned.",
    )
    expect(loc.t("values.currentProgress", { current: 3, required: 10, total: 1234 })).toBe(
      "3 of 10 visits completed this cycle. 1234 total visits.",
    )
    expect(loc.t("notify.stampAdded")).toBe("Stamp added! %@")
    expect(loc.t("notify.visitRecorded")).toBe("Visit recorded — %@ total")
    expect(loc.t("notify.coupon")).toBe("Coupon %@")
    expect(loc.t("notify.couponRedeemed")).toBe("Coupon redeemed — %@")
    expect(loc.t("values.noAnnouncements")).toBe("No announcements yet")
    expect(loc.t("values.poweredBy")).toBe("Loyalshy — Digital Loyalty Cards\nhttps://loyalshy.com")
    expect(loc.t("values.prizeUsed", { prize: "" }, (s) => s.trim())).toBe("(Used)")
    expect(loc.t("names.loyaltyCard", { name: "Café Sol" })).toBe("Café Sol Loyalty Card")
    expect(loc.t("labels.memberNumber")).toBe("MEMBER #")
    const date = new Date("2026-10-05T14:04:00Z")
    expect(localizedMonth(loc, date)).toBe(date.toLocaleDateString("en-US", { month: "short", year: "numeric" }))
    expect(localizedDateTime(loc, date)).toBe(
      date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    )
  })
})

describe("translations", () => {
  it("records every other language, keyed by the English text", async () => {
    const loc = await createPassLocalizer()
    const en = loc.t("notify.stampAdded")
    loc.t("values.visitsLeft", { count: 1 })
    const all = loc.translations()
    expect(all.es?.[en]).toBe("¡Sello añadido! %@")
    expect(all.de?.[en]).toBe("Stempel hinzugefügt! %@")
    expect(all.es?.["1 visit left"]).toBe("Te queda 1 visita")
    expect(loc.in("fr", en)).toBe("Tampon ajouté ! %@")
    expect(loc.in("it", "Merchant text")).toBe("Merchant text")
  })

  it("leaves merchant text without Google translations", async () => {
    const loc = await createPassLocalizer()
    const header = loc.t("labels.businessHours")
    const module = googleTextModule(loc, "businessHours", header, "Mon–Fri 8–20")
    expect(module.localizedHeader?.translatedValues?.find((v) => v.language === "es")?.value).toBe("HORARIO")
    expect(module.localizedBody).toBeUndefined()
    const message = googleMessage(loc, "stamp-4", loc.t("notify.stampAddedTitle"), "4 / 10 Visits")
    expect(message.messageType).toBe("TEXT_AND_NOTIFY")
    expect(message.localizedHeader?.defaultValue).toEqual({ language: "en", value: "Stamp added!" })
  })

  it("every message renders in every language with sample arguments", async () => {
    const args = { visits: 10, reward: "R", days: 30, current: 3, required: 10, total: 12, url: "https://x", count: 2, prize: "P", value: 5, time: "T", name: "N" }
    const en = (await loadMessages("en")).walletPass as Record<string, Record<string, string>>
    for (const locale of locales) {
      const t = createTranslator({ locale, messages: await loadMessages(locale), namespace: "walletPass" })
      for (const [group, keys] of Object.entries(en)) {
        for (const key of Object.keys(keys)) {
          const out = (t as unknown as (k: string, v: object) => string)(`${group}.${key}`, args)
          expect(out, `${locale} walletPass.${group}.${key}`).not.toContain("walletPass.")
          expect(out.length).toBeGreaterThan(0)
        }
      }
    }
  })
})

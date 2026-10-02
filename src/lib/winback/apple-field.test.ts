import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))

import { buildAppleWinbackField, WINBACK_PLACEHOLDER } from "@/lib/wallet/apple/generate-pass"

describe("buildAppleWinbackField", () => {
  it("placeholder, never notifying, before any send", () => {
    expect(buildAppleWinbackField({ message: null, fresh: false, sendId: null }, "Café Lola")).toEqual({
      key: "winback",
      label: "Café Lola",
      value: WINBACK_PLACEHOLDER,
    })
  })

  it("plain message with a banner only while fresh, never HTML", () => {
    const fresh = buildAppleWinbackField({ message: "¡Vuelve!", fresh: true, sendId: "s" }, "Café Lola")
    expect(fresh).toEqual({ key: "winback", label: "Café Lola", value: "¡Vuelve!", changeMessage: "%@" })
    expect(fresh).not.toHaveProperty("attributedValue")
    const stale = buildAppleWinbackField({ message: "¡Vuelve!", fresh: false, sendId: "s" }, "Café Lola")
    expect(stale.changeMessage).toBeUndefined()
  })
})

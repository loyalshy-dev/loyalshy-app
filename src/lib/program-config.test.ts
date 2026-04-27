import { describe, it, expect } from "vitest"
import { parseMinigameConfig, minigameConfigSchema } from "./pass-config"

describe("parseMinigameConfig", () => {
  it("parses valid minigame config from nested config object", () => {
    const config = {
      minigame: { enabled: true, gameType: "scratch" },
    }
    const result = parseMinigameConfig(config)
    expect(result).toEqual({ enabled: true, gameType: "scratch" })
  })

  it("parses all game types", () => {
    for (const gameType of ["scratch", "slots", "wheel"] as const) {
      const config = { minigame: { enabled: true, gameType } }
      const result = parseMinigameConfig(config)
      expect(result).toEqual({ enabled: true, gameType })
    }
  })

  it("parses disabled minigame config", () => {
    const config = { minigame: { enabled: false, gameType: "wheel" } }
    const result = parseMinigameConfig(config)
    expect(result).toEqual({ enabled: false, gameType: "wheel" })
  })

  it("returns null for null input", () => {
    expect(parseMinigameConfig(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(parseMinigameConfig(undefined)).toBeNull()
  })

  it("returns null for config without minigame key", () => {
    const config = { discountType: "percentage", discountValue: 20 }
    expect(parseMinigameConfig(config)).toBeNull()
  })

  it("returns null for invalid game type", () => {
    const config = { minigame: { enabled: true, gameType: "invalid" } }
    expect(parseMinigameConfig(config)).toBeNull()
  })

  it("returns null for missing enabled field", () => {
    const config = { minigame: { gameType: "scratch" } }
    expect(parseMinigameConfig(config)).toBeNull()
  })

  it("returns null for non-boolean enabled", () => {
    const config = { minigame: { enabled: "yes", gameType: "scratch" } }
    expect(parseMinigameConfig(config)).toBeNull()
  })

  it("returns null for non-object minigame value", () => {
    const config = { minigame: "scratch" }
    expect(parseMinigameConfig(config)).toBeNull()
  })

  it("works with config that has other fields alongside minigame", () => {
    const config = {
      discountType: "percentage",
      discountValue: 20,
      minigame: { enabled: true, gameType: "slots" },
    }
    const result = parseMinigameConfig(config)
    expect(result).toEqual({ enabled: true, gameType: "slots" })
  })
})

describe("minigameConfigSchema", () => {
  it("validates correct config", () => {
    const result = minigameConfigSchema.safeParse({
      enabled: true,
      gameType: "wheel",
    })
    expect(result.success).toBe(true)
  })

  it("rejects unknown game type", () => {
    const result = minigameConfigSchema.safeParse({
      enabled: true,
      gameType: "roulette",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing fields", () => {
    const result = minigameConfigSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

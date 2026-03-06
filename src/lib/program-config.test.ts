import { describe, it, expect } from "vitest"
import { parseMinigameConfig, minigameConfigSchema, parsePointsConfig, pointsConfigSchema, getCheapestCatalogItem } from "./pass-config"

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

// ─── Points Config ──────────────────────────────────────────

describe("parsePointsConfig", () => {
  it("parses valid points config", () => {
    const config = {
      pointsPerVisit: 10,
      catalog: [
        { id: "item-1", name: "Free Coffee", pointsCost: 50 },
        { id: "item-2", name: "Free Meal", description: "Any entrée", pointsCost: 100 },
      ],
    }
    const result = parsePointsConfig(config)
    expect(result).not.toBeNull()
    expect(result!.pointsPerVisit).toBe(10)
    expect(result!.catalog).toHaveLength(2)
    expect(result!.catalog[0].name).toBe("Free Coffee")
  })

  it("returns null for null input", () => {
    expect(parsePointsConfig(null)).toBeNull()
  })

  it("returns null for empty object (missing required fields)", () => {
    expect(parsePointsConfig({})).toBeNull()
  })

  it("returns null for missing catalog", () => {
    expect(parsePointsConfig({ pointsPerVisit: 10 })).toBeNull()
  })

  it("returns null for empty catalog", () => {
    expect(parsePointsConfig({ pointsPerVisit: 10, catalog: [] })).toBeNull()
  })

  it("rejects pointsPerVisit > 100", () => {
    const config = {
      pointsPerVisit: 200,
      catalog: [{ id: "1", name: "Item", pointsCost: 50 }],
    }
    expect(parsePointsConfig(config)).toBeNull()
  })
})

describe("pointsConfigSchema", () => {
  it("validates correct config", () => {
    const result = pointsConfigSchema.safeParse({
      pointsPerVisit: 5,
      catalog: [{ id: "a", name: "Coffee", pointsCost: 25 }],
    })
    expect(result.success).toBe(true)
  })

  it("rejects zero pointsPerVisit", () => {
    const result = pointsConfigSchema.safeParse({
      pointsPerVisit: 0,
      catalog: [{ id: "a", name: "Coffee", pointsCost: 25 }],
    })
    expect(result.success).toBe(false)
  })
})

describe("getCheapestCatalogItem", () => {
  it("returns the cheapest item", () => {
    const config = {
      pointsPerVisit: 10,
      catalog: [
        { id: "a", name: "Expensive", pointsCost: 100 },
        { id: "b", name: "Cheap", pointsCost: 25 },
        { id: "c", name: "Medium", pointsCost: 50 },
      ],
    }
    const cheapest = getCheapestCatalogItem(config)
    expect(cheapest).not.toBeNull()
    expect(cheapest!.name).toBe("Cheap")
    expect(cheapest!.pointsCost).toBe(25)
  })
})

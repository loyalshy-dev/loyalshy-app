import { describe, it, expect } from "vitest"
import { hexToPasskitRgb, blendColors, getPassColors } from "./colors"

describe("hexToPasskitRgb", () => {
  it("converts black hex to rgb", () => {
    expect(hexToPasskitRgb("#000000")).toBe("rgb(0, 0, 0)")
  })

  it("converts white hex to rgb", () => {
    expect(hexToPasskitRgb("#ffffff")).toBe("rgb(255, 255, 255)")
  })

  it("converts a brand color hex to rgb", () => {
    expect(hexToPasskitRgb("#1a1a2e")).toBe("rgb(26, 26, 46)")
  })

  it("converts red hex to rgb", () => {
    expect(hexToPasskitRgb("#ff0000")).toBe("rgb(255, 0, 0)")
  })

  it("handles hex without # prefix", () => {
    expect(hexToPasskitRgb("ff8800")).toBe("rgb(255, 136, 0)")
  })

  it("handles uppercase hex", () => {
    expect(hexToPasskitRgb("#AABB00")).toBe("rgb(170, 187, 0)")
  })
})

describe("blendColors", () => {
  it("returns first color at ratio 0", () => {
    expect(blendColors("#ff0000", "#0000ff", 0)).toBe("#ff0000")
  })

  it("returns second color at ratio 1", () => {
    expect(blendColors("#ff0000", "#0000ff", 1)).toBe("#0000ff")
  })

  it("returns midpoint at ratio 0.5", () => {
    expect(blendColors("#000000", "#ffffff", 0.5)).toBe("#808080")
  })
})

describe("getPassColors", () => {
  it("uses provided brand and secondary colors", () => {
    const result = getPassColors("#ff0000", "#00ff00")
    expect(result.backgroundColor).toBe("rgb(255, 0, 0)")
    expect(result.foregroundColor).toBe("rgb(0, 255, 0)")
  })

  it("uses default dark background when brandColor is null", () => {
    const result = getPassColors(null, "#ffffff")
    expect(result.backgroundColor).toBe("rgb(26, 26, 46)")
  })

  it("uses default white foreground when secondaryColor is null", () => {
    const result = getPassColors("#ff0000", null)
    expect(result.foregroundColor).toBe("rgb(255, 255, 255)")
  })

  it("uses all defaults when both colors are null", () => {
    const result = getPassColors(null, null)
    expect(result.backgroundColor).toBe("rgb(26, 26, 46)")
    expect(result.foregroundColor).toBe("rgb(255, 255, 255)")
  })

  it("labelColor is dimmed 30% toward background for visual hierarchy", () => {
    // fg=#00ff00, bg=#ff0000 → labelColor = blend(#00ff00, #ff0000, 0.3)
    // R: 0*(0.7) + 255*(0.3) = 77, G: 255*(0.7) + 0*(0.3) = 179, B: 0
    const result = getPassColors("#ff0000", "#00ff00")
    expect(result.labelColor).toBe("rgb(77, 179, 0)")
  })

  it("labelColor differs from foregroundColor", () => {
    const result = getPassColors("#123456", "#abcdef")
    expect(result.labelColor).not.toBe(result.foregroundColor)
  })
})

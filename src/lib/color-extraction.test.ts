import { describe, it, expect } from "vitest"
import { rgbToHsl, rgbToLab, deltaE, hexToRgb, rgbToHex, extractPaletteFromBuffer } from "./color-extraction"
import sharp from "sharp"

// ─── Unit Tests: Color Helpers ────────────────────────────────

describe("rgbToHex", () => {
  it("converts RGB to hex", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000")
    expect(rgbToHex(0, 255, 0)).toBe("#00ff00")
    expect(rgbToHex(0, 0, 255)).toBe("#0000ff")
    expect(rgbToHex(51, 65, 85)).toBe("#334155")
  })
})

describe("hexToRgb", () => {
  it("converts hex to RGB tuple", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0])
    expect(hexToRgb("#334155")).toEqual([51, 65, 85])
    expect(hexToRgb("00ff00")).toEqual([0, 255, 0])
  })
})

describe("rgbToHsl", () => {
  it("converts pure red", () => {
    const [h, s, l] = rgbToHsl(255, 0, 0)
    expect(h).toBeCloseTo(0)
    expect(s).toBeCloseTo(1)
    expect(l).toBeCloseTo(0.5)
  })

  it("converts gray (zero saturation)", () => {
    const [h, s, l] = rgbToHsl(128, 128, 128)
    expect(s).toBeCloseTo(0)
    expect(l).toBeCloseTo(0.502, 1)
    expect(h).toBe(0) // achromatic
  })

  it("converts pure white", () => {
    const [, s, l] = rgbToHsl(255, 255, 255)
    expect(s).toBe(0)
    expect(l).toBe(1)
  })
})

describe("rgbToLab", () => {
  it("converts black to ~(0, 0, 0)", () => {
    const [L] = rgbToLab(0, 0, 0)
    expect(L).toBeCloseTo(0, 0)
  })

  it("converts white to ~(100, 0, 0)", () => {
    const [L, a, b] = rgbToLab(255, 255, 255)
    expect(L).toBeCloseTo(100, 0)
    expect(a).toBeCloseTo(0, 0)
    expect(b).toBeCloseTo(0, 0)
  })
})

describe("deltaE", () => {
  it("returns 0 for identical colors", () => {
    expect(deltaE([255, 0, 0], [255, 0, 0])).toBe(0)
  })

  it("returns a large value for very different colors", () => {
    const d = deltaE([255, 0, 0], [0, 0, 255])
    expect(d).toBeGreaterThan(50)
  })

  it("returns a small value for similar colors", () => {
    const d = deltaE([100, 100, 100], [105, 100, 100])
    expect(d).toBeLessThan(5)
  })
})

// ─── Integration Tests: Palette Extraction ────────────────────

describe("extractPaletteFromBuffer", () => {
  it("extracts palette from a vibrant red image", async () => {
    // Create a 50x50 solid red image
    const buf = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } },
    }).png().toBuffer()

    const palette = await extractPaletteFromBuffer(buf)
    expect(palette.colors.length).toBeGreaterThan(0)
    expect(palette.primarySuggestion).toMatch(/^#[0-9a-f]{6}$/)
    expect(palette.secondarySuggestion).toMatch(/^#[0-9a-f]{6}$/)
    expect(palette.textColor).toMatch(/^#[0-9a-f]{6}$/)
    expect(palette.isMonochrome).toBe(false)
  })

  it("detects monochrome for a gray image", async () => {
    const buf = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } },
    }).png().toBuffer()

    const palette = await extractPaletteFromBuffer(buf)
    expect(palette.isMonochrome).toBe(true)
  })

  it("returns fallback for a mostly transparent image", async () => {
    const buf = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer()

    const palette = await extractPaletteFromBuffer(buf)
    // Should get the fallback palette
    expect(palette.primarySuggestion).toBe("#334155")
    expect(palette.isMonochrome).toBe(true)
  })

  it("handles a multi-color image", async () => {
    // Create a 50x50 image with 2 colors split horizontally
    const width = 50
    const height = 50
    const channels = 4
    const pixels = Buffer.alloc(width * height * channels)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels
        if (y < height / 2) {
          // Top half: blue
          pixels[idx] = 30
          pixels[idx + 1] = 60
          pixels[idx + 2] = 200
        } else {
          // Bottom half: orange
          pixels[idx] = 220
          pixels[idx + 1] = 140
          pixels[idx + 2] = 30
        }
        pixels[idx + 3] = 255 // alpha
      }
    }

    const buf = await sharp(pixels, {
      raw: { width, height, channels },
    }).png().toBuffer()

    const palette = await extractPaletteFromBuffer(buf)
    expect(palette.colors.length).toBeGreaterThanOrEqual(2)
    expect(palette.isMonochrome).toBe(false)
    // Primary and secondary should be different
    expect(palette.primarySuggestion).not.toBe(palette.secondarySuggestion)
  })

  it("darkens primary if it's too bright", async () => {
    // Create a very light pastel image (HSL lightness > 0.7)
    const buf = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 220, g: 230, b: 180, alpha: 1 } },
    }).png().toBuffer()

    const palette = await extractPaletteFromBuffer(buf)
    // The primary suggestion should be darkened (not as light as the input)
    const rgb = hexToRgb(palette.primarySuggestion)
    // At least one channel should be reduced from the original values
    expect(rgb[0]).toBeLessThanOrEqual(220)
    expect(rgb[1]).toBeLessThanOrEqual(230)
  })
})

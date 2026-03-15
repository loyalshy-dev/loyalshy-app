import sharp from "sharp"
import { computeTextColor } from "@/lib/wallet/card-design"

// ─── Types ──────────────────────────────────────────────────

export type ExtractedColor = {
  hex: string
  rgb: [number, number, number]
  percentage: number
}

export type PaletteVariation = {
  id: string
  label: string
  primaryColor: string
  secondaryColor: string
  textColor: string
  labelColor: string
}

export type ExtractedPalette = {
  colors: ExtractedColor[]
  primarySuggestion: string
  secondarySuggestion: string
  textColor: string
  labelColor: string
  /** Detected solid background color of the logo, or null if transparent */
  logoBgColor: string | null
  variations: PaletteVariation[]
  isMonochrome: boolean
}

// ─── Color Space Helpers ────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return [h * 360, s, l]
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB → XYZ (D65)
  let rr = r / 255
  let gg = g / 255
  let bb = b / 255
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92
  let x = (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) / 0.95047
  let y = rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750
  let z = (rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  x = f(x)
  y = f(y)
  z = f(z)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

/** CIE76 Delta-E (perceptual color distance) */
function deltaE(
  rgb1: [number, number, number],
  rgb2: [number, number, number]
): number {
  const lab1 = rgbToLab(...rgb1)
  const lab2 = rgbToLab(...rgb2)
  return Math.sqrt(
    (lab1[0] - lab2[0]) ** 2 +
    (lab1[1] - lab2[1]) ** 2 +
    (lab1[2] - lab2[2]) ** 2
  )
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "")
  return [
    parseInt(cleaned.substring(0, 2), 16),
    parseInt(cleaned.substring(2, 4), 16),
    parseInt(cleaned.substring(4, 6), 16),
  ]
}

// ─── Seeded PRNG (mulberry32) ───────────────────────────────

/** Fast 32-bit seeded PRNG. Returns values in [0, 1). */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Derive a seed from pixel data so identical images produce identical palettes. */
function pixelSeed(pixels: Pixel[]): number {
  let h = 0
  const step = Math.max(1, Math.floor(pixels.length / 64))
  for (let i = 0; i < pixels.length; i += step) {
    h = ((h << 5) - h + pixels[i][0]) | 0
    h = ((h << 5) - h + pixels[i][1]) | 0
    h = ((h << 5) - h + pixels[i][2]) | 0
  }
  return h
}

// ─── K-Means Clustering ─────────────────────────────────────

type Pixel = [number, number, number]

function kMeansClustering(
  pixels: Pixel[],
  k: number,
  maxIterations: number = 20
): { centroid: Pixel; count: number }[] {
  if (pixels.length === 0) return []
  if (pixels.length <= k) {
    return pixels.map((p) => ({ centroid: [...p] as Pixel, count: 1 }))
  }

  // Seeded PRNG for reproducible results
  const rand = mulberry32(pixelSeed(pixels))

  // k-means++ initialization
  const centroids: Pixel[] = []
  centroids.push([...pixels[Math.floor(rand() * pixels.length)]])

  for (let i = 1; i < k; i++) {
    const distances = pixels.map((p) => {
      const minDist = Math.min(
        ...centroids.map(
          (c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
        )
      )
      return minDist
    })
    const total = distances.reduce((a, b) => a + b, 0)
    if (total === 0) {
      centroids.push([...pixels[Math.floor(rand() * pixels.length)]])
      continue
    }
    // Prevent floating-point overshoot by clamping r slightly below total
    let r = rand() * total * 0.9999
    let picked = false
    for (let j = 0; j < distances.length; j++) {
      r -= distances[j]
      if (r <= 0) {
        centroids.push([...pixels[j]])
        picked = true
        break
      }
    }
    // Deterministic fallback: pick the last pixel if draw loop exhausted
    if (!picked) {
      centroids.push([...pixels[pixels.length - 1]])
    }
  }

  // Iterate
  const assignments = new Uint16Array(pixels.length)

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false

    // Assign pixels to nearest centroid
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity
      let minIdx = 0
      for (let j = 0; j < centroids.length; j++) {
        const d =
          (pixels[i][0] - centroids[j][0]) ** 2 +
          (pixels[i][1] - centroids[j][1]) ** 2 +
          (pixels[i][2] - centroids[j][2]) ** 2
        if (d < minDist) {
          minDist = d
          minIdx = j
        }
      }
      if (assignments[i] !== minIdx) {
        assignments[i] = minIdx
        changed = true
      }
    }

    if (!changed) break

    // Recompute centroids (skip empty clusters — leave at previous position)
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0] as [number, number, number, number])
    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i]
      sums[c][0] += pixels[i][0]
      sums[c][1] += pixels[i][1]
      sums[c][2] += pixels[i][2]
      sums[c][3]++
    }
    for (let j = 0; j < k; j++) {
      if (sums[j][3] > 0) {
        centroids[j] = [
          sums[j][0] / sums[j][3],
          sums[j][1] / sums[j][3],
          sums[j][2] / sums[j][3],
        ]
      }
    }
  }

  // Count per cluster and filter out empty clusters
  const counts = new Uint32Array(k)
  for (let i = 0; i < pixels.length; i++) {
    counts[assignments[i]]++
  }

  return centroids
    .map((centroid, i) => ({
      centroid: [Math.round(centroid[0]), Math.round(centroid[1]), Math.round(centroid[2])] as Pixel,
      count: counts[i],
    }))
    .filter((c) => c.count > 0)
}

// ─── Fallback Palette ───────────────────────────────────────

const FALLBACK_PALETTE: ExtractedPalette = {
  colors: [
    { hex: "#334155", rgb: [51, 65, 85], percentage: 100 },
  ],
  primarySuggestion: "#334155",
  secondarySuggestion: "#94a3b8",
  textColor: "#ffffff",
  labelColor: "#b3bcc9",
  logoBgColor: null,
  variations: [],
  isMonochrome: true,
}

// ─── Main Extraction ────────────────────────────────────────

export async function extractPaletteFromBuffer(
  buffer: Buffer
): Promise<ExtractedPalette> {
  // Resize to 50x50 — use "inside" to preserve all logo regions (no cropping)
  const { data, info } = await sharp(buffer)
    .resize(50, 50, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels: Pixel[] = []
  const totalPixels = info.width * info.height
  const { width, height } = info

  // Collect edge pixels separately to detect logo background color
  const edgePixels: Pixel[] = []
  let edgeTransparentCount = 0
  let edgeTotalCount = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      const isEdge = y === 0 || y === height - 1 || x === 0 || x === width - 1
      if (isEdge) {
        edgeTotalCount++
        if (a < 128) {
          edgeTransparentCount++
        } else {
          edgePixels.push([r, g, b])
        }
      }

      // Filter out transparent pixels
      if (a < 128) continue
      // Filter out near-white
      if (r > 240 && g > 240 && b > 240) continue
      // Filter out near-black
      if (r < 15 && g < 15 && b < 15) continue

      pixels.push([r, g, b])
    }
  }

  // Detect solid logo background: if most edge pixels are opaque and similar color
  let logoBgHex: string | null = null
  const edgeHasTransparentBg = edgeTotalCount > 0 && edgeTransparentCount / edgeTotalCount > 0.5
  if (!edgeHasTransparentBg && edgePixels.length >= 4) {
    // Find median edge color
    const edgeClusters = kMeansClustering(edgePixels, 2, 10)
    if (edgeClusters.length > 0) {
      edgeClusters.sort((a, b) => b.count - a.count)
      const dominantEdge = edgeClusters[0]
      // If 60%+ of edge pixels match the dominant color, it's a solid background
      if (dominantEdge.count / edgePixels.length >= 0.6) {
        logoBgHex = rgbToHex(...dominantEdge.centroid)
      }
    }
  }

  // Edge case: >90% transparent or filtered out
  if (pixels.length < totalPixels * 0.1) {
    return FALLBACK_PALETTE
  }

  // Run k-means
  const clusters = kMeansClustering(pixels, 5, 20)
  if (clusters.length === 0) return FALLBACK_PALETTE

  // Sort by pixel count (most dominant first)
  clusters.sort((a, b) => b.count - a.count)

  const totalCounted = clusters.reduce((s, c) => s + c.count, 0)

  // Check monochrome: all clusters have low saturation (threshold 0.15 for subtle tints)
  const isMonochrome = clusters.every((c) => {
    const [, s] = rgbToHsl(...c.centroid)
    return s < 0.15
  })

  // Pick brand color: highest saturation with moderate lightness (0.15–0.75)
  // This is the logo's most vibrant color — used as secondary/accent, NOT background
  let brandIdx = 0
  let bestSat = -1
  for (let i = 0; i < clusters.length; i++) {
    const [, s, l] = rgbToHsl(...clusters[i].centroid)
    if (l >= 0.15 && l <= 0.75 && s > bestSat) {
      bestSat = s
      brandIdx = i
    }
  }
  if (bestSat < 0) brandIdx = 0

  const brandHex = rgbToHex(...clusters[brandIdx].centroid)

  // Build colors array
  const colors: ExtractedColor[] = clusters.map((c) => ({
    hex: rgbToHex(...c.centroid),
    rgb: c.centroid,
    percentage: Math.round((c.count / totalCounted) * 100),
  }))

  // Primary (background): darken the brand color significantly so the logo
  // stands out against it. Reduce lightness to 0.15–0.25 range, keep hue.
  const [brandH, brandS] = rgbToHsl(...clusters[brandIdx].centroid)
  const primaryHex = isMonochrome
    ? hslToHex(0, 0, 0.12) // near-black for monochrome logos
    : hslToHex(brandH, Math.min(brandS, 0.6), 0.18)

  // Secondary (accent): the logo's actual vibrant color
  let secondaryHex = brandHex

  // If brand color is too dark, brighten it for use as accent
  const [, , brandL] = rgbToHsl(...hexToRgb(brandHex))
  if (brandL < 0.3) {
    secondaryHex = hslToHex(brandH, Math.min(brandS + 0.1, 1), 0.55)
  }

  // Single-color logo: derive secondary by shifting hue
  if (clusters.length === 1) {
    const [h, s, l] = rgbToHsl(...hexToRgb(brandHex))
    const newH = (h + 30) % 360
    secondaryHex = hslToHex(newH, Math.min(s + 0.1, 1), Math.min(l + 0.15, 0.7))
  }

  const textColor = computeTextColor(primaryHex)
  const labelColor = blendLabel(textColor, primaryHex)

  // ── Generate palette variations ──────────────────────────
  const variations = buildVariations(brandHex, brandH, brandS, isMonochrome, logoBgHex)

  return {
    colors,
    primarySuggestion: logoBgHex ?? primaryHex,
    secondarySuggestion: secondaryHex,
    textColor: computeTextColor(logoBgHex ?? primaryHex),
    labelColor: blendLabel(computeTextColor(logoBgHex ?? primaryHex), logoBgHex ?? primaryHex),
    logoBgColor: logoBgHex,
    variations,
    isMonochrome,
  }
}

/** Blend text color 30% toward background for softer labels */
function blendLabel(text: string, bg: string): string {
  const t = hexToRgb(text)
  const b = hexToRgb(bg)
  return rgbToHex(
    Math.round(t[0] * 0.7 + b[0] * 0.3),
    Math.round(t[1] * 0.7 + b[1] * 0.3),
    Math.round(t[2] * 0.7 + b[2] * 0.3),
  )
}

/** Build palette variations from the extracted brand color */
function buildVariations(
  brandHex: string,
  brandH: number,
  brandS: number,
  isMonochrome: boolean,
  logoBgHex: string | null,
): PaletteVariation[] {
  const variations: PaletteVariation[] = []

  // 0. Brand — uses logo's actual background color (only when detected)
  if (logoBgHex) {
    const bgText = computeTextColor(logoBgHex)
    const [bgH, bgS] = rgbToHsl(...hexToRgb(logoBgHex))
    const bgSecondary = isMonochrome
      ? hslToHex(0, 0, 0.55)
      : hslToHex(bgH, Math.min(bgS + 0.15, 1), 0.55)
    variations.push({
      id: "brand",
      label: "Brand",
      primaryColor: logoBgHex,
      secondaryColor: bgSecondary,
      textColor: bgText,
      labelColor: blendLabel(bgText, logoBgHex),
    })
  }

  // 1. Dark — dark bg derived from brand hue, vibrant accent
  const darkBg = isMonochrome
    ? hslToHex(0, 0, 0.12)
    : hslToHex(brandH, Math.min(brandS, 0.6), 0.18)
  const darkText = computeTextColor(darkBg)
  const darkSecondary = isMonochrome
    ? hslToHex(0, 0, 0.55)
    : hslToHex(brandH, Math.min(brandS + 0.1, 1), 0.55)
  variations.push({
    id: "dark",
    label: "Dark",
    primaryColor: darkBg,
    secondaryColor: darkSecondary,
    textColor: darkText,
    labelColor: blendLabel(darkText, darkBg),
  })

  // 2. Light — off-white bg, brand as accent
  const lightBg = isMonochrome
    ? "#f8f9fa"
    : hslToHex(brandH, 0.08, 0.97)
  const lightText = computeTextColor(lightBg)
  const lightSecondary = isMonochrome
    ? hslToHex(0, 0, 0.4)
    : hslToHex(brandH, Math.min(brandS, 0.8), 0.45)
  variations.push({
    id: "light",
    label: "Light",
    primaryColor: lightBg,
    secondaryColor: lightSecondary,
    textColor: lightText,
    labelColor: blendLabel(lightText, lightBg),
  })

  // 3. Vibrant — brand color as bg, contrasting text
  const vibrantBg = isMonochrome
    ? hslToHex(0, 0, 0.3)
    : hslToHex(brandH, Math.min(brandS, 0.85), 0.42)
  const vibrantText = computeTextColor(vibrantBg)
  const vibrantSecondary = isMonochrome
    ? hslToHex(0, 0, 0.75)
    : hslToHex((brandH + 30) % 360, Math.min(brandS, 0.7), 0.65)
  variations.push({
    id: "vibrant",
    label: "Vibrant",
    primaryColor: vibrantBg,
    secondaryColor: vibrantSecondary,
    textColor: vibrantText,
    labelColor: blendLabel(vibrantText, vibrantBg),
  })

  // 4. Muted — desaturated bg, subtle accent
  const mutedBg = isMonochrome
    ? hslToHex(0, 0, 0.2)
    : hslToHex(brandH, 0.15, 0.22)
  const mutedText = computeTextColor(mutedBg)
  const mutedSecondary = isMonochrome
    ? hslToHex(0, 0, 0.5)
    : hslToHex(brandH, 0.25, 0.5)
  variations.push({
    id: "muted",
    label: "Muted",
    primaryColor: mutedBg,
    secondaryColor: mutedSecondary,
    textColor: mutedText,
    labelColor: blendLabel(mutedText, mutedBg),
  })

  return variations
}

// ─── HSL → Hex ──────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l)
  return rgbToHex(r, g, b)
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

// ─── Exports for testing / template-matcher ─────────────────

export { rgbToHsl, rgbToLab, deltaE, hexToRgb, rgbToHex }

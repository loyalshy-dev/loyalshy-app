import "server-only"

import sharp from "sharp"
import { readFile } from "fs/promises"
import { join } from "path"
import type { PatternStyle } from "./card-design"
import type { TemplateStripDesign } from "./card-templates"

// ─── Dimensions ─────────────────────────────────────────────

export const APPLE_STRIP_WIDTH = 1125
export const APPLE_STRIP_HEIGHT = 432
export const GOOGLE_HERO_WIDTH = 1032
export const GOOGLE_HERO_HEIGHT = 336

// ─── Auto-Generated Strip Images ────────────────────────────

/**
 * Generates a strip/hero image as a PNG buffer using Sharp's SVG rendering.
 * Uses SVG overlays for pattern rendering (no Satori dependency needed).
 */
export async function generateStripImage({
  primaryColor,
  secondaryColor,
  patternStyle,
  width,
  height,
}: {
  primaryColor: string
  secondaryColor: string
  patternStyle: PatternStyle
  width: number
  height: number
}): Promise<Buffer> {
  const svgContent = buildPatternSvg(primaryColor, secondaryColor, patternStyle, width, height)

  return sharp(Buffer.from(svgContent))
    .resize(width, height)
    .png()
    .toBuffer()
}

function buildPatternSvg(
  primary: string,
  secondary: string,
  pattern: PatternStyle,
  w: number,
  h: number
): string {
  // Flat solid colors — no gradient, no pattern overlay
  if (pattern === "SOLID_PRIMARY") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${primary}" />
</svg>`
  }
  if (pattern === "SOLID_SECONDARY") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${secondary}" />
</svg>`
  }

  const patternMarkup = getPatternMarkup(secondary, pattern, w, h)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primary}" />
      <stop offset="100%" stop-color="${shiftColor(primary, 20)}" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)" />
  ${patternMarkup}
</svg>`
}

function getPatternMarkup(
  secondary: string,
  pattern: PatternStyle,
  w: number,
  h: number
): string {
  switch (pattern) {
    case "DOTS": {
      const spacing = 40
      const dots: string[] = []
      for (let x = spacing; x < w; x += spacing) {
        for (let y = spacing; y < h; y += spacing) {
          const opacity = 0.08 + Math.random() * 0.12
          const r = 4 + Math.random() * 4
          dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${secondary}" opacity="${opacity.toFixed(2)}" />`)
        }
      }
      return dots.join("\n  ")
    }
    case "WAVES": {
      const paths: string[] = []
      for (let i = 0; i < 5; i++) {
        const y = (h / 6) * (i + 1)
        const opacity = 0.06 + i * 0.03
        paths.push(
          `<path d="M0,${y} Q${w * 0.25},${y - 30} ${w * 0.5},${y} T${w},${y}" fill="none" stroke="${secondary}" stroke-width="2" opacity="${opacity.toFixed(2)}" />`
        )
      }
      return paths.join("\n  ")
    }
    case "GEOMETRIC": {
      const lines: string[] = []
      const spacing = 50
      for (let i = -h; i < w + h; i += spacing) {
        const opacity = 0.06 + (Math.abs(i % 100) / 100) * 0.08
        lines.push(
          `<line x1="${i}" y1="0" x2="${i + h}" y2="${h}" stroke="${secondary}" stroke-width="1.5" opacity="${opacity.toFixed(2)}" />`
        )
      }
      return lines.join("\n  ")
    }
    case "CHEVRON": {
      const lines: string[] = []
      const spacing = 40
      for (let y = spacing; y < h + spacing; y += spacing) {
        const opacity = 0.08 + (y % 80 === 0 ? 0.06 : 0)
        lines.push(
          `<polyline points="0,${y} ${w * 0.5},${y - spacing * 0.6} ${w},${y}" fill="none" stroke="${secondary}" stroke-width="2" opacity="${opacity.toFixed(2)}" />`
        )
      }
      return lines.join("\n  ")
    }
    case "CROSSHATCH": {
      const lines: string[] = []
      const spacing = 30
      for (let i = -h; i < w + h; i += spacing) {
        const opacity = 0.07 + (Math.abs(i % 60) / 60) * 0.06
        lines.push(
          `<line x1="${i}" y1="0" x2="${i + h}" y2="${h}" stroke="${secondary}" stroke-width="1" opacity="${opacity.toFixed(2)}" />`
        )
        lines.push(
          `<line x1="${i}" y1="0" x2="${i - h}" y2="${h}" stroke="${secondary}" stroke-width="1" opacity="${opacity.toFixed(2)}" />`
        )
      }
      return lines.join("\n  ")
    }
    case "DIAMONDS": {
      const elements: string[] = []
      const size = 20
      const spacingX = 50
      const spacingY = 50
      for (let x = spacingX / 2; x < w; x += spacingX) {
        for (let y = spacingY / 2; y < h; y += spacingY) {
          const opacity = 0.06 + ((x + y) % 100 / 100) * 0.08
          elements.push(
            `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" transform="rotate(45,${x},${y})" fill="none" stroke="${secondary}" stroke-width="1.5" opacity="${opacity.toFixed(2)}" />`
          )
        }
      }
      return elements.join("\n  ")
    }
    case "CONFETTI": {
      const elements: string[] = []
      // Deterministic pseudo-random scatter using simple LCG
      let seed = 42
      function nextRand() {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }
      const count = Math.floor((w * h) / 3000)
      for (let i = 0; i < count; i++) {
        const x = nextRand() * w
        const y = nextRand() * h
        const rotation = nextRand() * 360
        const opacity = 0.06 + nextRand() * 0.1
        const size = 4 + nextRand() * 6
        if (i % 3 === 0) {
          elements.push(
            `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(size / 2).toFixed(1)}" fill="${secondary}" opacity="${opacity.toFixed(2)}" />`
          )
        } else {
          elements.push(
            `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${(size * 0.5).toFixed(1)}" transform="rotate(${rotation.toFixed(0)},${x.toFixed(1)},${y.toFixed(1)})" fill="${secondary}" opacity="${opacity.toFixed(2)}" />`
          )
        }
      }
      return elements.join("\n  ")
    }
    case "NONE":
    default:
      return ""
  }
}

/** Shift a hex color slightly for gradient variation */
function shiftColor(hex: string, amount: number): string {
  const cleaned = hex.replace("#", "")
  const r = Math.min(255, parseInt(cleaned.substring(0, 2), 16) + amount)
  const g = Math.min(255, parseInt(cleaned.substring(2, 4), 16) + amount)
  const b = Math.min(255, parseInt(cleaned.substring(4, 6), 16) + amount)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

// ─── Uploaded Image Cropping ────────────────────────────────

/** Crop/resize an image buffer to the target dimensions using cover fit */
export async function cropStripImage(
  buffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer()
}

/** Process an uploaded strip image into Apple and Google crops */
export async function processUploadedStripImage(
  originalBuffer: Buffer
): Promise<{ appleBuffer: Buffer; googleBuffer: Buffer }> {
  const [appleBuffer, googleBuffer] = await Promise.all([
    cropStripImage(originalBuffer, APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT),
    cropStripImage(originalBuffer, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT),
  ])
  return { appleBuffer, googleBuffer }
}

// ─── Template Strip Image Generation ────────────────────────

function buildGradientSvg(
  stops: Array<{ color: string; position: number }>,
  angle: number,
  w: number,
  h: number
): string {
  // Convert angle to SVG gradient coordinates
  const rad = (angle * Math.PI) / 180
  const x1 = 50 - Math.cos(rad) * 50
  const y1 = 50 - Math.sin(rad) * 50
  const x2 = 50 + Math.cos(rad) * 50
  const y2 = 50 + Math.sin(rad) * 50

  const stopMarkup = stops
    .map((s) => `<stop offset="${s.position}%" stop-color="${s.color}" />`)
    .join("\n      ")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
        ${stopMarkup}
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)" />
  </svg>`
}

/**
 * Generate a strip image from a template strip design definition.
 * Returns a PNG buffer at the specified dimensions.
 */
export async function generateTemplateStripImage(
  stripDesign: TemplateStripDesign,
  width: number,
  height: number,
  fallbackPrimary?: string,
  fallbackSecondary?: string
): Promise<Buffer | null> {
  switch (stripDesign.type) {
    case "gradient": {
      const svg = buildGradientSvg(stripDesign.stops, stripDesign.angle, width, height)
      return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer()
    }

    case "pattern": {
      return generateStripImage({
        primaryColor: fallbackPrimary ?? "#1a1a2e",
        secondaryColor: stripDesign.color,
        patternStyle: stripDesign.patternStyle,
        width,
        height,
      })
    }

    case "image": {
      // Read bundled image from public/templates/
      const suffix = width === APPLE_STRIP_WIDTH ? "apple" : "google"
      const filePath = join(process.cwd(), "public", `${stripDesign.assetPath}-${suffix}.jpg`)
      const buffer = await readFile(filePath)
      return sharp(buffer).resize(width, height, { fit: "cover", position: "centre" }).png().toBuffer()
    }

    case "none":
      return null
  }
}

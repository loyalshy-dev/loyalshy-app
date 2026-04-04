import "server-only"

import sharp from "sharp"
import type { PatternStyle, ProgressStyle, StampGridConfig } from "./card-design"
import { formatProgressValue } from "./card-design"
import { getStampIconPaths, getRewardIconPaths } from "./stamp-icons"

// ─── Font-free SVG text rendering ───────────────────────────
// Sharp/librsvg on serverless (Vercel) often has no fonts installed,
// so <text> elements render blank. These helpers draw glyphs as pure
// <path> elements — zero font dependency.

/** SVG path data for digits 0-9, designed for a 0 0 10 14 viewBox */
const DIGIT_PATHS: Record<string, string> = {
  "0": "M5 1C2.8 1 1 3.1 1 5.8v2.4C1 10.9 2.8 13 5 13s4-2.1 4-4.8V5.8C9 3.1 7.2 1 5 1zm0 2c1.1 0 2 1.2 2 2.8v2.4C7 9.8 6.1 11 5 11S3 9.8 3 8.2V5.8C3 4.2 3.9 3 5 3z",
  "1": "M4 1L2 3v1h2v7H2v2h6v-2H6V1z",
  "2": "M1.5 4.5C1.5 2.6 3 1 5 1s3.5 1.6 3.5 3.5c0 1.2-.5 2.1-1.5 3L3 11h5.5v2h-7v-2l5-5c.6-.6.9-1.2.9-1.8C7.4 3.3 6.4 2.6 5 2.6S2.8 3.5 2.8 4.5z",
  "3": "M2 1h6l-3 4.5c1.7.2 3 1.6 3 3.5 0 2-1.6 3.5-3.5 3.5C2.8 12.5 1.2 11.2 1 9.5h2c.2.8.8 1.4 1.5 1.4.9 0 1.5-.7 1.5-1.5s-.7-1.5-1.5-1.5H3.2L3 7l2.5-4H2z",
  "4": "M6 1L1 8.5V10h5v3h2v-3h1.5V8H8V1zm0 3v4H3.2z",
  "5": "M2 1h6v2H3.5L3 5.5c.5-.3 1.2-.5 2-.5 2 0 3.5 1.3 3.5 3.5S7 12 5 12C3 12 1.5 10.8 1 9h2c.3.7 1 1.2 2 1.2 1.1 0 2-.8 2-1.8s-.8-1.8-2-1.8c-.7 0-1.3.3-1.6.7L1.5 7z",
  "6": "M5.5 1L2 6.5C1.4 7.2 1 8.1 1 9c0 2.2 1.8 4 4 4s4-1.8 4-4-1.8-4-4-4c-.7 0-1.4.2-2 .5L5.5 1zM5 7c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z",
  "7": "M1 1h8v1.5L5 13H3l4-9.5H1z",
  "8": "M5 1C3.1 1 1.5 2.3 1.5 4c0 1 .5 1.9 1.3 2.5C1.7 7.2 1 8.2 1 9.5 1 11.4 2.8 13 5 13s4-1.6 4-3.5c0-1.3-.7-2.3-1.8-3C8 5.9 8.5 5 8.5 4 8.5 2.3 6.9 1 5 1zm0 2c.8 0 1.5.6 1.5 1.3S5.8 5.5 5 5.5 3.5 5 3.5 4.3 4.2 3 5 3zm0 4.5c1 0 2 .7 2 1.7S6 11 5 11s-2-.7-2-1.7.9-1.8 2-1.8z",
  "9": "M5 1C2.8 1 1 2.8 1 5s1.8 4 4 4c.7 0 1.4-.2 2-.5L4.5 13h2.2L9 7.5C9.6 6.8 10 5.9 10 5c0-2.2-1.8-4-4-4zM5 3c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z",
}

/** Render a number (1-99) as SVG paths, centered at (cx, cy) with given height */
function renderNumberSvg(n: number, cx: number, cy: number, height: number, fill: string, opacity: number): string {
  const str = String(n)
  const charW = height * (10 / 14) // aspect ratio of the 10x14 viewBox
  const gap = height * 0.05
  const totalW = str.length * charW + (str.length - 1) * gap
  let x = cx - totalW / 2

  const parts: string[] = []
  for (const ch of str) {
    const d = DIGIT_PATHS[ch]
    if (d) {
      parts.push(`<path d="${d}" transform="translate(${x},${cy - height / 2}) scale(${charW / 10},${height / 14})" fill="${fill}" opacity="${opacity}" />`)
    }
    x += charW + gap
  }
  return parts.join("")
}

/** Render a checkmark as SVG path, centered at (cx, cy) with given size */
function renderCheckmarkSvg(cx: number, cy: number, size: number, fill: string): string {
  // Simple checkmark polyline rendered as a filled path
  const half = size / 2
  const sw = size * 0.15 // stroke width
  return `<polyline points="${cx - half},${cy} ${cx - half * 0.3},${cy + half * 0.6} ${cx + half},${cy - half * 0.5}" fill="none" stroke="${fill}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`
}

// ─── Dimensions ─────────────────────────────────────────────

export const APPLE_STRIP_WIDTH = 1125
// Apple storeCard spec: 375x123pt → 1125x369 @3x. We use 432 (coupon size).
// Apple crops to fill — extra height gets trimmed. Changing would break
// stamp grid aspect ratios and invalidate all cached Blob strip images.
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
  originalBuffer: Buffer,
  position?: { x: number; y: number },
  zoom?: number
): Promise<{ appleBuffer: Buffer; googleBuffer: Buffer }> {
  const hasCustomCrop = position || (zoom && zoom !== 1)
  const cropFn = hasCustomCrop
    ? (w: number, h: number) => cropStripImageWithPosition(originalBuffer, w, h, position ?? { x: 0.5, y: 0.5 }, zoom ?? 1)
    : (w: number, h: number) => cropStripImage(originalBuffer, w, h)

  const [appleBuffer, googleBuffer] = await Promise.all([
    cropFn(APPLE_STRIP_WIDTH, APPLE_STRIP_HEIGHT),
    cropFn(GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT),
  ])
  return { appleBuffer, googleBuffer }
}

/** Crop/resize an image buffer with custom position and zoom */
export async function cropStripImageWithPosition(
  buffer: Buffer,
  targetW: number,
  targetH: number,
  position: { x: number; y: number },
  zoom: number
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata()
  const imgW = meta.width ?? targetW
  const imgH = meta.height ?? targetH

  // Cover-fit scale * zoom
  const scale = Math.max(targetW / imgW, targetH / imgH) * Math.max(1, zoom)
  const scaledW = Math.round(imgW * scale)
  const scaledH = Math.round(imgH * scale)

  // Position-based extract window
  const left = Math.round(Math.max(0, (scaledW - targetW) * Math.max(0, Math.min(1, position.x))))
  const top = Math.round(Math.max(0, (scaledH - targetH) * Math.max(0, Math.min(1, position.y))))

  return sharp(buffer)
    .resize(scaledW, scaledH)
    .extract({ left, top, width: targetW, height: targetH })
    .png()
    .toBuffer()
}

// ─── Remote Image Loading ──────────────────────────────────────

/** Fetch a remote image URL and return it as a Buffer */
async function loadRemoteImage(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Resize a strip image to target dimensions, applying position and zoom.
 * Position (0–1, 0–1) controls the focal point for cover-cropping.
 * Zoom (>1) scales the image up before cropping, making the subject larger.
 */
export async function resizeStripImage(
  buffer: Buffer,
  width: number,
  height: number,
  position?: { x: number; y: number },
  zoom?: number
): Promise<Buffer> {
  const pos = position ?? { x: 0.5, y: 0.5 }
  const z = Math.max(0.5, Math.min(3, zoom ?? 1))

  // Get source dimensions to compute proper extract region
  const meta = await sharp(buffer).metadata()
  const srcW = meta.width ?? width
  const srcH = meta.height ?? height

  // Target aspect ratio
  const targetAspect = width / height

  // Calculate the crop region on the source image
  // First determine the "cover" region, then apply zoom (zoom > 1 = tighter crop)
  let cropW: number
  let cropH: number
  const srcAspect = srcW / srcH
  if (srcAspect > targetAspect) {
    // Source is wider — crop width
    cropH = srcH
    cropW = Math.round(srcH * targetAspect)
  } else {
    // Source is taller — crop height
    cropW = srcW
    cropH = Math.round(srcW / targetAspect)
  }

  // Apply zoom: shrink the crop region (zooms in)
  cropW = Math.round(cropW / z)
  cropH = Math.round(cropH / z)
  // Clamp to source bounds
  cropW = Math.min(cropW, srcW)
  cropH = Math.min(cropH, srcH)

  // Position the crop region using the focal point
  const maxLeft = srcW - cropW
  const maxTop = srcH - cropH
  const left = Math.round(maxLeft * pos.x)
  const top = Math.round(maxTop * pos.y)

  return sharp(buffer)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(width, height)
    .png()
    .toBuffer()
}

/** Reduce the alpha channel of an image by a factor (0–1) to simulate opacity */
async function reduceAlpha(buffer: Buffer, opacity: number, w: number, h: number): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .resize(w, h, { fit: "cover", position: "centre" })
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * opacity)
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer()
}

/** Convert an image buffer to a base64 data URI for SVG embedding */
async function imageToDataUri(buffer: Buffer, contentType = "image/png"): Promise<string> {
  // Normalize to PNG via sharp for consistent SVG embedding
  const pngBuffer = await sharp(buffer).png().toBuffer()
  return `data:${contentType};base64,${pngBuffer.toString("base64")}`
}

// ─── Stamp Grid Image Generation ─────────────────────────────

/** Compute optimal grid layout for the stamp slots */
function computeGridLayout(
  totalSlots: number,
  width: number,
  height: number
): { rows: number; cols: number; slotSize: number; offsetX: number; offsetY: number; gap: number } {
  // Find the best rows × cols arrangement that fits the aspect ratio
  const aspect = width / height
  let bestRows = 1
  let bestCols = totalSlots

  for (let r = 1; r <= totalSlots; r++) {
    const c = Math.ceil(totalSlots / r)
    const gridAspect = c / r
    if (Math.abs(gridAspect - aspect) < Math.abs(bestCols / bestRows - aspect)) {
      bestRows = r
      bestCols = c
    }
  }

  const gap = Math.min(width, height) * 0.03
  const maxSlotW = (width - gap * (bestCols + 1)) / bestCols
  const maxSlotH = (height - gap * (bestRows + 1)) / bestRows
  const slotSize = Math.floor(Math.min(maxSlotW, maxSlotH))

  const totalW = bestCols * slotSize + (bestCols - 1) * gap
  const totalH = bestRows * slotSize + (bestRows - 1) * gap
  const offsetX = Math.floor((width - totalW) / 2)
  const offsetY = Math.floor((height - totalH) / 2)

  return { rows: bestRows, cols: bestCols, slotSize, offsetX, offsetY, gap }
}

/** Build SVG for a single stamp slot */
function buildStampSlotSvg(opts: {
  x: number
  y: number
  size: number
  slotIndex: number
  currentVisits: number
  totalSlots: number
  isRewardSlot: boolean
  hasReward: boolean
  iconSvgPaths: string
  rewardIcon: string
  stampShape: StampGridConfig["stampShape"]
  filledStyle: StampGridConfig["filledStyle"]
  stampIconScale: number
  primaryColor: string
  secondaryColor: string
  textColor: string
  customStampIconDataUri?: string
  customRewardIconDataUri?: string
  customEmptyIconDataUri?: string
  useUniformIcon?: boolean
  stampIcon?: string
  emptyNumberColor?: string | null
  emptyNumberScale?: number
  emptySlotOpacity?: number
  emptySlotColor?: string | null
  emptySlotBg?: string | null
  rewardSlotColor?: string | null
  rewardSlotBg?: string | null
  rewardFilledStyle?: StampGridConfig["filledStyle"]
}): string {
  const { x, y, size, slotIndex, currentVisits, isRewardSlot, hasReward, iconSvgPaths, rewardIcon, stampShape, filledStyle, stampIconScale, primaryColor, secondaryColor, textColor, customStampIconDataUri, customRewardIconDataUri, customEmptyIconDataUri, useUniformIcon, stampIcon } = opts
  const isFilled = hasReward || slotIndex < currentVisits
  const cx = x + size / 2
  const cy = y + size / 2
  const padding = size * 0.08
  const innerSize = size - padding * 2

  // Shape clip path
  const clipId = `clip-${slotIndex}`
  let clipPath: string
  let shapeBorder: string

  switch (stampShape) {
    case "square":
      clipPath = `<clipPath id="${clipId}"><rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" /></clipPath>`
      shapeBorder = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" fill="none" stroke="${secondaryColor}" stroke-width="2" opacity="0.4" />`
      break
    case "rounded-square":
      clipPath = `<clipPath id="${clipId}"><rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" /></clipPath>`
      shapeBorder = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="none" stroke="${secondaryColor}" stroke-width="2" opacity="0.4" />`
      break
    case "circle":
    default:
      clipPath = `<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" /></clipPath>`
      shapeBorder = `<circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="none" stroke="${secondaryColor}" stroke-width="2" opacity="0.4" />`
      break
  }

  // Reward slot
  if (isRewardSlot) {
    const rewardFilled = hasReward || isFilled
    const rBg = opts.rewardSlotBg === "transparent" ? "none" : (opts.rewardSlotBg ?? secondaryColor)
    const rStroke = opts.rewardSlotColor ?? primaryColor
    const emptyOpacity = opts.emptySlotOpacity ?? 0.35
    const iconPad = innerSize * (1 - stampIconScale) / 2
    const iconSize = innerSize * stampIconScale

    if (rewardFilled) {
      // Filled reward slot — uses its own filledStyle (falls back to stamp filledStyle)
      const rStyle = opts.rewardFilledStyle ?? filledStyle
      if (rStyle === "solid") {
        let solidShape: string
        switch (stampShape) {
          case "square":
            solidShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" fill="${rBg}" />`
            break
          case "rounded-square":
            solidShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="${rBg}" />`
            break
          case "circle":
          default:
            solidShape = `<circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="${rBg}" />`
            break
        }
        const checkSize = innerSize * 0.35
        return `<g>${solidShape}${renderCheckmarkSvg(cx, cy, checkSize, rStroke)}</g>`
      }

      // icon or icon-with-border
      let shapeBg: string
      switch (stampShape) {
        case "square":
          shapeBg = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" fill="${rBg}" />`
          break
        case "rounded-square":
          shapeBg = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="${rBg}" />`
          break
        case "circle":
        default:
          shapeBg = `<circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="${rBg}" />`
          break
      }
      let rewardIconContent: string
      if (customRewardIconDataUri) {
        rewardIconContent = `<image href="${customRewardIconDataUri}" x="${x + padding + iconPad}" y="${y + padding + iconPad}" width="${iconSize}" height="${iconSize}" clip-path="url(#${clipId})" />`
      } else {
        const rewardIconPaths = useUniformIcon && stampIcon ? getStampIconPaths(stampIcon) : getRewardIconPaths(rewardIcon)
        rewardIconContent = `<svg x="${x + padding + iconPad}" y="${y + padding + iconPad}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${rStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${rewardIconPaths}</svg>`
      }
      let content = `${clipPath}<g clip-path="url(#${clipId})">${shapeBg}${rewardIconContent}</g>`
      if (rStyle === "icon-with-border") {
        content += shapeBorder.replace('opacity="0.4"', 'opacity="0.7"')
      }
      return `<g>${content}</g>`
    }

    // Empty reward slot — matches empty slot style with reward icon
    const emptyBg = opts.rewardSlotBg === "transparent" ? "none" : (opts.rewardSlotBg ?? `${primaryColor}25`)
    let emptyShape: string
    switch (stampShape) {
      case "square":
        emptyShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" fill="${emptyBg}" opacity="${emptyOpacity}" />`
        break
      case "rounded-square":
        emptyShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="${emptyBg}" opacity="${emptyOpacity}" />`
        break
      case "circle":
      default:
        emptyShape = `<circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="${emptyBg}" opacity="${emptyOpacity}" />`
        break
    }
    let rewardIconContent: string
    if (customRewardIconDataUri) {
      rewardIconContent = `<image href="${customRewardIconDataUri}" x="${x + padding + iconPad}" y="${y + padding + iconPad}" width="${iconSize}" height="${iconSize}" opacity="${emptyOpacity}" clip-path="url(#${clipId})" />`
    } else {
      const rewardIconPaths = useUniformIcon && stampIcon ? getStampIconPaths(stampIcon) : getRewardIconPaths(rewardIcon)
      rewardIconContent = `<svg x="${x + padding + iconPad}" y="${y + padding + iconPad}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${opts.rewardSlotColor ?? textColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${emptyOpacity}">${rewardIconPaths}</svg>`
    }
    return `<g>${clipPath}${emptyShape}${rewardIconContent}</g>`
  }

  // Filled stamp
  if (isFilled) {
    let fillContent: string

    if (filledStyle === "solid") {
      // Solid colored shape
      let solidShape: string
      switch (stampShape) {
        case "square":
          solidShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" fill="${secondaryColor}" />`
          break
        case "rounded-square":
          solidShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="${secondaryColor}" />`
          break
        case "circle":
        default:
          solidShape = `<circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="${secondaryColor}" />`
          break
      }
      const checkSize = innerSize * 0.35
      fillContent = `${solidShape}${renderCheckmarkSvg(cx, cy, checkSize, primaryColor)}`
    } else {
      // icon or icon-with-border — render shape bg + icon (custom image or Lucide SVG)
      let shapeBg: string
      const iconPad = innerSize * (1 - stampIconScale) / 2
      const iconSize = innerSize * stampIconScale
      switch (stampShape) {
        case "square":
          shapeBg = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" fill="${secondaryColor}" />`
          break
        case "rounded-square":
          shapeBg = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="${secondaryColor}" />`
          break
        case "circle":
        default:
          shapeBg = `<circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="${secondaryColor}" />`
          break
      }
      const iconContent = customStampIconDataUri
        ? `<image href="${customStampIconDataUri}" x="${x + padding + iconPad}" y="${y + padding + iconPad}" width="${iconSize}" height="${iconSize}" clip-path="url(#${clipId})" />`
        : `<svg x="${x + padding + iconPad}" y="${y + padding + iconPad}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconSvgPaths}</svg>`
      fillContent = `${clipPath}<g clip-path="url(#${clipId})">${shapeBg}${iconContent}</g>`
      if (filledStyle === "icon-with-border") {
        fillContent += shapeBorder.replace('opacity="0.4"', 'opacity="0.7"')
      }
    }
    return `<g>${fillContent}</g>`
  }

  // Empty stamp — shape outline with visit number
  const emptyNumScale = opts.emptyNumberScale ?? 0.35
  const emptyNumColor = opts.emptyNumberColor ?? textColor
  const emptyOpacity = opts.emptySlotOpacity ?? 0.35
  const emptyBg = opts.emptySlotBg === "transparent" ? "none" : (opts.emptySlotBg ?? `${primaryColor}25`)
  const emptyIconStroke = opts.emptySlotColor ?? textColor
  const numSize = innerSize * emptyNumScale
  let emptyShape: string
  switch (stampShape) {
    case "square":
      emptyShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" fill="${emptyBg}" stroke="${secondaryColor}" stroke-width="1.5" stroke-dasharray="4,3" opacity="${emptyOpacity}" />`
      break
    case "rounded-square":
      emptyShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="${emptyBg}" stroke="${secondaryColor}" stroke-width="1.5" stroke-dasharray="4,3" opacity="${emptyOpacity}" />`
      break
    case "circle":
    default:
      emptyShape = `<circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="${emptyBg}" stroke="${secondaryColor}" stroke-width="1.5" stroke-dasharray="4,3" opacity="${emptyOpacity}" />`
      break
  }

  if (customEmptyIconDataUri) {
    const iconPad = innerSize * (1 - stampIconScale) / 2
    const iconSize = innerSize * stampIconScale
    return `<g>${clipPath}${emptyShape}<image href="${customEmptyIconDataUri}" x="${x + padding + iconPad}" y="${y + padding + iconPad}" width="${iconSize}" height="${iconSize}" opacity="${emptyOpacity}" clip-path="url(#${clipId})" /></g>`
  }
  if (useUniformIcon && stampIcon) {
    const iconPad = innerSize * (1 - stampIconScale) / 2
    const iconSize = innerSize * stampIconScale
    const uniformPaths = getStampIconPaths(stampIcon)
    return `<g>${clipPath}${emptyShape}<svg x="${x + padding + iconPad}" y="${y + padding + iconPad}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${emptyIconStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${emptyOpacity}">${uniformPaths}</svg></g>`
  }
  return `<g>${emptyShape}${renderNumberSvg(slotIndex + 1, cx, cy, numSize, emptyNumColor, 0.5)}</g>`
}

/** Generate a stamp grid strip/hero image as a PNG buffer */
export async function generateStampGridImage(opts: {
  currentVisits: number
  totalVisits: number
  hasReward: boolean
  config: StampGridConfig
  primaryColor: string
  secondaryColor: string
  textColor: string
  width: number
  height: number
  stripImageUrl?: string | null
  stripOpacity?: number
  stripGrayscale?: boolean
  stripImagePosition?: { x: number; y: number }
  stripImageZoom?: number
}): Promise<Buffer> {
  const { currentVisits, totalVisits, hasReward, config, primaryColor, secondaryColor, textColor, width, height, stripImageUrl, stripOpacity = 1, stripGrayscale = false, stripImagePosition, stripImageZoom } = opts

  // Total slots = totalVisits (last slot is the reward slot)
  const totalSlots = totalVisits
  const layout = computeGridLayout(totalSlots, width, height)

  // Get the Lucide SVG paths for the stamp icon
  const iconSvgPaths = getStampIconPaths(config.stampIcon)

  // Load custom icons as data URIs if provided
  let customStampIconDataUri: string | undefined
  let customRewardIconDataUri: string | undefined
  let customEmptyIconDataUri: string | undefined
  const loadIcon = async (url: string | null | undefined) => {
    if (!url) return undefined
    try {
      const buf = await loadRemoteImage(url)
      return await imageToDataUri(buf)
    } catch { return undefined }
  }
  ;[customStampIconDataUri, customRewardIconDataUri, customEmptyIconDataUri] = await Promise.all([
    loadIcon(config.customStampIconUrl),
    loadIcon(config.useUniformIcon ? config.customStampIconUrl : config.customRewardIconUrl),
    loadIcon(config.useUniformIcon ? config.customStampIconUrl : config.customEmptyIconUrl),
  ])

  // Use strip image as background?
  const useStripBg = !!stripImageUrl

  // Build all stamp slot SVGs
  const slots: string[] = []
  for (let row = 0; row < layout.rows; row++) {
    // Number of items in this row (last row may have fewer)
    const rowStart = row * layout.cols
    const itemsInRow = Math.min(layout.cols, totalSlots - rowStart)
    // Center partial rows by adding extra horizontal offset
    const rowWidth = itemsInRow * layout.slotSize + (itemsInRow - 1) * layout.gap
    const fullRowWidth = layout.cols * layout.slotSize + (layout.cols - 1) * layout.gap
    const rowOffsetX = layout.offsetX + Math.floor((fullRowWidth - rowWidth) / 2)

    for (let col = 0; col < itemsInRow; col++) {
      const slotIndex = rowStart + col

      const x = rowOffsetX + col * (layout.slotSize + layout.gap)
      const y = layout.offsetY + row * (layout.slotSize + layout.gap)

      const isRewardSlot = slotIndex === totalVisits - 1

      slots.push(
        buildStampSlotSvg({
          x,
          y,
          size: layout.slotSize,
          slotIndex,
          currentVisits,
          totalSlots,
          isRewardSlot,
          hasReward,
          iconSvgPaths,
          rewardIcon: config.rewardIcon,
          stampShape: config.stampShape,
          filledStyle: config.filledStyle,
          stampIconScale: config.stampIconScale ?? 0.6,
          primaryColor,
          secondaryColor,
          textColor,
          customStampIconDataUri,
          customRewardIconDataUri,
          customEmptyIconDataUri,
          useUniformIcon: config.useUniformIcon,
          stampIcon: config.stampIcon,
          emptyNumberColor: config.emptyNumberColor,
          emptyNumberScale: config.emptyNumberScale,
          emptySlotOpacity: config.emptySlotOpacity,
          emptySlotColor: config.emptySlotColor,
          emptySlotBg: config.emptySlotBg,
          rewardSlotColor: config.rewardSlotColor,
          rewardSlotBg: config.rewardSlotBg,
          rewardFilledStyle: config.rewardFilledStyle,
        })
      )
    }
  }

  if (useStripBg) {
    // Composite: strip image background + semi-transparent overlay + stamp grid
    const stripBuffer = await loadRemoteImage(stripImageUrl)
    let resizedStrip = await resizeStripImage(stripBuffer, width, height, stripImagePosition, stripImageZoom)
    if (stripGrayscale) {
      resizedStrip = await sharp(resizedStrip).greyscale().png().toBuffer()
    }

    // Build stamp grid SVG with transparent background + dark overlay
    const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="rgba(0,0,0,0.35)" />
  ${slots.join("\n  ")}
</svg>`

    const overlayBuffer = await sharp(Buffer.from(overlaySvg))
      .resize(width, height)
      .png()
      .toBuffer()

    // Apply opacity: reduce strip alpha then composite over primary color background
    if (stripOpacity < 1) {
      const transparentStrip = await reduceAlpha(resizedStrip, stripOpacity, width, height)
      const baseBg = await sharp({
        create: { width, height, channels: 4, background: primaryColor },
      }).png().toBuffer()

      return sharp(baseBg)
        .composite([
          { input: transparentStrip },
          { input: overlayBuffer },
        ])
        .png()
        .toBuffer()
    }

    return sharp(resizedStrip)
      .composite([{ input: overlayBuffer }])
      .png()
      .toBuffer()
  }

  // Default: gradient background
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="${shiftColor(primaryColor, 15)}" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  ${slots.join("\n  ")}
</svg>`

  return sharp(Buffer.from(svg))
    .resize(width, height)
    .png()
    .toBuffer()
}

// ─── Progress Text Strip Image Generation ─────────────────────

/** Generate a strip image with progress text (numbers, circles, squares, etc.) baked in */
export async function generateProgressStripImage(opts: {
  currentVisits: number
  totalVisits: number
  hasReward: boolean
  progressStyle: ProgressStyle
  progressLabel: string
  primaryColor: string
  secondaryColor: string
  textColor: string
  labelColor: string
  width: number
  height: number
  stripImageUrl?: string | null
  stripOpacity?: number
  stripGrayscale?: boolean
  stripImagePosition?: { x: number; y: number }
  stripImageZoom?: number
}): Promise<Buffer> {
  const {
    currentVisits, totalVisits, hasReward, progressStyle, progressLabel,
    primaryColor, secondaryColor, textColor, labelColor,
    width, height, stripImageUrl, stripOpacity = 1, stripGrayscale = false,
    stripImagePosition, stripImageZoom,
  } = opts

  const progressValue = formatProgressValue(currentVisits, totalVisits, progressStyle, hasReward)

  // Font sizes relative to strip dimensions
  const labelFontSize = Math.round(height * 0.09)
  const valueFontSize = progressStyle === "NUMBERS" || progressStyle === "PERCENTAGE" || progressStyle === "REMAINING"
    ? Math.round(height * 0.28)
    : Math.round(height * 0.22) // Symbol styles need less height
  const cx = Math.round(width / 2)
  const cy = Math.round(height / 2)

  // Escape XML entities
  const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  // Progress overlay uses <text> (handles letters, Unicode symbols, etc.)
  // The stamp grid numbers use path-based rendering instead (see buildStampSlotSvg)
  const textSvg = `
    <text x="${cx}" y="${cy - valueFontSize * 0.15}" text-anchor="middle" dy="0.35em"
      font-family="sans-serif" font-size="${valueFontSize}" font-weight="700"
      fill="${textColor}" opacity="0.95">${escapeXml(progressValue)}</text>
    <text x="${cx}" y="${cy - valueFontSize * 0.7 - labelFontSize * 0.4}" text-anchor="middle" dy="0.35em"
      font-family="sans-serif" font-size="${labelFontSize}" font-weight="700"
      fill="${labelColor}" opacity="0.85"
      letter-spacing="0.06em">${escapeXml(progressLabel)}</text>`

  const useStripBg = !!stripImageUrl

  if (useStripBg) {
    const stripBuffer = await loadRemoteImage(stripImageUrl)
    let resizedStrip = await resizeStripImage(stripBuffer, width, height, stripImagePosition, stripImageZoom)
    if (stripGrayscale) {
      resizedStrip = await sharp(resizedStrip).greyscale().png().toBuffer()
    }

    const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="rgba(0,0,0,0.3)" />
  ${textSvg}
</svg>`

    const overlayBuffer = await sharp(Buffer.from(overlaySvg))
      .resize(width, height)
      .png()
      .toBuffer()

    if (stripOpacity < 1) {
      const transparentStrip = await reduceAlpha(resizedStrip, stripOpacity, width, height)
      const baseBg = await sharp({
        create: { width, height, channels: 4, background: primaryColor },
      }).png().toBuffer()

      return sharp(baseBg)
        .composite([
          { input: transparentStrip },
          { input: overlayBuffer },
        ])
        .png()
        .toBuffer()
    }

    return sharp(resizedStrip)
      .composite([{ input: overlayBuffer }])
      .png()
      .toBuffer()
  }

  // Default: gradient background with text
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="${shiftColor(primaryColor, 15)}" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  ${textSvg}
</svg>`

  return sharp(Buffer.from(svg))
    .resize(width, height)
    .png()
    .toBuffer()
}


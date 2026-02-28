import "server-only"

import sharp from "sharp"
import type { PatternStyle, StampGridConfig } from "./card-design"
import { getStampIconPaths, getRewardIconPaths } from "./stamp-icons"

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
}): string {
  const { x, y, size, slotIndex, currentVisits, isRewardSlot, hasReward, iconSvgPaths, rewardIcon, stampShape, filledStyle, stampIconScale, primaryColor, secondaryColor, textColor, customStampIconDataUri } = opts
  const isFilled = slotIndex < currentVisits
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
    const isFilled = slotIndex < currentVisits
    const rewardFilled = hasReward || isFilled
    const rewardBorderColor = hasReward ? "#d4a017" : secondaryColor
    const rewardBorderOpacity = rewardFilled ? "0.7" : "0.3"
    const rewardBorderWidth = hasReward ? "3" : "2"
    const bgFill = hasReward ? `${rewardBorderColor}20` : rewardFilled ? secondaryColor : `${primaryColor}60`

    // Determine the shape border for reward
    let rewardShape: string
    switch (stampShape) {
      case "square":
        rewardShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" fill="${bgFill}" stroke="${rewardBorderColor}" stroke-width="${rewardBorderWidth}" opacity="${rewardBorderOpacity}" />`
        break
      case "rounded-square":
        rewardShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="${bgFill}" stroke="${rewardBorderColor}" stroke-width="${rewardBorderWidth}" opacity="${rewardBorderOpacity}" />`
        break
      case "circle":
      default:
        rewardShape = `<circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="${bgFill}" stroke="${rewardBorderColor}" stroke-width="${rewardBorderWidth}" opacity="${rewardBorderOpacity}" />`
        break
    }

    const rewardIconPaths = getRewardIconPaths(rewardIcon)
    const iconPad = innerSize * (1 - stampIconScale) / 2
    const iconSize = innerSize * stampIconScale
    const strokeColor = rewardFilled ? primaryColor : textColor
    const iconOpacity = rewardFilled ? "1" : "0.5"
    const rewardSvgIcon = `<svg x="${x + padding + iconPad}" y="${y + padding + iconPad}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${iconOpacity}">${rewardIconPaths}</svg>`
    return `<g>${rewardShape}${rewardSvgIcon}</g>`
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
      fillContent = `${solidShape}<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${checkSize}" fill="${primaryColor}" font-weight="bold">\u2713</text>`
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
  const numSize = innerSize * 0.35
  let emptyShape: string
  switch (stampShape) {
    case "square":
      emptyShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" fill="${primaryColor}40" stroke="${secondaryColor}" stroke-width="1.5" opacity="0.35" />`
      break
    case "rounded-square":
      emptyShape = `<rect x="${x + padding}" y="${y + padding}" width="${innerSize}" height="${innerSize}" rx="${innerSize * 0.15}" fill="${primaryColor}40" stroke="${secondaryColor}" stroke-width="1.5" opacity="0.35" />`
      break
    case "circle":
    default:
      emptyShape = `<circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="${primaryColor}40" stroke="${secondaryColor}" stroke-width="1.5" opacity="0.35" />`
      break
  }

  return `<g>${emptyShape}<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${numSize}" font-family="system-ui, sans-serif" font-weight="500" fill="${textColor}" opacity="0.5">${slotIndex + 1}</text></g>`
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
}): Promise<Buffer> {
  const { currentVisits, totalVisits, hasReward, config, primaryColor, secondaryColor, textColor, width, height, stripImageUrl, stripOpacity = 1, stripGrayscale = false } = opts

  // Total slots = totalVisits (last slot is the reward slot)
  const totalSlots = totalVisits
  const layout = computeGridLayout(totalSlots, width, height)

  // Get the Lucide SVG paths for the stamp icon
  const iconSvgPaths = getStampIconPaths(config.stampIcon)

  // Load custom stamp icon as data URI if provided
  let customStampIconDataUri: string | undefined
  if (config.customStampIconUrl) {
    try {
      const iconBuffer = await loadRemoteImage(config.customStampIconUrl)
      customStampIconDataUri = await imageToDataUri(iconBuffer)
    } catch {
      // Fall back to Lucide icon if custom icon fetch fails
    }
  }

  // Use strip image as background?
  const useStripBg = !!stripImageUrl

  // Build all stamp slot SVGs
  const slots: string[] = []
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const slotIndex = row * layout.cols + col
      if (slotIndex >= totalSlots) break

      const x = layout.offsetX + col * (layout.slotSize + layout.gap)
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
        })
      )
    }
  }

  if (useStripBg) {
    // Composite: strip image background + semi-transparent overlay + stamp grid
    const stripBuffer = await loadRemoteImage(stripImageUrl)
    let stripPipeline = sharp(stripBuffer)
      .resize(width, height, { fit: "cover", position: "centre" })
    if (stripGrayscale) {
      stripPipeline = stripPipeline.greyscale()
    }
    const resizedStrip = await stripPipeline.toBuffer()

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


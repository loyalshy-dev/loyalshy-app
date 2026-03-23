"use client"

import { useMemo } from "react"
import QRCode from "qrcode"

type StyledQrCodeProps = {
  value: string
  size?: number
  logoText?: string
  logoUrl?: string | null
  bgColor?: string
  fgColor?: string
  className?: string
}

export function StyledQrCode({
  value,
  size = 200,
  logoText,
  logoUrl,
  bgColor,
  fgColor,
  className,
}: StyledQrCodeProps) {
  const colors = bgColor || fgColor
    ? { bg: bgColor ?? "var(--foreground)", fg: fgColor ?? "#ffffff" }
    : undefined

  const svgContent = useMemo(() => {
    try {
      // Use "H" (30%) error correction to survive the center logo clearing
      const qr = QRCode.create(value, { errorCorrectionLevel: "H" })
      return renderStyledQr(qr.modules, size, logoText, colors, logoUrl ?? undefined)
    } catch {
      return null
    }
  }, [value, size, logoText, logoUrl, colors])

  if (!svgContent) return null

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}

/**
 * Parse a hex color (#rgb or #rrggbb) and return relative luminance (0–1).
 * Returns null for non-hex values (e.g. CSS variables).
 */
function hexLuminance(hex: string): number | null {
  const m = hex.match(/^#([0-9a-f]{3,8})$/i)
  if (!m) return null
  let r: number, g: number, b: number
  if (m[1].length === 3) {
    r = parseInt(m[1][0] + m[1][0], 16) / 255
    g = parseInt(m[1][1] + m[1][1], 16) / 255
    b = parseInt(m[1][2] + m[1][2], 16) / 255
  } else {
    r = parseInt(m[1].slice(0, 2), 16) / 255
    g = parseInt(m[1].slice(2, 4), 16) / 255
    b = parseInt(m[1].slice(4, 6), 16) / 255
  }
  // sRGB relative luminance
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

export function renderStyledQr(
  modules: { size: number; data: Uint8Array },
  size: number,
  logoText?: string,
  colors?: { bg: string; fg: string },
  logoUrl?: string
): string {
  let bg = colors?.bg ?? "var(--foreground)"
  let fg = colors?.fg ?? "var(--background)"

  // If background is very light, swap to dark dots so the QR stays visible
  const lum = hexLuminance(bg)
  if (lum !== null && lum > 0.7) {
    fg = "#1a1a2e"
  }

  const moduleCount = modules.size
  const padding = 2.5
  const totalModules = moduleCount + padding * 2
  const cellSize = size / totalModules
  const dotRadius = cellSize * 0.42
  const bgRadius = size * 0.06

  // Finder pattern positions (top-left corner of each 7x7 finder)
  const finders = [
    { x: 0, y: 0 },
    { x: moduleCount - 7, y: 0 },
    { x: 0, y: moduleCount - 7 },
  ]

  function isFinderModule(col: number, row: number): boolean {
    return finders.some(
      (f) => col >= f.x && col < f.x + 7 && row >= f.y && row < f.y + 7
    )
  }

  // Center logo area — keep small so we don't destroy too many data modules.
  // With error correction "H" we can lose ~30% of data, but smaller is safer.
  const centerModules = Math.ceil(moduleCount * 0.18)
  const centerStart = Math.floor((moduleCount - centerModules) / 2)
  const centerEnd = centerStart + centerModules

  function isCenterModule(col: number, row: number): boolean {
    return (
      col >= centerStart &&
      col < centerEnd &&
      row >= centerStart &&
      row < centerEnd
    )
  }

  // Build dots
  const dots: string[] = []
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (isFinderModule(col, row)) continue
      if (isCenterModule(col, row)) continue

      const isOn = modules.data[row * moduleCount + col] === 1
      if (!isOn) continue

      const cx = (col + padding + 0.5) * cellSize
      const cy = (row + padding + 0.5) * cellSize
      dots.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${dotRadius.toFixed(2)}" fill="${fg}"/>`)
    }
  }

  // Finder patterns — standard QR structure: 7×7 outer border, gap, 3×3 inner fill.
  // Rendered with rounded corners for the styled look while keeping scanner-compatible proportions.
  const finderSvgs = finders.map((f) => {
    const x = (f.x + padding) * cellSize
    const y = (f.y + padding) * cellSize
    const s = 7 * cellSize      // full 7-module finder size
    const r = cellSize * 0.8    // corner radius for rounded look

    // Outer ring: 7×7, 1-module-thick border
    const outerStroke = cellSize
    // Inner filled square: 3×3 centered
    const innerSize = 3 * cellSize
    const innerOffset = 2 * cellSize  // (7 - 3) / 2 = 2 modules inset
    const innerR = cellSize * 0.5

    return [
      // Outer rounded rect border (1-module stroke on a 7×7 area)
      `<rect x="${(x + outerStroke / 2).toFixed(2)}" y="${(y + outerStroke / 2).toFixed(2)}" width="${(s - outerStroke).toFixed(2)}" height="${(s - outerStroke).toFixed(2)}" rx="${r.toFixed(2)}" fill="none" stroke="${fg}" stroke-width="${outerStroke.toFixed(2)}"/>`,
      // Inner 3×3 filled rounded rect
      `<rect x="${(x + innerOffset).toFixed(2)}" y="${(y + innerOffset).toFixed(2)}" width="${innerSize.toFixed(2)}" height="${innerSize.toFixed(2)}" rx="${innerR.toFixed(2)}" fill="${fg}"/>`,
    ].join("")
  })

  // Center logo
  const centerX = size / 2
  const centerY = size / 2
  const logoBgRadius = centerModules * cellSize * 0.42

  let logoSvg = ""
  if (logoUrl) {
    // Image logo with circular clip
    const imgSize = logoBgRadius * 2
    const imgX = centerX - logoBgRadius
    const imgY = centerY - logoBgRadius
    logoSvg = [
      `<defs><clipPath id="logo-clip"><circle cx="${centerX.toFixed(2)}" cy="${centerY.toFixed(2)}" r="${logoBgRadius.toFixed(2)}"/></clipPath></defs>`,
      `<circle cx="${centerX.toFixed(2)}" cy="${centerY.toFixed(2)}" r="${(logoBgRadius + 1).toFixed(2)}" fill="${bg}"/>`,
      `<image href="${escapeXml(logoUrl)}" x="${imgX.toFixed(2)}" y="${imgY.toFixed(2)}" width="${imgSize.toFixed(2)}" height="${imgSize.toFixed(2)}" clip-path="url(#logo-clip)" preserveAspectRatio="xMidYMid slice"/>`,
    ].join("")
  } else if (logoText) {
    // Fallback: text logo (first letter)
    logoSvg = [
      `<circle cx="${centerX.toFixed(2)}" cy="${centerY.toFixed(2)}" r="${logoBgRadius.toFixed(2)}" fill="${bg}"/>`,
      `<text x="${centerX.toFixed(2)}" y="${(centerY + logoBgRadius * 0.35).toFixed(2)}" text-anchor="middle" fill="${fg}" font-size="${(logoBgRadius * 0.85).toFixed(2)}" font-weight="700" font-family="-apple-system, 'Segoe UI', system-ui, sans-serif">${escapeXml(logoText)}</text>`,
    ].join("")
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `<rect width="${size}" height="${size}" rx="${bgRadius.toFixed(2)}" fill="${bg}"/>`,
    ...dots,
    ...finderSvgs,
    logoSvg,
    `</svg>`,
  ].join("")
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

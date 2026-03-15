"use client"

import { useMemo } from "react"
import QRCode from "qrcode"

type StyledQrCodeProps = {
  value: string
  size?: number
  logoText?: string
  bgColor?: string
  fgColor?: string
  className?: string
}

export function StyledQrCode({
  value,
  size = 200,
  logoText,
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
      return renderStyledQr(qr.modules, size, logoText, colors)
    } catch {
      return null
    }
  }, [value, size, logoText, colors])

  if (!svgContent) return null

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}

export function renderStyledQr(
  modules: { size: number; data: Uint8Array },
  size: number,
  logoText?: string,
  colors?: { bg: string; fg: string }
): string {
  const bg = colors?.bg ?? "var(--foreground)"
  const fg = colors?.fg ?? "var(--background)"

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

  const logoSvg = logoText
    ? [
        `<circle cx="${centerX.toFixed(2)}" cy="${centerY.toFixed(2)}" r="${logoBgRadius.toFixed(2)}" fill="${bg}"/>`,
        `<text x="${centerX.toFixed(2)}" y="${(centerY + logoBgRadius * 0.35).toFixed(2)}" text-anchor="middle" fill="${fg}" font-size="${(logoBgRadius * 0.85).toFixed(2)}" font-weight="700" font-family="-apple-system, 'Segoe UI', system-ui, sans-serif">${escapeXml(logoText)}</text>`,
      ].join("")
    : ""

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

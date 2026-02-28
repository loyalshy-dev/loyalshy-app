/**
 * Color utilities for Apple Wallet passes.
 * PassKit requires colors in "rgb(R, G, B)" string format.
 */

/** Converts a hex color string to PassKit "rgb(R, G, B)" format */
export function hexToPasskitRgb(hex: string): string {
  const cleaned = hex.replace("#", "")
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

/** Linearly interpolates between two hex colors. ratio=0 → hex1, ratio=1 → hex2 */
export function blendColors(hex1: string, hex2: string, ratio: number): string {
  const c1 = hex1.replace("#", "")
  const c2 = hex2.replace("#", "")
  const r = Math.round(parseInt(c1.substring(0, 2), 16) * (1 - ratio) + parseInt(c2.substring(0, 2), 16) * ratio)
  const g = Math.round(parseInt(c1.substring(2, 4), 16) * (1 - ratio) + parseInt(c2.substring(2, 4), 16) * ratio)
  const b = Math.round(parseInt(c1.substring(4, 6), 16) * (1 - ratio) + parseInt(c2.substring(4, 6), 16) * ratio)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

/** Returns pass colors derived from restaurant brand colors */
export function getPassColors(
  brandColor: string | null,
  secondaryColor: string | null,
  textColor?: string | null
): {
  backgroundColor: string
  foregroundColor: string
  labelColor: string
} {
  const bg = brandColor ?? "#1a1a2e"
  const fg = textColor ?? secondaryColor ?? "#ffffff"

  // Dim labels 30% toward background for visual hierarchy (labels vs field values)
  const dimmedLabel = blendColors(fg, bg, 0.3)

  return {
    backgroundColor: hexToPasskitRgb(bg),
    foregroundColor: hexToPasskitRgb(fg),
    labelColor: hexToPasskitRgb(dimmedLabel),
  }
}

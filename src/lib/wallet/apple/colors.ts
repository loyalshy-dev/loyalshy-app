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

  return {
    backgroundColor: hexToPasskitRgb(bg),
    foregroundColor: hexToPasskitRgb(fg),
    labelColor: hexToPasskitRgb(fg),
  }
}

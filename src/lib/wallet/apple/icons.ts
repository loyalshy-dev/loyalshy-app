import "server-only"

// Minimal 1x1 transparent PNG as fallback (29 bytes)
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIABgABzQOQaAAAAABJRU5ErkJggg==",
  "base64"
)

type IconBuffers = Record<string, Buffer>

/**
 * Fetches the restaurant logo from a URL and returns icon buffers
 * for the Apple Wallet pass. Falls back to a minimal placeholder if
 * the logo is unavailable.
 *
 * Icon: Square center-crop — 29x29 (@1x), 58x58 (@2x), 87x87 (@3x)
 * Logo: Landscape — 160x50 (@1x), 320x100 (@2x), 480x150 (@3x)
 *
 * If a strip image URL is provided, it is fetched and included as
 * strip.png / strip@2x.png / strip@3x.png for storeCard type passes.
 */
export async function getIconBuffers(
  logoUrl: string | null,
  stripImageUrl?: string | null
): Promise<IconBuffers> {
  let rawLogoBuffer = PLACEHOLDER_PNG

  if (logoUrl) {
    try {
      const response = await fetch(logoUrl, {
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        rawLogoBuffer = Buffer.from(await response.arrayBuffer())
      }
    } catch {
      // Fall back to placeholder
    }
  }

  // Generate properly sized icon (square) and logo (landscape) variants
  let iconBuffers: { icon1x: Buffer; icon2x: Buffer; icon3x: Buffer }
  let logoBuffers: { logo1x: Buffer; logo2x: Buffer; logo3x: Buffer }

  try {
    const sharp = (await import("sharp")).default

    // Icon: square center-crop
    const [icon1x, icon2x, icon3x] = await Promise.all([
      sharp(rawLogoBuffer).resize(29, 29, { fit: "cover", position: "centre" }).png().toBuffer(),
      sharp(rawLogoBuffer).resize(58, 58, { fit: "cover", position: "centre" }).png().toBuffer(),
      sharp(rawLogoBuffer).resize(87, 87, { fit: "cover", position: "centre" }).png().toBuffer(),
    ])
    iconBuffers = { icon1x, icon2x, icon3x }

    // Logo: landscape contain (pad to fit)
    const [logo1x, logo2x, logo3x] = await Promise.all([
      sharp(rawLogoBuffer).resize(160, 50, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
      sharp(rawLogoBuffer).resize(320, 100, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
      sharp(rawLogoBuffer).resize(480, 150, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
    ])
    logoBuffers = { logo1x, logo2x, logo3x }
  } catch {
    // Sharp unavailable or processing failed — fall back to raw buffer for all slots
    iconBuffers = { icon1x: rawLogoBuffer, icon2x: rawLogoBuffer, icon3x: rawLogoBuffer }
    logoBuffers = { logo1x: rawLogoBuffer, logo2x: rawLogoBuffer, logo3x: rawLogoBuffer }
  }

  const buffers: IconBuffers = {
    "icon.png": iconBuffers.icon1x,
    "icon@2x.png": iconBuffers.icon2x,
    "icon@3x.png": iconBuffers.icon3x,
    "logo.png": logoBuffers.logo1x,
    "logo@2x.png": logoBuffers.logo2x,
    "logo@3x.png": logoBuffers.logo3x,
  }

  // Add strip image if provided
  if (stripImageUrl) {
    try {
      const response = await fetch(stripImageUrl, {
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) {
        const stripBuffer = Buffer.from(await response.arrayBuffer())
        buffers["strip.png"] = stripBuffer
        buffers["strip@2x.png"] = stripBuffer
        // Strip is typically generated at @3x width (1125px), so same buffer works
        buffers["strip@3x.png"] = stripBuffer
      }
    } catch {
      // Skip strip image if fetch fails
    }
  }

  return buffers
}

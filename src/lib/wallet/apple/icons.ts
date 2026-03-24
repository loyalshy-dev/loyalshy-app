import "server-only"

// Minimal 1x1 transparent PNG as fallback (29 bytes)
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIABgABzQOQaAAAAABJRU5ErkJggg==",
  "base64"
)

type IconBuffers = Record<string, Buffer>

/**
 * Fetches the organization logo from a URL and returns icon buffers
 * for the Apple Wallet pass. Falls back to a minimal placeholder if
 * the logo is unavailable.
 *
 * Icon: Square center-crop — 29x29 (@1x), 58x58 (@2x), 87x87 (@3x)
 * Logo: Landscape — 160x50 (@1x), 320x100 (@2x), 480x150 (@3x)
 *
 * If a strip image URL is provided, it is fetched and included as
 * strip.png / strip@2x.png / strip@3x.png for storeCard type passes.
 *
 * If a background image URL is provided (eventTicket passes), it is fetched
 * and included as background.png / background@2x.png / background@3x.png.
 * Apple automatically applies a blur effect to background images on iOS.
 *
 * Thumbnail: Portrait — 90x90 (@1x), 180x180 (@2x), 270x270 (@3x)
 * Used by generic pass type (MEMBERSHIP) instead of strip.
 * If thumbnailUrl is provided, it is fetched and included as thumbnail.png.
 */
export async function getIconBuffers(
  logoUrl: string | null,
  stripImageUrl?: string | null,
  logoZoom?: number,
  thumbnailUrl?: string | null,
  backgroundImageUrl?: string | null,
): Promise<IconBuffers> {
  const zoom = Math.max(0.5, Math.min(3, logoZoom ?? 1))
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

    // Logo: landscape contain (pad to fit), then apply zoom by scaling up and center-cropping
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
    const resizeLogo = async (w: number, h: number) => {
      if (zoom === 1) {
        return sharp(rawLogoBuffer).resize(w, h, { fit: "contain", background: transparent }).png().toBuffer()
      }
      // Scale up the logo within a larger canvas, then crop to target size
      const scaledW = Math.round(w * zoom)
      const scaledH = Math.round(h * zoom)
      const scaled = await sharp(rawLogoBuffer)
        .resize(scaledW, scaledH, { fit: "contain", background: transparent })
        .png()
        .toBuffer()
      return sharp(scaled)
        .extract({
          left: Math.round((scaledW - w) / 2),
          top: Math.round((scaledH - h) / 2),
          width: w,
          height: h,
        })
        .png()
        .toBuffer()
    }
    const [logo1x, logo2x, logo3x] = await Promise.all([
      resizeLogo(160, 50),
      resizeLogo(320, 100),
      resizeLogo(480, 150),
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

  // Add thumbnail image if provided
  // Apple Wallet generic passes display thumbnail on the right side of the pass front.
  if (thumbnailUrl) {
    try {
      const response = await fetch(thumbnailUrl, {
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) {
        const rawThumb = Buffer.from(await response.arrayBuffer())
        try {
          const sharp = (await import("sharp")).default
          const [thumb1x, thumb2x, thumb3x] = await Promise.all([
            sharp(rawThumb).resize(90, 90, { fit: "cover", position: "centre" }).png().toBuffer(),
            sharp(rawThumb).resize(180, 180, { fit: "cover", position: "centre" }).png().toBuffer(),
            sharp(rawThumb).resize(270, 270, { fit: "cover", position: "centre" }).png().toBuffer(),
          ])
          buffers["thumbnail.png"] = thumb1x
          buffers["thumbnail@2x.png"] = thumb2x
          buffers["thumbnail@3x.png"] = thumb3x
        } catch {
          buffers["thumbnail.png"] = rawThumb
          buffers["thumbnail@2x.png"] = rawThumb
          buffers["thumbnail@3x.png"] = rawThumb
        }
      }
    } catch {
      // Skip thumbnail if fetch fails
    }
  }

  // Add background image if provided (used by eventTicket pass type: TICKET)
  // Apple Wallet applies a Gaussian blur to background images automatically on iOS.
  if (backgroundImageUrl) {
    try {
      const response = await fetch(backgroundImageUrl, {
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) {
        const bgBuffer = Buffer.from(await response.arrayBuffer())
        buffers["background.png"] = bgBuffer
        buffers["background@2x.png"] = bgBuffer
        buffers["background@3x.png"] = bgBuffer
      }
    } catch {
      // Skip background image if fetch fails
    }
  }

  return buffers
}

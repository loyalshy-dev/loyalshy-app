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
 * If a strip image URL is provided, it is fetched and included as
 * strip.png / strip@2x.png for storeCard type passes.
 */
export async function getIconBuffers(
  logoUrl: string | null,
  stripImageUrl?: string | null
): Promise<IconBuffers> {
  let iconBuffer = PLACEHOLDER_PNG

  if (logoUrl) {
    try {
      const response = await fetch(logoUrl, {
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        iconBuffer = Buffer.from(await response.arrayBuffer())
      }
    } catch {
      // Fall back to placeholder
    }
  }

  const buffers: IconBuffers = {
    "icon.png": iconBuffer,
    "icon@2x.png": iconBuffer,
    "logo.png": iconBuffer,
    "logo@2x.png": iconBuffer,
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
      }
    } catch {
      // Skip strip image if fetch fails
    }
  }

  return buffers
}

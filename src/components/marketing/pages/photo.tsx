"use client"

import Image, { type ImageLoader } from "next/image"

// Placeholder photography (Unsplash) until the pages get their own
// pictures. One frame for all of them: a hairline, the paper's corner
// radius, Ash behind the image while it loads.
//
// Unsplash's CDN resizes and re-encodes on its own (`w`, `auto=format`), so
// the images bypass /_next/image through a custom loader: no second
// optimisation pass, no Vercel image quota, and no upstream-fetch timeout
// in dev. The srcset/`sizes` behaviour of next/image is kept.

export type AspectRatio = "4/3" | "3/2" | "16/9" | "1/1" | "4/5" | "21/9"

export function unsplashUrl(id: string, width = 1600, quality = 80) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=${quality}`
}

// No candidate above 2048 px (a 3840 one weighed ~870 KB), and photography
// at the big sizes takes a lower quality without showing it.
const MAX_WIDTH = 2048
const unsplashLoader: ImageLoader = ({ src, width, quality }) => {
  const w = Math.min(width, MAX_WIDTH)
  return unsplashUrl(src, w, quality ?? (w >= 1920 ? 70 : 80))
}

export function Photo({
  id,
  alt,
  ratio = "4/3",
  // The hero column is 560 px wide inside `.mk-wrap` on desktop.
  sizes = "(min-width: 1024px) 560px, 100vw",
  priority = false,
  className,
}: {
  id: string
  alt: string
  ratio?: AspectRatio
  sizes?: string
  priority?: boolean
  className?: string
}) {
  return (
    <div
      className={["relative w-full overflow-hidden rounded-2xl", className].filter(Boolean).join(" ")}
      style={{ aspectRatio: ratio, background: "var(--mk-surface)", border: "1px solid var(--mk-border)" }}
    >
      {/* `priority` only preloads; `fetchPriority` is what lifts the LCP request above the fonts and CSS */}
      <Image loader={unsplashLoader} src={id} alt={alt} fill sizes={sizes} priority={priority} fetchPriority={priority ? "high" : undefined} className="object-cover" />
    </div>
  )
}

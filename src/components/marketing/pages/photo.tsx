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

const unsplashLoader: ImageLoader = ({ src, width, quality }) => unsplashUrl(src, width, quality ?? 80)

export function Photo({
  id,
  alt,
  ratio = "4/3",
  sizes = "(min-width: 1024px) 48vw, 100vw",
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
      <Image loader={unsplashLoader} src={id} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  )
}

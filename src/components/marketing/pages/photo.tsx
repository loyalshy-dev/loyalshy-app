import Image from "next/image"

// Placeholder photography (Unsplash) until the pages get their own
// pictures. One frame for all of them: a hairline, the paper's corner
// radius, Ash behind the image while it loads.

export type AspectRatio = "4/3" | "3/2" | "16/9" | "1/1" | "4/5" | "21/9"

export function unsplashUrl(id: string, width = 1600) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`
}

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
      <Image src={unsplashUrl(id)} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  )
}

"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

type Platform = "apple" | "google"

const SOURCES: Record<Platform, { src: string; width: number; height: number }> = {
  apple: { src: "/try-yourself/card-design-apple.webp", width: 320, height: 450 },
  google: { src: "/try-yourself/card-design-google.webp", width: 320, height: 483 },
}

function CardFace({ platform, alt, back }: { platform: Platform; alt: string; back?: boolean }) {
  const { src, width, height } = SOURCES[platform]
  return (
    <div
      className="absolute inset-0"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : undefined,
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-full w-full object-contain"
        priority={false}
      />
    </div>
  )
}

export function TryDemoCard({ alt, flipHint }: { alt: string; flipHint: string }) {
  // Which platform faces the user first — Apple by default, Google on Android.
  const [front, setFront] = useState<Platform>("apple")
  const [flipped, setFlipped] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof navigator === "undefined") return
    const ua = navigator.userAgent
    const isAndroid = /Android/i.test(ua)
    const isApple = /iPhone|iPad|iPod|Macintosh/i.test(ua)
    if (isAndroid && !isApple) setFront("google")
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const back: Platform = front === "apple" ? "google" : "apple"
  const toggle = () => setFlipped((f) => !f)

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={flipHint}
        aria-pressed={flipped}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggle()
          }
        }}
        className="relative w-[280px] sm:w-[320px] cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-(--mk-brand-purple) focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--mk-surface)]"
        style={{ perspective: 1200, aspectRatio: "320 / 483" }}
      >
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            transition: reducedMotion ? "none" : "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <CardFace platform={front} alt={alt} />
          <CardFace platform={back} alt={alt} back />
        </div>
      </div>

      {/* Flip affordance */}
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium select-none"
        style={{ color: "var(--mk-text-dimmed)" }}
      >
        <RefreshCw className="size-3.5" strokeWidth={1.75} />
        {flipHint}
      </span>
    </div>
  )
}

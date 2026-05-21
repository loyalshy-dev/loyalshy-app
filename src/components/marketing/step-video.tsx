"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

/**
 * Autoplaying, muted, looping product clip for the How-it-works steps.
 * Falls back to the poster image when the user prefers reduced motion.
 */
export function StepVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  if (reducedMotion) {
    return (
      <Image
        src={poster}
        alt={label}
        width={480}
        height={480}
        className="h-full w-full object-cover object-top"
      />
    )
  }

  return (
    <video
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      aria-label={label}
      className="h-full w-full object-cover object-top"
    />
  )
}

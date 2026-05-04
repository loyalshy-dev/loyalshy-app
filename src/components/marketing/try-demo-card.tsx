"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

type Platform = "apple" | "google"

const SOURCES: Record<Platform, { src: string; width: number; height: number }> = {
  apple: { src: "/try-yourself/card-design-apple.webp", width: 320, height: 450 },
  google: { src: "/try-yourself/card-design-google.webp", width: 320, height: 483 },
}

export function TryDemoCard({ alt }: { alt: string }) {
  const [platform, setPlatform] = useState<Platform>("apple")

  useEffect(() => {
    if (typeof navigator === "undefined") return
    const ua = navigator.userAgent
    const isAndroid = /Android/i.test(ua)
    const isApple = /iPhone|iPad|iPod|Macintosh/i.test(ua)
    if (isAndroid && !isApple) setPlatform("google")
  }, [])

  const { src, width, height } = SOURCES[platform]

  return (
    <Image
      key={platform}
      src={src}
      alt={alt}
      width={width}
      height={height}
      className="rounded-2xl w-[280px] sm:w-[320px] h-auto"
      priority={false}
    />
  )
}

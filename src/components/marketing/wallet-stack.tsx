"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

/* ─── Card image data ─────────────────────────────────────────────── */

const CARD_IMAGES = [
  { src: "/pass-types/stamp-2-apple.webp", alt: "Stamp card — Apple Wallet", shadow: "oklch(0.45 0.15 265)" },
  { src: "/pass-types/coupon-3-google.webp", alt: "Coupon — Google Wallet", shadow: "oklch(0.48 0.12 75)" },
  { src: "/pass-types/stamp-1-google.png", alt: "Stamp card — Google Wallet", shadow: "oklch(0.50 0.12 155)" },
  { src: "/pass-types/coupon-1-apple.png", alt: "Coupon — Apple Wallet", shadow: "oklch(0.50 0.13 30)" },
  { src: "/pass-types/stamp-2-google.webp", alt: "Stamp card — Google Wallet", shadow: "oklch(0.50 0.12 200)" },
  { src: "/pass-types/coupon-2-apple.png", alt: "Coupon — Apple Wallet", shadow: "oklch(0.50 0.13 350)" },
  { src: "/pass-types/stamp-1-apple.png", alt: "Stamp card — Apple Wallet", shadow: "oklch(0.48 0.14 290)" },
  { src: "/pass-types/coupon-3-apple.webp", alt: "Coupon — Apple Wallet", shadow: "oklch(0.48 0.12 60)" },
  { src: "/pass-types/coupon-1-google.png", alt: "Coupon — Google Wallet", shadow: "oklch(0.50 0.12 130)" },
  { src: "/pass-types/coupon-2-google.png", alt: "Coupon — Google Wallet", shadow: "oklch(0.50 0.13 15)" },
] as const

/* ─── Helpers ──────────────────────────────────────────────────────── */

function getCardTransform(
  index: number,
  activeIndex: number,
  hoveredIndex: number,
  total: number,
  compact: boolean,
) {
  const offset = (index - activeIndex + total) % total
  const depth = offset === 0 ? 0 : offset
  // Fan the whole deck across a fixed envelope (not a fixed per-card step), so
  // adding more cards tightens the spacing instead of overflowing the box. The
  // deepest card lands exactly at the envelope edge regardless of card count.
  const steps = Math.max(total - 1, 1)
  const t = depth / steps

  const maxTx = compact ? 66 : 88
  const maxTy = compact ? 30 : 38
  const rotateRange = 20 // deepest card rotates to (-8 + rotateRange)°
  const maxScaleDrop = 0.26
  // Compensate for the active card's left rotation overhang (-8°) so the
  // top-left corner doesn't extend past the container's left edge on mobile.
  const baseTx = compact ? 24 : 0

  const tx = baseTx + t * maxTx
  const ty = -t * maxTy
  const rotate = -8 + t * rotateRange
  const scale = 1 - t * maxScaleDrop
  const z = total - depth

  const isHovered = hoveredIndex === index && depth !== 0
  const liftY = isHovered ? -16 : 0
  const liftScale = isHovered ? scale + 0.02 : scale

  return {
    transform: `translateX(${tx}px) translateY(${ty + liftY}px) rotate(${rotate}deg) scale(${liftScale})`,
    zIndex: z,
  }
}

/* ─── Single card (image-based) ───────────────────────────────────── */

function LoyaltyCard({
  index,
  style,
  isActive,
  isHovered,
  onClick,
  onHover,
  onLeave,
  cardW,
  cardH,
}: {
  index: number
  style: React.CSSProperties
  isActive: boolean
  isHovered: boolean
  onClick: () => void
  onHover: () => void
  onLeave: () => void
  cardW: number
  cardH: number
}) {
  const card = CARD_IMAGES[index]

  return (
    <div
      role="img"
      aria-label={card.alt}
      className="absolute left-0 top-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-(--mk-brand-purple) focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl overflow-hidden"
      style={{
        ...style,
        width: cardW,
        height: cardH,
        transition: "transform 250ms ease-out, box-shadow 250ms ease-out, filter 250ms ease-out",
        filter: isHovered && !isActive
          ? `drop-shadow(0 8px 24px ${card.shadow} / 0.5)`
          : isActive
            ? `drop-shadow(0 16px 48px ${card.shadow} / 0.4)`
            : `drop-shadow(0 4px 12px ${card.shadow} / 0.25)`,
      }}
      tabIndex={isActive ? -1 : 0}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <Image
        src={card.src}
        alt={card.alt}
        width={cardW}
        height={cardH}
        className="w-full h-full object-contain"
        priority={index === 0}
        loading={index === 0 ? undefined : "lazy"}
      />
    </div>
  )
}

/* ─── Stack component ──────────────────────────────────────────────── */

export function WalletStack() {
  const total = CARD_IMAGES.length
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const [reducedMotion, setReducedMotion] = useState(false)
  // Must match SSR (false) so hydration doesn't mismatch. Reading matchMedia
  // here would make the client render compact=true while the server emitted
  // compact=false; React 19 keeps the server DOM on mismatch and never patches
  // it, leaving the stack stuck at the desktop width on mobile. The mount
  // effect below syncs the real value, forcing a post-hydration re-render.
  const [compact, setCompact] = useState(false)
  const interactedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    // Sync on mount: SSR renders compact=false, and the listener below only
    // fires on a viewport *change* — without this, a page loaded directly at a
    // mobile width stays stuck on the desktop layout (overflows + left clip).
    setCompact(mq.matches)
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    if (reducedMotion) return

    timerRef.current = setInterval(() => {
      if (!interactedRef.current) {
        setActiveIndex((prev) => (prev + 1) % total)
      }
    }, 3500)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [reducedMotion, total])

  const handleCardClick = useCallback((index: number) => {
    interactedRef.current = true
    setActiveIndex(index)
    if (timerRef.current) clearInterval(timerRef.current)
    const resumeTimer = setTimeout(() => {
      interactedRef.current = false
    }, 8000)
    return () => clearTimeout(resumeTimer)
  }, [])

  const cardW = compact ? 240 : 320
  const cardH = Math.round(cardW * (1455 / 960)) // match tallest image ratio (Google 960×1455)

  return (
    <div
      className="relative"
      style={{
        width: compact ? 330 : 430,
        height: compact ? cardH + 40 : cardH + 50,
        marginLeft: compact ? 24 : 0,
      }}
    >
      <div
        className="relative h-full w-full"
        style={undefined}
      >
        <div
          role="group"
          aria-label={`Interactive stack of ${total} example pass cards. Click a card to bring it to front.`}
          className="relative h-full w-full"
        >
          {[...Array(total).keys()]
            .sort((a, b) => {
              const depthA = ((a - activeIndex + total) % total) || 0
              const depthB = ((b - activeIndex + total) % total) || 0
              return depthB - depthA
            })
            .map((i) => {
              const { transform, zIndex } = getCardTransform(
                i,
                activeIndex,
                hoveredIndex,
                total,
                compact,
              )

              return (
                <LoyaltyCard
                  key={i}
                  index={i}
                  isActive={i === activeIndex}
                  isHovered={hoveredIndex === i}
                  style={{ transform, zIndex }}
                  onClick={() => handleCardClick(i)}
                  onHover={() => setHoveredIndex(i)}
                  onLeave={() => setHoveredIndex(-1)}
                  cardW={cardW}
                  cardH={cardH}
                />
              )
            })}
        </div>
      </div>

    </div>
  )
}

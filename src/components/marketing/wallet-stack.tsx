"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

/* ─── Card image data ─────────────────────────────────────────────── */

const CARD_IMAGES = [
  { src: "/pass-types/stamp-apple.webp", alt: "Stamp card — Apple Wallet", shadow: "oklch(0.45 0.15 265)" },
  { src: "/pass-types/coupon-google.webp", alt: "Coupon — Google Wallet", shadow: "oklch(0.50 0.12 155)" },
  { src: "/pass-types/ticket-apple.webp", alt: "Ticket — Apple Wallet", shadow: "oklch(0.45 0.10 75)" },
  { src: "/pass-types/memebership-google.webp", alt: "Membership — Google Wallet", shadow: "oklch(0.48 0.14 200)" },
  { src: "/pass-types/business-apple.webp", alt: "Business Card — Apple Wallet", shadow: "oklch(0.50 0.10 300)" },
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

  const spreadX = compact ? 8 : 12
  const spreadY = compact ? 4 : 6
  const rotateStep = 4
  const baseRotate = -8 + depth * rotateStep
  const scaleStep = 0.04

  const tx = depth * spreadX
  const ty = -depth * spreadY
  const rotate = baseRotate
  const scale = 1 - depth * scaleStep
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
      className="absolute left-0 top-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.55_0.2_265)] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl overflow-hidden"
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
        priority
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

  const cardW = compact ? 260 : 320
  const cardH = Math.round(cardW * (1455 / 960)) // match tallest image ratio (Google 960×1455)

  return (
    <div
      className="relative"
      style={{
        width: compact ? 320 : 400,
        height: compact ? cardH + 30 : cardH + 40,
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

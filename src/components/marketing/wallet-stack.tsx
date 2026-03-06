"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MARKETING_CARDS, MARKETING_CARD_DESIGNS, type MarketingCard } from "./wallet-card-data"
import { WalletPassRenderer } from "@/components/wallet-pass-renderer"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"

/* ─── Helpers ──────────────────────────────────────────────────────── */

function getCardTransform(
  index: number,
  activeIndex: number,
  hoveredIndex: number,
  total: number,
  compact: boolean,
) {
  // Position relative to active card
  const offset = (index - activeIndex + total) % total
  // Map to visual order: 0 = front, 1..4 = behind
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

/* ─── Single loyalty card ──────────────────────────────────────────── */

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
  cards,
  designs,
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
  cards: MarketingCard[]
  designs: WalletPassDesign[]
}) {
  const card = cards[index]
  const design = designs[index]

  return (
    <div
      role="img"
      aria-label={`${card.restaurantName} loyalty card`}
      className="absolute left-0 top-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.55_0.2_265)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{
        ...style,
        transition: "transform 250ms ease-out, box-shadow 250ms ease-out, filter 250ms ease-out",
        filter: isHovered && !isActive
          ? `drop-shadow(0 8px 24px ${design.primaryColor}88)`
          : isActive
            ? `drop-shadow(0 16px 48px ${design.primaryColor}66)`
            : `drop-shadow(0 4px 12px ${design.primaryColor}44)`,
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
      <WalletPassRenderer
        design={design}
        compact
        width={cardW}
        height={cardH}
        format="apple"
        organizationName={card.restaurantName}
        currentVisits={card.currentVisits}
        totalVisits={card.totalVisits}
        rewardDescription={card.rewardDescription}
        customerName={card.customerName}
        memberSince={card.memberSince}
        discountText={card.discountText}
        couponCode={card.couponCode}
        validUntil={card.validUntil}
        tierName={card.tierName}
        benefits={card.benefits}
      />
    </div>
  )
}

/* ─── Stack component ──────────────────────────────────────────────── */

type WalletStackProps = {
  cards?: MarketingCard[]
  designs?: WalletPassDesign[]
}

export function WalletStack({ cards: propCards, designs: propDesigns }: WalletStackProps = {}) {
  const cards = propCards ?? MARKETING_CARDS
  const designs = propDesigns ?? MARKETING_CARD_DESIGNS
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [compact, setCompact] = useState(false)
  const interactedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Detect compact viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    setCompact(mq.matches)
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Auto-cycle every 3.5s when user hasn't interacted
  useEffect(() => {
    if (reducedMotion) return

    timerRef.current = setInterval(() => {
      if (!interactedRef.current) {
        setActiveIndex((prev) => (prev + 1) % cards.length)
      }
    }, 3500)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [reducedMotion, cards.length])

  const handleCardClick = useCallback((index: number) => {
    interactedRef.current = true
    setActiveIndex(index)
    // Resume auto-cycle after 8s of inactivity
    if (timerRef.current) clearInterval(timerRef.current)
    const resumeTimer = setTimeout(() => {
      interactedRef.current = false
    }, 8000)
    return () => clearTimeout(resumeTimer)
  }, [])

  // Responsive card dimensions (8:11 ratio)
  const cardW = compact ? 220 : 260
  const cardH = Math.round(cardW * (11 / 8))

  return (
    <div
      className="relative"
      style={{
        // Enough space for the fanned cards
        width: compact ? 280 : 340,
        height: compact ? cardH + 30 : cardH + 40,
      }}
    >
      {/* Float animation wrapper */}
      <div
        className="relative h-full w-full"
        style={
          reducedMotion
            ? undefined
            : { animation: "hero-float 4s ease-in-out infinite" }
        }
      >
        <div
          role="group"
          aria-label={`Interactive stack of ${cards.length} example loyalty cards from different restaurants. Click a card to bring it to front.`}
          className="relative h-full w-full"
        >
          {/* Render back-to-front: cards further back first so front card paints last */}
          {[...cards.keys()]
            .sort((a, b) => {
              const depthA = ((a - activeIndex + cards.length) % cards.length) || 0
              const depthB = ((b - activeIndex + cards.length) % cards.length) || 0
              // Higher depth = further back = render first
              return depthB - depthA
            })
            .map((i) => {
              const { transform, zIndex } = getCardTransform(
                i,
                activeIndex,
                hoveredIndex,
                cards.length,
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
                  cards={cards}
                  designs={designs}
                />
              )
            })}
        </div>
      </div>

      {/* Keyframe for float animation */}
      <style>{`
        @keyframes hero-float {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-14px) rotate(-1deg); }
        }
      `}</style>
    </div>
  )
}

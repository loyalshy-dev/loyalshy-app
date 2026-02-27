"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CARDS, QR_GRIDS, type CardData } from "./wallet-card-data"

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
  card,
  index,
  style,
  isActive,
  isHovered,
  onClick,
  onHover,
  onLeave,
}: {
  card: CardData
  index: number
  style: React.CSSProperties
  isActive: boolean
  isHovered: boolean
  onClick: () => void
  onHover: () => void
  onLeave: () => void
}) {
  const dotCols = 5

  return (
    <div
      role="img"
      aria-label={`${card.restaurant} loyalty card showing ${card.visits} of ${card.total} visits`}
      className="absolute left-0 top-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.55_0.2_265)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{
        ...style,
        transition: "transform 250ms ease-out, box-shadow 250ms ease-out, filter 250ms ease-out",
        filter: isHovered && !isActive
          ? `drop-shadow(0 8px 24px ${card.primary}88)`
          : isActive
            ? `drop-shadow(0 16px 48px ${card.primary}66)`
            : `drop-shadow(0 4px 12px ${card.primary}44)`,
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
      {/* Card body */}
      <div
        className="relative w-[220px] overflow-hidden rounded-2xl sm:w-[240px] lg:w-[260px]"
        style={{
          background: `linear-gradient(145deg, ${card.primary} 0%, ${card.secondary}44 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.12)`,
          aspectRatio: "260 / 340",
        }}
      >
        {/* Inner texture overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 85%, ${card.primary}88 0%, transparent 45%)
            `,
          }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 pt-5">
          <div>
            <p
              className="text-[8px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: `${card.secondary}cc` }}
            >
              Fidelio Loyalty
            </p>
            <p
              className="mt-0.5 text-[13px] font-semibold leading-tight text-white"
            >
              {card.restaurant}
            </p>
          </div>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
            aria-hidden="true"
          >
            <span className="text-[10px] font-bold text-white">
              {card.monogram}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          className="mx-4 mt-3"
          style={{ height: "1px", background: "rgba(255,255,255,0.10)" }}
          aria-hidden="true"
        />

        {/* Visit count */}
        <div className="px-4 pt-3">
          <p
            className="text-[9px] font-medium uppercase tracking-[0.1em]"
            style={{ color: `${card.secondary}aa` }}
          >
            Visits
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-white">
            {card.visits}
            <span
              className="text-sm font-normal"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {" "}/ {card.total}
            </span>
          </p>
        </div>

        {/* Progress dots */}
        <div className="px-4 pt-3" aria-hidden="true">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${dotCols}, 1fr)` }}>
            {Array.from({ length: card.total }, (_, i) => {
              const filled = i < card.visits
              return (
                <div
                  key={i}
                  className="h-5 w-full rounded-md"
                  style={
                    filled
                      ? {
                          background: "rgba(255,255,255,0.9)",
                          boxShadow: `0 1px 4px ${card.primary}66`,
                        }
                      : {
                          background: "rgba(255,255,255,0.12)",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }
                  }
                />
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div
          className="mx-4 mt-3"
          style={{ height: "1px", background: "rgba(255,255,255,0.10)" }}
          aria-hidden="true"
        />

        {/* Reward text */}
        <div className="px-4 pt-3">
          <p
            className="text-[8px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: `${card.secondary}aa` }}
          >
            Your next reward
          </p>
          <p className="mt-1 text-[12px] font-medium leading-snug text-white">
            {card.reward}
          </p>
        </div>

        {/* QR code */}
        <div className="flex justify-center px-4 pt-3 pb-4" aria-hidden="true">
          <div
            className="rounded-lg p-1.5"
            style={{ background: "rgba(255,255,255,0.92)" }}
          >
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: "repeat(9, 1fr)", width: "45px", height: "45px" }}
            >
              {QR_GRIDS[index].flat().map((filled, i) => (
                <div
                  key={i}
                  style={{
                    background: filled ? "#1a1a1a" : "transparent",
                    borderRadius: "0.5px",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Stack component ──────────────────────────────────────────────── */

export function WalletStack() {
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
        setActiveIndex((prev) => (prev + 1) % CARDS.length)
      }
    }, 3500)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [reducedMotion])

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

  return (
    <div
      className="relative"
      style={{
        // Enough space for the fanned cards
        width: compact ? "280px" : "340px",
        height: compact ? "320px" : "380px",
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
          aria-label="Interactive stack of 5 example loyalty cards from different restaurants. Click a card to bring it to front."
          className="relative h-full w-full"
        >
          {/* Render back-to-front: cards further back first so front card paints last */}
          {[...CARDS.keys()]
            .sort((a, b) => {
              const depthA = ((a - activeIndex + CARDS.length) % CARDS.length) || 0
              const depthB = ((b - activeIndex + CARDS.length) % CARDS.length) || 0
              // Higher depth = further back = render first
              return depthB - depthA
            })
            .map((i) => {
              const { transform, zIndex } = getCardTransform(
                i,
                activeIndex,
                hoveredIndex,
                CARDS.length,
                compact,
              )

              return (
                <LoyaltyCard
                  key={i}
                  card={CARDS[i]}
                  index={i}
                  isActive={i === activeIndex}
                  isHovered={hoveredIndex === i}
                  style={{ transform, zIndex }}
                  onClick={() => handleCardClick(i)}
                  onHover={() => setHoveredIndex(i)}
                  onLeave={() => setHoveredIndex(-1)}
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

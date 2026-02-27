"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CARDS, QR_GRIDS, type CardData } from "./wallet-card-data"

/* ─── Constants ────────────────────────────────────────────────────── */

const PHONE_W = 280
const PHONE_H = 542
const SCREEN_INSET = 14 // frame border width on each side
const SCREEN_W = PHONE_W - SCREEN_INSET * 2 // 252
const STATUS_BAR_H = 48
const CARD_PEEK = 64
const VISIBLE_CARDS = 4 // show 4 of 5 cards in stacked view
const EXPAND_TOP = STATUS_BAR_H + 4

/* ─── Wallet card (phone-sized) ────────────────────────────────────── */

function PhoneWalletCard({
  card,
  qrGrid,
  expanded,
}: {
  card: CardData
  qrGrid: boolean[][]
  expanded: boolean
}) {
  const dotCols = 5
  const dotSize = expanded ? "h-7" : "h-5"
  const qrSize = expanded ? "64px" : "45px"

  return (
    <div
      className="w-full overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(145deg, ${card.primary} 0%, ${card.secondary} 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.12)`,
      }}
    >
      {/* Texture overlay */}
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
      <div className="relative flex items-center justify-between px-3 pt-4">
        <div>
          <p
            className="text-[7px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: `${card.secondary}cc` }}
          >
            Fidelio Loyalty
          </p>
          <p className="mt-0.5 text-[11px] font-semibold leading-tight text-white">
            {card.restaurant}
          </p>
        </div>
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
          aria-hidden="true"
        >
          <span className="text-[9px] font-bold text-white">
            {card.monogram}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div
        className="mx-3 mt-2.5"
        style={{ height: "1px", background: "rgba(255,255,255,0.10)" }}
        aria-hidden="true"
      />

      {/* Visit count */}
      <div className="px-3 pt-2.5">
        <p
          className="text-[8px] font-medium uppercase tracking-[0.1em]"
          style={{ color: `${card.secondary}aa` }}
        >
          Visits
        </p>
        <p className="mt-0.5 text-xl font-bold tabular-nums leading-none text-white">
          {card.visits}
          <span
            className="text-xs font-normal"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {" "}/ {card.total}
          </span>
        </p>
      </div>

      {/* Progress dots */}
      <div className="px-3 pt-2.5" aria-hidden="true">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${dotCols}, 1fr)` }}
        >
          {Array.from({ length: card.total }, (_, i) => {
            const filled = i < card.visits
            return (
              <div
                key={i}
                className={`${dotSize} w-full rounded-md`}
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
        className="mx-3 mt-2.5"
        style={{ height: "1px", background: "rgba(255,255,255,0.10)" }}
        aria-hidden="true"
      />

      {/* Reward text */}
      <div className="px-3 pt-2.5">
        <p
          className="text-[7px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: `${card.secondary}aa` }}
        >
          Your next reward
        </p>
        <p className="mt-0.5 text-[11px] font-medium leading-snug text-white">
          {card.reward}
        </p>
      </div>

      {/* QR code */}
      <div className="flex justify-center px-3 pt-2.5 pb-3" aria-hidden="true">
        <div
          className="rounded-lg p-1.5"
          style={{ background: "rgba(255,255,255,0.92)" }}
        >
          <div
            className="grid gap-px"
            style={{
              gridTemplateColumns: "repeat(9, 1fr)",
              width: qrSize,
              height: qrSize,
            }}
          >
            {qrGrid.flat().map((filled, i) => (
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
  )
}

/* ─── Status bar icons ─────────────────────────────────────────────── */

function StatusBar() {
  return (
    <div
      className="flex items-center justify-between px-6"
      style={{ height: `${STATUS_BAR_H}px` }}
      aria-hidden="true"
    >
      <span className="text-[12px] font-semibold text-white">9:41</span>
      <div className="flex items-center gap-1.5">
        {/* Signal bars */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <rect x="0" y="8" width="3" height="4" rx="0.5" fill="white" />
          <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="white" />
          <rect x="9" y="2" width="3" height="10" rx="0.5" fill="white" />
          <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" fill="white" fillOpacity="0.35" />
        </svg>
        {/* WiFi */}
        <svg width="14" height="12" viewBox="0 0 14 12" fill="white">
          <path d="M7 3.5a7.5 7.5 0 0 0-5.2 2.1l1.1 1.1A5.8 5.8 0 0 1 7 5.2a5.8 5.8 0 0 1 4.1 1.5l1.1-1.1A7.5 7.5 0 0 0 7 3.5z" fillOpacity="0.5" />
          <path d="M7 6.5a4.5 4.5 0 0 0-3.1 1.2l1.1 1.1A2.8 2.8 0 0 1 7 8.2a2.8 2.8 0 0 1 2-.6l1.1-1.1A4.5 4.5 0 0 0 7 6.5z" fillOpacity="0.75" />
          <circle cx="7" cy="10.5" r="1.2" />
        </svg>
        {/* Battery */}
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <rect x="0.5" y="1" width="20" height="10" rx="2" stroke="white" strokeOpacity="0.4" />
          <rect x="1.5" y="2" width="18" height="8" rx="1" fill="white" />
          <rect x="21.5" y="4" width="2" height="4" rx="1" fill="white" fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  )
}

/* ─── Dynamic island ───────────────────────────────────────────────── */

function DynamicIsland() {
  return (
    <div
      className="absolute left-1/2 top-2.5 z-30 -translate-x-1/2 rounded-full bg-black"
      style={{ width: 90, height: 28 }}
      aria-hidden="true"
    />
  )
}

/* ─── Side buttons ─────────────────────────────────────────────────── */

function SideButtons() {
  return (
    <>
      {/* Volume up */}
      <div
        className="absolute rounded-sm"
        style={{
          left: -3,
          top: 120,
          width: 3,
          height: 28,
          background: "oklch(0.22 0.005 285)",
        }}
        aria-hidden="true"
      />
      {/* Volume down */}
      <div
        className="absolute rounded-sm"
        style={{
          left: -3,
          top: 158,
          width: 3,
          height: 28,
          background: "oklch(0.22 0.005 285)",
        }}
        aria-hidden="true"
      />
      {/* Power */}
      <div
        className="absolute rounded-sm"
        style={{
          right: -3,
          top: 140,
          width: 3,
          height: 36,
          background: "oklch(0.22 0.005 285)",
        }}
        aria-hidden="true"
      />
    </>
  )
}

/* ─── Main phone mockup ───────────────────────────────────────────── */

export function PhoneMockupInteractive() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const backRef = useRef<HTMLButtonElement>(null)

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Escape key closes expanded card
  useEffect(() => {
    if (expandedIndex === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedIndex(null)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [expandedIndex])

  // Auto-focus back button on expand
  useEffect(() => {
    if (expandedIndex !== null) {
      // Small delay to let the transition start before focus
      const t = setTimeout(() => backRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [expandedIndex])

  const handleExpand = useCallback((index: number) => {
    setExpandedIndex(index)
  }, [])

  const handleCollapse = useCallback(() => {
    setExpandedIndex(null)
  }, [])

  const isExpanded = expandedIndex !== null

  // Screen area height (inside phone frame, below status bar)
  const screenContentH = PHONE_H - SCREEN_INSET * 2 - STATUS_BAR_H

  // Transition style
  const transition = reducedMotion
    ? "none"
    : "transform 350ms cubic-bezier(0.32, 0, 0.15, 1), opacity 250ms ease, border-radius 350ms ease"

  // Only show first VISIBLE_CARDS in the stacked view
  const visibleCards = CARDS.slice(0, VISIBLE_CARDS)

  return (
    <div className="flex items-center justify-center">
      {/* Responsive scaling */}
      <div
        className="origin-top scale-[0.78] sm:scale-[0.9] lg:scale-100"
        style={{
          width: PHONE_W,
          height: PHONE_H,
          // Reserve space for scaled-down versions
          marginBottom: "-80px",
        }}
      >
        {/* Float animation wrapper */}
        <div
          style={
            reducedMotion
              ? undefined
              : { animation: "phone-float 5s ease-in-out infinite" }
          }
        >
          {/* Phone outer frame */}
          <div
            className="relative"
            style={{
              width: PHONE_W,
              height: PHONE_H,
              borderRadius: 44,
              background: "oklch(0.18 0.005 285)",
              boxShadow:
                "0 40px 80px oklch(0 0 0 / 0.25), 0 0 0 1px oklch(0.25 0.005 285), inset 0 1px 0 oklch(0.28 0.005 285)",
            }}
            aria-hidden="true"
          >
            <SideButtons />

            {/* Screen */}
            <div
              className="absolute overflow-hidden"
              style={{
                top: SCREEN_INSET,
                left: SCREEN_INSET,
                width: SCREEN_W,
                height: PHONE_H - SCREEN_INSET * 2,
                borderRadius: 36,
                background: "oklch(0.13 0.01 270)",
              }}
            >
              <DynamicIsland />
              <StatusBar />

              {/* Wallet card area */}
              <div
                role="group"
                aria-label="Interactive wallet cards — tap a card to expand it"
                className="relative"
                style={{
                  height: screenContentH,
                  overflow: "hidden",
                }}
              >
                {visibleCards.map((card, i) => {
                  const isThisExpanded = expandedIndex === i
                  const someOtherExpanded = isExpanded && !isThisExpanded

                  // Stacked position: each card offset by CARD_PEEK
                  const stackY = i * CARD_PEEK
                  // Expanded: fill the screen area starting from top
                  const expandY = 0

                  const y = isThisExpanded ? expandY : someOtherExpanded ? screenContentH + 20 : stackY
                  const opacity = someOtherExpanded ? 0 : 1

                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={isExpanded && !isThisExpanded ? -1 : 0}
                      aria-expanded={isThisExpanded}
                      aria-label={`${card.restaurant} — ${card.visits} of ${card.total} visits. ${isThisExpanded ? "Press Escape or Back to collapse." : "Tap to expand."}`}
                      className="absolute left-0 right-0 px-2 outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.55_0.2_265)] focus-visible:ring-inset"
                      style={{
                        transform: `translateY(${y}px)`,
                        opacity,
                        transition,
                        zIndex: isThisExpanded ? 20 : i + 1,
                        borderRadius: isThisExpanded ? 0 : undefined,
                      }}
                      onClick={() => {
                        if (isThisExpanded) return
                        handleExpand(i)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          if (isThisExpanded) handleCollapse()
                          else handleExpand(i)
                        }
                      }}
                    >
                      <PhoneWalletCard
                        card={card}
                        qrGrid={QR_GRIDS[i]}
                        expanded={isThisExpanded}
                      />
                    </div>
                  )
                })}

                {/* Back button (visible only when expanded) */}
                {isExpanded && (
                  <button
                    ref={backRef}
                    type="button"
                    aria-label="Back to wallet view"
                    className="absolute left-3 top-2 z-30 flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{
                      background: "rgba(0, 0, 0, 0.45)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      opacity: isExpanded ? 1 : 0,
                      transition: reducedMotion ? "none" : "opacity 250ms ease 100ms",
                    }}
                    onClick={handleCollapse}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Keyframe for float animation */}
        <style>{`
          @keyframes phone-float {
            0%, 100% { transform: translateY(0px); }
            50%       { transform: translateY(-10px); }
          }
        `}</style>
      </div>
    </div>
  )
}

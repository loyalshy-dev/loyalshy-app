"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MARKETING_CARDS, MARKETING_CARD_DESIGNS, type MarketingCard } from "./wallet-card-data"
import { WalletPassRenderer } from "@/components/wallet-pass-renderer"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"

/* ─── Constants ────────────────────────────────────────────────────── */

const PHONE_W = 280
const PHONE_H = 542
const SCREEN_INSET = 14 // frame border width on each side
const SCREEN_W = PHONE_W - SCREEN_INSET * 2 // 252
const STATUS_BAR_H = 48
const CARD_PEEK = 64
const VISIBLE_CARDS = 4 // show 4 of 5 cards in stacked view
const EXPAND_TOP = STATUS_BAR_H + 4

/* ─── Card dimensions inside phone ─────────────────────────────────── */

const PHONE_CARD_W = SCREEN_W - 16 // 236 (px-2 = 8px each side)
const PHONE_CARD_H = Math.round(PHONE_CARD_W * (11 / 8)) // ~325

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

type PhoneMockupProps = {
  cards?: MarketingCard[]
  designs?: WalletPassDesign[]
}

export function PhoneMockupInteractive({ cards: propCards, designs: propDesigns }: PhoneMockupProps = {}) {
  const allCards = propCards ?? MARKETING_CARDS
  const allDesigns = propDesigns ?? MARKETING_CARD_DESIGNS
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
  const visibleCards = allCards.slice(0, VISIBLE_CARDS)

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
                  const design = allDesigns[i]
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
                      aria-label={`${card.restaurantName} — ${card.currentVisits} of ${card.totalVisits} visits. ${isThisExpanded ? "Press Escape or Back to collapse." : "Tap to expand."}`}
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
                      <WalletPassRenderer
                        design={design}
                        compact
                        width={PHONE_CARD_W}
                        height={PHONE_CARD_H}
                        format="apple"
                        restaurantName={card.restaurantName}
                        currentVisits={card.currentVisits}
                        totalVisits={card.totalVisits}
                        rewardDescription={card.rewardDescription}
                        customerName={card.customerName}
                        memberSince={card.memberSince}
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

"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

/* ─── Constants ────────────────────────────────────────────────────── */
// Shell matches the Plataforma (FeatureShowcase) phone frame: thin uniform
// bezel, 390/844 screen, small dynamic island, light shadow + 1px ring.

const PHONE_W = 260
const BEZEL = 8 // uniform bezel thickness (matches FeatureShowcase frame padding)
const SCREEN_W = PHONE_W - BEZEL * 2 // 244
const SCREEN_H = Math.round(SCREEN_W * (844 / 390)) // ≈ 528 — modern iPhone ratio
const PHONE_H = SCREEN_H + BEZEL * 2
const TOP_INSET = 40 // clearance below the dynamic island before cards start
const CARD_PEEK = 64
const CARD_PADDING = 4 // 4px each side

/* ─── Card images ─────────────────────────────────────────────────── */

// All Apple Wallet passes (960×1350) — the section shows a customer's Apple
// Wallet, so the stack is Apple-only. w/h are the intrinsic size so the tall
// full-pass screenshots keep their aspect ratio inside the phone screen.
const CARD_IMAGES = [
  { src: "/pass-types/coupon-1-apple.png", alt: "Coupon — Apple Wallet", w: 960, h: 1350 },
  { src: "/pass-types/stamp-1-apple.png", alt: "Stamp card — Apple Wallet", w: 960, h: 1350 },
  { src: "/pass-types/coupon-2-apple.png", alt: "Coupon — Apple Wallet", w: 960, h: 1350 },
  { src: "/pass-types/stamp-2-apple.webp", alt: "Stamp card — Apple Wallet", w: 960, h: 1350 },
  { src: "/pass-types/coupon-3-apple.webp", alt: "Coupon — Apple Wallet", w: 960, h: 1350 },
] as const

/* ─── Dynamic island ───────────────────────────────────────────────── */

function DynamicIsland() {
  return (
    <div
      className="absolute left-1/2 top-3.5 z-30 -translate-x-1/2 rounded-full bg-black"
      style={{ width: 78, height: 22 }}
      aria-hidden="true"
    />
  )
}

/* ─── Main phone mockup ────────────────────────────────────────────── */

export function PhoneMockupInteractive() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const backRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    if (expandedIndex === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedIndex(null)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [expandedIndex])

  useEffect(() => {
    if (expandedIndex !== null) {
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
  const screenContentH = SCREEN_H - TOP_INSET

  const transition = reducedMotion
    ? "none"
    : "transform 350ms cubic-bezier(0.32, 0, 0.15, 1), opacity 250ms ease, border-radius 350ms ease"

  return (
    <div className="flex items-center justify-center">
      <div
        className="mb-0 lg:mb-[-80px]"
        style={{
          width: PHONE_W,
          height: PHONE_H,
        }}
      >
        {/* Phone body — thin uniform bezel via padding, light shadow + 1px ring */}
        <div
          className="relative overflow-hidden"
          style={{
            width: PHONE_W,
            padding: BEZEL,
            borderRadius: 42,
            background: "oklch(0.18 0.005 285)",
            boxShadow: "0 24px 70px oklch(0 0 0 / 0.18), 0 0 0 1px var(--mk-border)",
          }}
          aria-hidden="true"
        >
          <DynamicIsland />

          {/* Screen */}
          <div
            className="relative overflow-hidden"
            style={{
              height: SCREEN_H,
              borderRadius: 34,
              background: "oklch(0.13 0.01 270)",
            }}
          >
            <div
              role="group"
              aria-label="Interactive wallet cards — tap a card to expand it"
              className="absolute left-0 right-0"
              style={{ top: TOP_INSET, height: screenContentH, overflow: "hidden" }}
            >
              {CARD_IMAGES.map((card, i) => {
                const isThisExpanded = expandedIndex === i
                const someOtherExpanded = isExpanded && !isThisExpanded

                const stackY = i * CARD_PEEK
                const y = isThisExpanded ? 0 : someOtherExpanded ? screenContentH + 20 : stackY
                const opacity = someOtherExpanded ? 0 : 1

                return (
                  <div
                    key={i}
                    role="button"
                    tabIndex={isExpanded && !isThisExpanded ? -1 : 0}
                    aria-expanded={isThisExpanded}
                    aria-label={`${card.alt}. ${isThisExpanded ? "Press Escape or Back to collapse." : "Tap to expand."}`}
                    className="absolute outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.55_0.2_265)] focus-visible:ring-inset"
                    style={{
                      left: CARD_PADDING,
                      right: CARD_PADDING,
                      transform: `translateY(${y}px)`,
                      opacity,
                      transition,
                      zIndex: isThisExpanded ? 20 : i + 1,
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
                    <Image
                      src={card.src}
                      alt={card.alt}
                      width={card.w}
                      height={card.h}
                      className="w-full h-auto rounded-xl"
                    />
                  </div>
                )
              })}

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
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"

const CAROUSEL_ITEMS = [
  { id: "1", alt: "Restaurant loyalty program example" },
  { id: "2", alt: "Digital wallet pass design" },
  { id: "3", alt: "QR code onboarding flow" },
  { id: "4", alt: "Customer rewards dashboard" },
  { id: "5", alt: "Apple Wallet loyalty card" },
  { id: "6", alt: "Google Wallet pass example" },
  { id: "7", alt: "Restaurant analytics overview" },
  { id: "8", alt: "Team management interface" },
]

const TRIPLED_ITEMS = [...CAROUSEL_ITEMS, ...CAROUSEL_ITEMS, ...CAROUSEL_ITEMS]

export function Hero() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const draggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragScrollLeftRef = useRef(0)
  const velocityRef = useRef(0)
  const lastDragXRef = useRef(0)
  const lastDragTimeRef = useRef(0)

  const scroll = useCallback((direction: "left" | "right") => {
    const track = trackRef.current
    if (!track) return
    const cardWidth = 360 + 24
    track.scrollBy({
      left: direction === "right" ? cardWidth : -cardWidth,
      behavior: "smooth",
    })
  }, [])

  // Infinite loop reset helper
  const clampScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const singleSetWidth = track.scrollWidth / 3
    if (track.scrollLeft >= singleSetWidth * 2) {
      track.scrollLeft -= singleSetWidth
    } else if (track.scrollLeft < singleSetWidth * 0.1) {
      track.scrollLeft += singleSetWidth
    }
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (paused) return
    const track = trackRef.current
    if (!track) return

    let animId: number
    let lastTime = performance.now()
    const speed = 0.07

    function step(now: number) {
      const dt = now - lastTime
      lastTime = now
      if (track) {
        track.scrollLeft += speed * dt
        clampScroll()
      }
      animId = requestAnimationFrame(step)
    }

    animId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animId)
  }, [paused, clampScroll])

  // Start at middle set
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const singleSetWidth = track.scrollWidth / 3
    track.scrollLeft = singleSetWidth
  }, [])

  // ── Drag handlers ───────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const track = trackRef.current
    if (!track) return
    draggingRef.current = true
    dragStartXRef.current = e.clientX
    dragScrollLeftRef.current = track.scrollLeft
    lastDragXRef.current = e.clientX
    lastDragTimeRef.current = performance.now()
    velocityRef.current = 0
    setPaused(true)
    track.setPointerCapture(e.pointerId)
    track.style.cursor = "grabbing"
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const track = trackRef.current
    if (!track) return

    const dx = e.clientX - dragStartXRef.current
    track.scrollLeft = dragScrollLeftRef.current - dx

    // Track velocity for momentum
    const now = performance.now()
    const dt = now - lastDragTimeRef.current
    if (dt > 0) {
      velocityRef.current = (e.clientX - lastDragXRef.current) / dt
    }
    lastDragXRef.current = e.clientX
    lastDragTimeRef.current = now

    clampScroll()
  }, [clampScroll])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const track = trackRef.current
    if (!track) return

    draggingRef.current = false
    track.releasePointerCapture(e.pointerId)
    track.style.cursor = "grab"

    // Momentum coast
    const v = velocityRef.current
    if (Math.abs(v) > 0.1) {
      let momentum = v * 300 // px to coast
      const startScroll = track.scrollLeft
      const startTime = performance.now()
      const duration = 600

      function coast(now: number) {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        track!.scrollLeft = startScroll - momentum * ease
        clampScroll()
        if (progress < 1) {
          requestAnimationFrame(coast)
        } else {
          setPaused(false)
        }
      }
      requestAnimationFrame(coast)
    } else {
      // Resume auto-scroll after a brief pause
      setTimeout(() => setPaused(false), 1500)
    }
  }, [clampScroll])

  return (
    <section
      className="relative overflow-hidden"
      aria-label="Hero"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* ── Carousel ───────────────────────────────────────── */}
      <div className="relative pt-2 sm:pt-3 pb-52 sm:pb-60">
        {/* Edge fade masks */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 sm:w-32"
          style={{ background: "linear-gradient(to right, var(--mk-bg), transparent)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 sm:w-32"
          style={{ background: "linear-gradient(to left, var(--mk-bg), transparent)" }}
        />

        {/* Scrolling card track — draggable */}
        <div
          ref={trackRef}
          className="flex gap-6 overflow-x-hidden overflow-y-visible px-8 py-8 select-none"
          style={{ scrollbarWidth: "none", cursor: "grab" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseEnter={() => { if (!draggingRef.current) setPaused(true) }}
          onMouseLeave={() => { if (!draggingRef.current) setPaused(false) }}
        >
          {TRIPLED_ITEMS.map((item, i) => (
            <div
              key={`${item.id}-${i}`}
              className="shrink-0"
              style={{ width: 360 }}
            >
              <div
                className="rounded-2xl overflow-hidden shadow-lg transition-shadow pointer-events-none"
                style={{
                  width: 360,
                  height: 495,
                  background: "var(--mk-surface)",
                  border: "1px solid var(--mk-border)",
                }}
                role="img"
                aria-label={item.alt}
              />
            </div>
          ))}
        </div>

        {/* ── Centered floating text card (Figma-style) ──── */}
        <div className="absolute inset-x-0 bottom-12 sm:bottom-16 z-30 flex justify-center px-6">
          <div
            className="w-full max-w-lg rounded-2xl p-8 sm:p-10"
            style={{
              background: "var(--mk-card)",
              boxShadow: "0 8px 40px oklch(0 0 0 / 0.10), 0 0 0 1px oklch(0 0 0 / 0.04)",
            }}
          >
            <h1
              className="text-[2rem] sm:text-[2.5rem] lg:text-[3rem] font-bold leading-[1.1]"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.04em" }}
            >
              Digital loyalty cards your customers{" "}
              <span className="mk-gradient-text">actually use</span>
            </h1>
            <div className="mt-6 flex justify-end">
              <Link href="/register" className="mk-btn-primary">
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Subtitle + controls ───────────────────────────── */}
      <div className="relative z-30 mx-auto max-w-4xl px-6 pb-16 sm:pb-20 -mt-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <p
            className="text-center sm:text-left text-[15px] sm:text-base leading-relaxed max-w-lg"
            style={{ color: "var(--mk-text-muted)" }}
          >
            Replace paper punch cards with Apple &amp; Google Wallet passes.
            Set up in 5 minutes. No credit card required.
          </p>

          {/* Carousel controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="flex size-10 items-center justify-center rounded-full transition-colors"
              style={{ border: "1px solid var(--mk-border)", color: "var(--mk-text)" }}
              aria-label="Previous card"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="flex size-10 items-center justify-center rounded-full transition-colors"
              style={{ border: "1px solid var(--mk-border)", color: "var(--mk-text)" }}
              aria-label={paused ? "Resume carousel" : "Pause carousel"}
            >
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="flex size-10 items-center justify-center rounded-full transition-colors"
              style={{ border: "1px solid var(--mk-border)", color: "var(--mk-text)" }}
              aria-label="Next card"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

"use client"

import { useCallback, useRef, useState } from "react"
import {
  Smartphone, Wallet, BarChart3, Users, Palette, QrCode, Zap, Bell,
  ChevronLeft, ChevronRight,
} from "lucide-react"
import type React from "react"

/* ─── Icon lookup ─────────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  Smartphone, Wallet, BarChart3, Users, Palette, QrCode, Zap, Bell,
}

/* ─── Types ───────────────────────────────────────────────────────── */

type FeatureItem = {
  title: string
  description: string
  iconName: string
}

/* ─── Component ───────────────────────────────────────────────────── */

export function FeaturesCarouselMobile({ features }: { features: FeatureItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const scroll = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const cardW = el.firstElementChild?.getBoundingClientRect().width ?? 260
    const gap = 12
    const next = dir === "left" ? active - 1 : active + 1
    const clamped = Math.max(0, Math.min(next, features.length - 1))
    el.scrollTo({ left: clamped * (cardW + gap), behavior: "smooth" })
    setActive(clamped)
  }, [active, features.length])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const cardW = el.firstElementChild?.getBoundingClientRect().width ?? 260
    const gap = 12
    const idx = Math.round(el.scrollLeft / (cardW + gap))
    setActive(Math.max(0, Math.min(idx, features.length - 1)))
  }, [features.length])

  return (
    <div className="sm:hidden">
      <div className="relative">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-6 px-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {features.map((feat) => {
            const Icon = ICON_MAP[feat.iconName] ?? Zap
            return (
              <div key={feat.title} className="snap-center shrink-0 w-[80vw] max-w-[300px]">
                <div
                  className="group relative flex flex-col gap-4 p-8 h-full mk-card-glass overflow-hidden"
                >
                  {/* Top accent on hover */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    style={{
                      background: "linear-gradient(90deg, var(--mk-brand-purple), var(--mk-brand-green))",
                    }}
                  />
                  <div className="flex flex-col gap-4">
                    <Icon
                      className="size-7"
                      strokeWidth={1.5}
                      style={{ color: "var(--mk-text-muted)" }}
                    />
                    <div className="space-y-2">
                      <h3
                        className="text-xl font-bold tracking-tight"
                        style={{ color: "var(--mk-text)" }}
                      >
                        {feat.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--mk-text-muted)" }}
                      >
                        {feat.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Nav arrows */}
        {active > 0 && (
          <button
            type="button"
            aria-label="Previous feature"
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 size-8 rounded-full flex items-center justify-center"
            style={{
              background: "var(--mk-card)",
              border: "1px solid var(--mk-border)",
              boxShadow: "0 2px 8px oklch(0 0 0 / 0.1)",
            }}
          >
            <ChevronLeft className="size-4" style={{ color: "var(--mk-text)" }} />
          </button>
        )}
        {active < features.length - 1 && (
          <button
            type="button"
            aria-label="Next feature"
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 size-8 rounded-full flex items-center justify-center"
            style={{
              background: "var(--mk-card)",
              border: "1px solid var(--mk-border)",
              boxShadow: "0 2px 8px oklch(0 0 0 / 0.1)",
            }}
          >
            <ChevronRight className="size-4" style={{ color: "var(--mk-text)" }} />
          </button>
        )}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {features.map((feat, i) => (
          <div
            key={feat.title}
            className="rounded-full transition-all duration-300"
            style={{
              width: active === i ? 20 : 6,
              height: 6,
              background: active === i ? "var(--mk-brand-purple)" : "var(--mk-border)",
            }}
          />
        ))}
      </div>
    </div>
  )
}

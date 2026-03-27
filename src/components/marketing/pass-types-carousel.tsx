"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  Stamp,
  Ticket,
  Crown,
  Coins,
  Gift,
  CalendarDays,
  ContactRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
// Icons used for placeholder cards when screenshots not available
import { useTranslations } from "next-intl"
import { FadeIn } from "./motion"

const PASS_TYPES = [
  { id: "stampCard", icon: Stamp, image: "/pass-types/stamp-apple.webp" },
  { id: "coupon", icon: Ticket, image: "/pass-types/coupon-google.webp" },
  { id: "membership", icon: Crown, image: "/pass-types/memebership-apple.webp" },
  { id: "points", icon: Coins, image: null },
  { id: "giftCard", icon: Gift, image: null },
  { id: "ticket", icon: CalendarDays, image: "/pass-types/ticket-google.webp" },
  { id: "businessCard", icon: ContactRound, image: "/pass-types/business-apple.webp" },
] as const

export function PassTypesCarousel() {
  const t = useTranslations("passTypesCarousel")
  const [active, setActive] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const count = PASS_TYPES.length

  const stopAutoplay = useCallback(() => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current)
      autoplayRef.current = null
    }
  }, [])

  const startAutoplay = useCallback(() => {
    stopAutoplay()
    autoplayRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % count)
    }, 4000)
  }, [count, stopAutoplay])

  useEffect(() => {
    startAutoplay()
    return stopAutoplay
  }, [startAutoplay, stopAutoplay])

  const goTo = useCallback(
    (index: number) => {
      setActive(index)
      startAutoplay()
    },
    [startAutoplay],
  )

  const prev = useCallback(() => {
    goTo((active - 1 + count) % count)
  }, [active, count, goTo])

  const next = useCallback(() => {
    goTo((active + 1) % count)
  }, [active, count, goTo])

  // Scroll the pill bar to keep active tab visible
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const pill = container.children[active] as HTMLElement | undefined
    if (!pill) return
    const left = pill.offsetLeft - container.offsetWidth / 2 + pill.offsetWidth / 2
    container.scrollTo({ left, behavior: "smooth" })
  }, [active])

  const current = PASS_TYPES[active]

  return (
    <section className="relative py-16 sm:py-24 md:py-32 overflow-hidden" style={{ background: "var(--mk-bg)" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section heading */}
        <FadeIn>
          <div className="text-center mb-12">
            <h2
              className="mk-clamp-h2 font-black tracking-tight"
              style={{ color: "var(--mk-text)" }}
            >
              {t("title")}
            </h2>
            <p
              className="mt-4 text-lg leading-relaxed max-w-2xl mx-auto"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("subtitle")}
            </p>
          </div>
        </FadeIn>

        {/* Scrollable pill bar */}
        <FadeIn delay={0.15}>
          <div className="flex flex-wrap justify-center gap-2 mb-16">
            <div
              ref={scrollRef}
              className="relative flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-6 px-6 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center scroll-smooth snap-x snap-mandatory sm:snap-none"
            >
              {PASS_TYPES.map((type, i) => {
                const isActive = active === i
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => goTo(i)}
                    className="shrink-0 snap-start rounded-full px-6 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200"
                    style={
                      isActive
                        ? { background: "var(--mk-brand-purple)", color: "oklch(0.99 0 0)" }
                        : { color: "var(--mk-text-muted)" }
                    }
                  >
                    <span className="whitespace-nowrap">
                      {t(`types.${type.id}.label`)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </FadeIn>

        {/* Glass container card */}
        <FadeIn delay={0.25}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center mk-card-glass p-6 sm:p-12 rounded-2xl sm:rounded-[3rem]">

            {/* Screenshot — all stacked, crossfade on switch */}
            <div
              className="relative overflow-hidden rounded-xl max-w-sm mx-auto"
            >
              {PASS_TYPES.map((type, i) => (
                type.image ? (
                  <Image
                    key={type.id}
                    src={type.image}
                    alt={t(`types.${type.id}.alt`)}
                    width={600}
                    height={400}
                    className="w-full h-auto transition-opacity duration-300 ease-out"
                    style={{
                      opacity: active === i ? 1 : 0,
                      position: active === i ? "relative" : "absolute",
                      top: 0,
                      left: 0,
                    }}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    loading="lazy"
                  />
                ) : (
                  <div
                    key={type.id}
                    className="flex flex-col items-center justify-center gap-3 aspect-4/3 w-full rounded-xl transition-opacity duration-300 ease-out"
                    style={{
                      opacity: active === i ? 1 : 0,
                      position: active === i ? "relative" : "absolute",
                      top: 0,
                      left: 0,
                      background: "var(--mk-surface, oklch(0.95 0.005 265))",
                      border: "1px dashed var(--mk-border, oklch(0.85 0.01 265))",
                    }}
                  >
                    {(() => {
                      const Icon = type.icon
                      return <Icon className="size-12" style={{ color: "var(--mk-text-muted)" }} strokeWidth={1} />
                    })()}
                    <span className="text-sm font-medium" style={{ color: "var(--mk-text-muted)" }}>
                      {t(`types.${type.id}.label`)}
                    </span>
                    <span className="text-xs" style={{ color: "var(--mk-text-muted)", opacity: 0.6 }}>
                      Coming soon
                    </span>
                  </div>
                )
              ))}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-6">
              <h3
                className="text-3xl font-black tracking-tight"
                style={{ color: "var(--mk-text)" }}
              >
                {t(`types.${current.id}.label`)}
              </h3>

              <p
                className="text-lg leading-relaxed"
                style={{ color: "var(--mk-text-muted)" }}
              >
                {t(`types.${current.id}.description`)}
              </p>

              {/* Use cases */}
              <div className="flex flex-wrap gap-2">
                {(t.raw(`types.${current.id}.useCases`) as string[]).map(
                  (useCase) => (
                    <span
                      key={useCase}
                      className="rounded-full px-3 py-1 text-[12px] font-medium"
                      style={{
                        background: "var(--mk-surface)",
                        color: "var(--mk-text-muted)",
                        border: "1px solid var(--mk-border)",
                      }}
                    >
                      {useCase}
                    </span>
                  ),
                )}
              </div>

              {/* Nav arrows */}
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={prev}
                  aria-label={t("prev")}
                  className="flex size-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-(--mk-surface)"
                  style={{ border: "1px solid var(--mk-border)", color: "var(--mk-text-muted)" }}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span
                  className="text-[13px] tabular-nums"
                  style={{ color: "var(--mk-text-dimmed)" }}
                >
                  {active + 1} / {count}
                </span>
                <button
                  type="button"
                  onClick={next}
                  aria-label={t("next")}
                  className="flex size-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-(--mk-surface)"
                  style={{ border: "1px solid var(--mk-border)", color: "var(--mk-text-muted)" }}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

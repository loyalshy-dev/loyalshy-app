"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  Stamp,
  Ticket,
  Crown,
  Coins,
  CreditCard,
  Gift,
  CalendarDays,
  ShieldCheck,
  Bus,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { FadeIn } from "./motion"

const PASS_TYPES = [
  { id: "stampCard", icon: Stamp },
  { id: "coupon", icon: Ticket },
  { id: "membership", icon: Crown },
  { id: "points", icon: Coins },
  { id: "prepaid", icon: CreditCard },
  { id: "giftCard", icon: Gift },
  { id: "ticket", icon: CalendarDays },
  { id: "access", icon: ShieldCheck },
  { id: "transit", icon: Bus },
  { id: "businessId", icon: BadgeCheck },
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
    <section className="relative py-24 sm:py-32 overflow-hidden" style={{ background: "var(--mk-surface)" }}>
      {/* Gradient mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 50% 50% at 30% 50%, oklch(0.55 0.2 265 / 0.04) 0%, transparent 70%),
            radial-gradient(ellipse 40% 60% at 70% 30%, oklch(0.55 0.17 155 / 0.03) 0%, transparent 70%)
          `,
        }}
      />
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Heading */}
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <p
              className="text-[13px] font-medium uppercase tracking-widest mb-3"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="text-3xl sm:text-[2.5rem] font-bold"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
            >
              {t("title")}
            </h2>
            <p
              className="mt-4 text-[16px] leading-relaxed"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("subtitle")}
            </p>
          </div>
        </FadeIn>

        {/* Scrollable pill bar */}
        <FadeIn delay={0.15}>
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-6 px-6 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center"
          >
            {PASS_TYPES.map((type, i) => {
              const Icon = type.icon
              const isActive = active === i
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => goTo(i)}
                  className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-200"
                  style={
                    isActive
                      ? { background: "var(--mk-text)", color: "var(--mk-bg)" }
                      : { background: "transparent", color: "var(--mk-text-muted)" }
                  }
                >
                  <Icon className="size-3.5" strokeWidth={1.5} />
                  <span className="whitespace-nowrap">
                    {t(`types.${type.id}.label`)}
                  </span>
                </button>
              )
            })}
          </div>
        </FadeIn>

        {/* Card */}
        <FadeIn delay={0.25}>
          <div
            className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center rounded-2xl p-6 sm:p-10"
            style={{
              background: "var(--mk-card)",
              border: "1px solid var(--mk-border)",
              boxShadow: "0 20px 60px oklch(0 0 0 / 0.06)",
            }}
          >
            {/* Screenshot — all stacked, crossfade on switch */}
            <div
              className="relative overflow-hidden rounded-xl"
              style={{
                background: "var(--mk-surface)",
                border: "1px solid var(--mk-border)",
                boxShadow: "0 4px 16px oklch(0 0 0 / 0.06)",
              }}
            >
              {PASS_TYPES.map((type, i) => (
                <Image
                  key={type.id}
                  src={`/pass-types/${type.id}.webp`}
                  alt={t(`types.${type.id}.alt`)}
                  width={800}
                  height={600}
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
              ))}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = current.icon
                  return (
                    <div
                      className="flex size-11 items-center justify-center rounded-xl"
                      style={{
                        background: "oklch(0.55 0.2 265 / 0.08)",
                      }}
                    >
                      <Icon
                        className="size-5"
                        strokeWidth={1.5}
                        style={{ color: "var(--mk-brand-purple)" }}
                      />
                    </div>
                  )
                })()}
                <h3
                  className="text-xl sm:text-2xl font-bold"
                  style={{ color: "var(--mk-text)", letterSpacing: "-0.02em" }}
                >
                  {t(`types.${current.id}.label`)}
                </h3>
              </div>

              <p
                className="text-[15px] leading-relaxed"
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
                  className="flex size-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--mk-surface)]"
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
                  className="flex size-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--mk-surface)]"
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

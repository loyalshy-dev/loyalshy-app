"use client"

import { useState } from "react"
import { useMotionValueEvent, type MotionValue } from "motion/react"
import { useTranslations } from "next-intl"
import { CHAPTERS, FILM, type Chapter } from "./film-timeline"

// The film's progress rail: one dot per chapter on the left axis, the
// current one in ink, each a button that scrolls the page to that chapter.
// It is the one way to skip ahead without leaving the film.

export function FilmRail({ p, scrollTo }: { p: MotionValue<number>; scrollTo: (progress: number) => void }) {
  const t = useTranslations("hero")
  const [current, setCurrent] = useState<Chapter | null>(null)
  useMotionValueEvent(p, "change", (v) => {
    const next = FILM.chapterAt(v)
    if (next !== current) setCurrent(next)
  })
  return (
    <nav aria-label={t("film.chapters")} className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
      <ol className="relative flex flex-col gap-4 py-1">
        <span aria-hidden="true" className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2" style={{ background: "var(--mk-border)" }} />
        {CHAPTERS.map((key) => {
          const active = current === key
          return (
            <li key={key} className="relative">
              <button
                type="button"
                onClick={() => scrollTo(FILM[key].landAt)}
                aria-label={t(`film.${key}.title`)}
                aria-current={active ? "step" : undefined}
                className="group grid size-6 place-items-center rounded-full"
              >
                <span
                  className="block rounded-full transition-[transform,background-color] duration-200 group-hover:scale-125"
                  style={{ width: 7, height: 7, background: active ? "var(--mk-text)" : "var(--mk-border-hover)", transform: active ? "scale(1.3)" : undefined }}
                />
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

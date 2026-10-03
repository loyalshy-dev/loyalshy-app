"use client"

import { motion, useSpring, useTransform, type MotionValue } from "motion/react"
import { BRAND_PATHS } from "./brand-paths"
import { FILM } from "./film-timeline"
import { INK, SPRING_LIGHT } from "./tokens"

// Chapter 1: the ways a program is shared, as tiles floating around the
// phone while the counter QR is in the camera — email and the social
// networks a link gets posted to. Brand marks come from `brand-paths.ts`,
// drawn in ink on white so the page keeps its one coral. Positions are in
// phone widths from the phone's centre: four left and three right on
// desktop (the right side is the stage's edge on laptops), three a side in
// the gutters on phones. Each tile rises in a beat after the one before.


type Tile = { key: "mail" | keyof typeof BRAND_PATHS; wide: readonly [number, number]; narrow: readonly [number, number]; delay: number }

const TILES: Tile[] = [
  { key: "mail", wide: [-0.9, -0.75], narrow: [-0.68, -0.6], delay: 0 },
  { key: "instagram", wide: [0.66, -0.65], narrow: [0.68, -0.72], delay: 1 },
  { key: "tiktok", wide: [-1.0, -0.2], narrow: [-0.7, -0.05], delay: 2 },
  { key: "x", wide: [0.66, 0.1], narrow: [0.7, 0.0], delay: 3 },
  { key: "whatsapp", wide: [-0.95, 0.35], narrow: [-0.68, 0.55], delay: 4 },
  { key: "snapchat", wide: [0.66, 0.78], narrow: [0.68, 0.62], delay: 5 },
  { key: "facebook", wide: [-0.88, 0.9], narrow: [0, 0], delay: 6 },
]

function MailMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[52%]" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  )
}

function BrandMark({ name }: { name: keyof typeof BRAND_PATHS }) {
  return (
    <svg viewBox="0 0 24 24" fill={INK} className="size-[46%]" aria-hidden="true">
      <path d={BRAND_PATHS[name]} />
    </svg>
  )
}

function useTile(p: MotionValue<number>, i: number) {
  const [inStart, inEnd, outStart, outEnd] = FILM.ch1.camera
  const start = inStart + i * FILM.ch1.tileStep
  const o = useSpring(useTransform(p, [start, start + (inEnd - inStart), outStart, outEnd], [0, 1, 1, 0]), SPRING_LIGHT)
  const y = useSpring(useTransform(p, [start, start + (inEnd - inStart) * 1.6], [18, 0]), { stiffness: 120, damping: 16, mass: 0.8 })
  const visibility = useTransform(o, (v) => (v > 0.01 ? "visible" : "hidden"))
  return { o, y, visibility }
}

export function ShareTiles({ p, narrow }: { p: MotionValue<number>; narrow: boolean }) {
  // One hook call per tile, in a fixed order.
  const t0 = useTile(p, TILES[0].delay)
  const t1 = useTile(p, TILES[1].delay)
  const t2 = useTile(p, TILES[2].delay)
  const t3 = useTile(p, TILES[3].delay)
  const t4 = useTile(p, TILES[4].delay)
  const t5 = useTile(p, TILES[5].delay)
  const t6 = useTile(p, TILES[6].delay)
  const motions = [t0, t1, t2, t3, t4, t5, t6]
  return (
    <>
      {TILES.map((tile, i) => {
        // Three a side is what the gutters take on phones.
        if (narrow && tile.key === "facebook") return null
        const [dx, dy] = narrow ? tile.narrow : tile.wide
        return (
          <motion.div
            key={tile.key}
            style={{
              opacity: motions[i].o,
              y: motions[i].y,
              visibility: motions[i].visibility,
              left: `calc(50% + var(--pw) * ${dx})`,
              top: `calc(50% + var(--pw) * ${dy})`,
              boxShadow: "0 10px 24px -8px oklch(0 0 0 / 0.22), 0 0 0 1px oklch(0 0 0 / 0.06)",
            }}
            className="mk-film-tile pointer-events-none absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white"
          >
            {tile.key === "mail" ? <MailMark /> : <BrandMark name={tile.key} />}
          </motion.div>
        )
      })}
    </>
  )
}

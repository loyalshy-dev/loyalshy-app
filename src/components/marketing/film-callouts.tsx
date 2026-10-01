"use client"

import { motion, useSpring, useTransform, type MotionValue } from "motion/react"
import { useTranslations } from "next-intl"
import { CORAL, INK, SPRING_LIGHT } from "./tokens"

// The card's parts, called out one by one as the scroll advances. On
// desktop the labels stack to the right of the phone with a line to the
// part; on phones they are a list under the caption. Targets are fractions
// of the Apple pass (320 × 450). Items only animate opacity: the chapter's
// caption wrapper owns `visibility`, and a child's own `visible` would show
// through a hidden parent.

export type Part = { key: string; tx: number; ty: number }

export const STAMP_PARTS: Part[] = [
  { key: "logo", tx: 0.16, ty: 0.065 },
  { key: "stamps", tx: 0.62, ty: 0.27 },
  { key: "reward", tx: 0.14, ty: 0.49 },
  { key: "name", tx: 0.88, ty: 0.49 },
  { key: "qr", tx: 0.5, ty: 0.8 },
]
export const COUPON_PARTS: Part[] = [
  { key: "offer", tx: 0.5, ty: 0.3 },
  { key: "valid", tx: 0.16, ty: 0.49 },
  { key: "code", tx: 0.5, ty: 0.49 },
  { key: "qr", tx: 0.5, ty: 0.8 },
]
const MAX_PARTS = 5

// Each callout owns a window of progress; label and line arrive together.
function useCallout(p: MotionValue<number>, start: number) {
  const o = useSpring(useTransform(p, [start, start + 0.009], [0, 1]), SPRING_LIGHT)
  const x = useSpring(useTransform(p, [start, start + 0.01], [10, 0]), SPRING_LIGHT)
  const draw = useSpring(useTransform(p, [start, start + 0.012], [0, 1]), { stiffness: 80, damping: 22, mass: 0.8 })
  return { o, x, draw }
}

function useCallouts(p: MotionValue<number>, from: number, step: number) {
  // Hooks run in a stable order: one per possible part.
  const c0 = useCallout(p, from)
  const c1 = useCallout(p, from + step)
  const c2 = useCallout(p, from + step * 2)
  const c3 = useCallout(p, from + step * 3)
  const c4 = useCallout(p, from + step * 4)
  return [c0, c1, c2, c3, c4]
}

/** The card's box inside the phone's (unscaled) coordinate space. */
export type CardBox = { x: number; y: number; w: number; h: number }

/** Desktop: lines and labels, drawn in the phone's coordinate space so they
 *  zoom with it. `phoneW` is the phone's unscaled width. */
export function CalloutLines({ p, parts, from, step, card, phoneW, ns, opacity }: { p: MotionValue<number>; parts: Part[]; from: number; step: number; card: CardBox; phoneW: number; ns: "stamp" | "coupon"; opacity?: MotionValue<number> }) {
  const t = useTranslations("gallery")
  const cs = useCallouts(p, from, step)
  if (parts.length > MAX_PARTS) throw new Error(`Callouts supports at most ${MAX_PARTS} parts`)
  const gap = 18
  const labelW = 170
  const labelX = phoneW + gap
  const boxW = labelX + labelW
  const boxH = card.y + card.h + 40
  return (
    <motion.div aria-hidden="true" style={{ opacity, width: boxW, height: boxH }} className="pointer-events-none absolute left-0 top-0 hidden lg:block">
      <svg className="absolute inset-0" width={boxW} height={boxH} viewBox={`0 0 ${boxW} ${boxH}`}>
        {parts.map((part, i) => {
          const tx = card.x + part.tx * card.w
          const ty = card.y + part.ty * card.h
          const ly = card.y + ((i + 0.5) / parts.length) * card.h
          return (
            <g key={part.key}>
              <motion.line x1={labelX - 6} y1={ly} x2={tx} y2={ty} stroke={INK} strokeWidth="1" strokeOpacity="0.45" style={{ pathLength: cs[i].draw, opacity: cs[i].o }} />
              <motion.circle cx={tx} cy={ty} r="4" fill={CORAL} style={{ scale: cs[i].draw, opacity: cs[i].o }} />
            </g>
          )
        })}
      </svg>
      {parts.map((part, i) => (
        <motion.p
          key={part.key}
          style={{ opacity: cs[i].o, x: cs[i].x, top: card.y + ((i + 0.5) / parts.length) * card.h, left: labelX, width: labelW }}
          className="absolute -translate-y-1/2 text-[13px] leading-snug"
        >
          <span style={{ color: "var(--mk-text)" }}>{t(`${ns}.parts.${part.key}`)}</span>
        </motion.p>
      ))}
    </motion.div>
  )
}

/** Phones: the parts as a list under the caption. */
export function CalloutList({ p, parts, from, step, ns }: { p: MotionValue<number>; parts: Part[]; from: number; step: number; ns: "stamp" | "coupon" }) {
  const t = useTranslations("gallery")
  const cs = useCallouts(p, from, step)
  return (
    <ul className="mt-3 flex flex-col items-center gap-1.5 lg:hidden">
      {parts.map((part, i) => (
        <motion.li key={part.key} style={{ opacity: cs[i].o, y: cs[i].x }} className="mk-body-sm flex items-center justify-center gap-2">
          <span className="size-1.5 rounded-full" style={{ background: CORAL }} aria-hidden="true" />
          <span style={{ color: "var(--mk-text)" }}>{t(`${ns}.parts.${part.key}`)}</span>
        </motion.li>
      ))}
    </ul>
  )
}

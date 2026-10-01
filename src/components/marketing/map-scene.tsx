"use client"

import Image from "next/image"
import { motion, useTransform, type MotionValue } from "motion/react"
import { CORAL } from "./tokens"

// A real map behind the phone for "it shows up when they are nearby": an
// Apple Maps capture (dark, a few blocks around Hill St and Union Ave),
// with the business as a pin and its dashed geofence, and the customer as
// a location dot walking down Union Ave, turning onto Hill St and into the
// fence. The walk is a scroll value: `walk` goes 0 → 1 across the chapter;
// `pulse` rings the fence when they cross it. The overlay is drawn in the
// capture's own pixel space (1392 × 1044) so it stays on the streets.

const W = 1392
const H = 1044
const DOT = "#ffffff"
const DOT_CORE = "#1F1410"

// The customer's route: along Union Ave, the corner with Hill St, then up
// Hill St to the business.
const ROUTE: Array<[number, number]> = [
  [108, 242],
  [545, 540],
  [660, 382],
]
const PIN: [number, number] = [778, 280]
const FENCE_R = 210

function along(t: number): [number, number] {
  const lens: number[] = []
  let total = 0
  for (let i = 1; i < ROUTE.length; i++) {
    const [x0, y0] = ROUTE[i - 1]
    const [x1, y1] = ROUTE[i]
    const l = Math.hypot(x1 - x0, y1 - y0)
    lens.push(l)
    total += l
  }
  let d = Math.max(0, Math.min(1, t)) * total
  for (let i = 1; i < ROUTE.length; i++) {
    const l = lens[i - 1]
    if (d <= l) {
      const [x0, y0] = ROUTE[i - 1]
      const [x1, y1] = ROUTE[i]
      const k = l === 0 ? 0 : d / l
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]
    }
    d -= l
  }
  return ROUTE[ROUTE.length - 1]
}

export function MapScene({ walk, pulse, label, className, style }: { walk: MotionValue<number>; pulse: MotionValue<number>; /** The business's name under the pin. */ label: string; className?: string; style?: React.CSSProperties }) {
  const cx = useTransform(walk, (t) => along(t)[0])
  const cy = useTransform(walk, (t) => along(t)[1])
  const pulseR = useTransform(pulse, [0, 1], [FENCE_R * 0.2, FENCE_R * 1.35])
  const pulseO = useTransform(pulse, [0, 0.15, 1], [0, 0.6, 0])

  return (
    <div className={className} style={{ ...style, position: "relative", aspectRatio: `${W} / ${H}`, borderRadius: 28, overflow: "hidden" }} aria-hidden="true">
      <Image src="/hero/map.webp" alt="" fill sizes="(max-width: 1023px) 420px, 480px" className="object-cover" />
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        {/* the geofence */}
        <circle cx={PIN[0]} cy={PIN[1]} r={FENCE_R} fill={CORAL} fillOpacity="0.14" stroke={CORAL} strokeOpacity="0.75" strokeWidth="4" strokeDasharray="12 14" />
        <motion.circle cx={PIN[0]} cy={PIN[1]} r={pulseR} fill="none" stroke={CORAL} strokeWidth="4" style={{ opacity: pulseO }} />

        {/* the business: a pin with its name */}
        <ellipse cx={PIN[0]} cy={PIN[1] + 6} rx="20" ry="8" fill="#000" fillOpacity="0.35" />
        <path d={`M${PIN[0]} ${PIN[1]} c-26 -30 -40 -46 -40 -70 a40 40 0 1 1 80 0 c0 24 -14 40 -40 70z`} fill={CORAL} />
        <circle cx={PIN[0]} cy={PIN[1] - 70} r="17" fill="#fff" />
        {/* a cup */}
        <path d={`M${PIN[0] - 9} ${PIN[1] - 76}h14v10a7 7 0 0 1 -14 0z M${PIN[0] + 5} ${PIN[1] - 74}h4a3.5 3.5 0 0 1 0 7h-4`} fill={CORAL} stroke={CORAL} strokeWidth="1.5" />
        <text x={PIN[0]} y={PIN[1] + 44} textAnchor="middle" fontSize="28" fontWeight="600" fill="#fff" fontFamily="Inter, system-ui, sans-serif" stroke="#1b2130" strokeWidth="8" paintOrder="stroke">
          {label}
        </text>

        {/* the customer: a location dot with its halo */}
        <motion.circle cx={cx} cy={cy} r="48" fill={DOT} fillOpacity="0.16" />
        <motion.circle cx={cx} cy={cy} r="22" fill={DOT} />
        <motion.circle cx={cx} cy={cy} r="15" fill={DOT_CORE} />
      </svg>
    </div>
  )
}

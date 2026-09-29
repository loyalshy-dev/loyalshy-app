"use client"

import { motion, useTransform, type MotionValue } from "motion/react"

// A small town map behind the phone for "it shows up when they are nearby":
// blocks, streets, a park, the business pin with its geofence, and a
// customer walking along the street into the fence. The walk is a scroll
// value: `walk` goes 0 → 1 across the chapter.

const CORAL = "#FF6B47"
const INK = "#1F1410"

// The customer's route, in map units (viewBox 0 0 520 400)
const ROUTE: Array<[number, number]> = [
  [62, 352],
  [62, 236],
  [206, 236],
  [206, 176],
  [262, 176],
]
const PIN: [number, number] = [340, 176]
const FENCE_R = 92

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

export function MapScene({ walk, pulse, className, style }: { walk: MotionValue<number>; pulse: MotionValue<number>; className?: string; style?: React.CSSProperties }) {
  const cx = useTransform(walk, (t) => along(t)[0])
  const cy = useTransform(walk, (t) => along(t)[1])
  const pulseR = useTransform(pulse, [0, 1], [FENCE_R * 0.2, FENCE_R * 1.35])
  const pulseO = useTransform(pulse, [0, 0.15, 1], [0, 0.55, 0])

  const blocks: Array<[number, number, number, number]> = [
    [0, 0, 44, 218], [80, 0, 108, 96], [206, 0, 120, 96], [344, 0, 176, 96],
    [80, 114, 108, 104], [206, 114, 120, 44], [344, 114, 176, 44],
    [0, 254, 44, 146], [80, 254, 108, 146], [206, 194, 120, 24], [206, 254, 120, 146], [344, 194, 176, 24], [344, 254, 176, 146],
  ]

  return (
    <motion.svg viewBox="0 0 520 400" className={className} style={style} aria-hidden="true">
      <rect width="520" height="400" rx="22" fill="oklch(0.99 0.003 60)" />
      {blocks.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="7" fill="oklch(0.925 0.01 60)" />
      ))}
      {/* the park */}
      <rect x="80" y="114" width="108" height="104" rx="7" fill="oklch(0.9 0.04 140)" />
      {/* the geofence */}
      <circle cx={PIN[0]} cy={PIN[1]} r={FENCE_R} fill={CORAL} fillOpacity="0.08" stroke={CORAL} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="4 5" />
      <motion.circle cx={PIN[0]} cy={PIN[1]} r={pulseR} fill="none" stroke={CORAL} strokeWidth="1.5" style={{ opacity: pulseO }} />
      {/* the business */}
      <circle cx={PIN[0]} cy={PIN[1]} r="10" fill={CORAL} />
      <circle cx={PIN[0]} cy={PIN[1]} r="4" fill="#fff" />
      {/* the customer */}
      <motion.circle cx={cx} cy={cy} r="9" fill="#fff" />
      <motion.circle cx={cx} cy={cy} r="6" fill={INK} />
    </motion.svg>
  )
}

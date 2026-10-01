"use client"

import { motion, useTransform, type MotionValue } from "motion/react"
import { CORAL, INK } from "./tokens"

// A small town map behind the phone for "it shows up when they are nearby",
// in the manner of Apple Maps: white streets on warm paper blocks with
// building footprints, a park with trees, a roundabout, the business as a
// pin with its name and dashed geofence, and the customer as a location dot
// walking along the street into the fence. The walk is a scroll value:
// `walk` goes 0 → 1 across the chapter; `pulse` rings the fence when they
// cross it.

const PAPER = "oklch(0.985 0.004 80)" // streets
const BLOCK = "oklch(0.945 0.012 78)"
const BLOCK_EDGE = "oklch(0.9 0.014 76)"
const BUILDING = "oklch(0.915 0.014 76)"
const PARK = "oklch(0.92 0.045 140)"
const TREE = "oklch(0.84 0.07 140)"
const LANE = "oklch(0.9 0.006 80)"

// The customer's route, in map units (viewBox 0 0 520 400): along the
// avenue, up the side street, then east to the business.
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

// Blocks [x, y, w, h] and the building footprints inside them [x, y, w, h].
const BLOCKS: Array<[number, number, number, number]> = [
  [0, 0, 44, 218], [80, 0, 108, 96], [206, 0, 120, 96], [344, 0, 86, 96], [448, 0, 72, 96],
  [206, 114, 120, 44], [344, 114, 86, 44], [448, 114, 72, 44],
  [0, 254, 44, 146], [80, 254, 108, 146], [206, 194, 120, 24], [206, 254, 120, 146], [344, 194, 86, 24], [448, 194, 72, 24], [344, 254, 86, 146], [448, 254, 72, 146],
]
const BUILDINGS: Array<[number, number, number, number]> = [
  [6, 8, 32, 40], [6, 60, 32, 56], [6, 128, 32, 36], [6, 172, 32, 38],
  [88, 8, 40, 36], [136, 8, 44, 28], [88, 52, 92, 36],
  [214, 8, 50, 40], [272, 8, 46, 40], [214, 56, 104, 32],
  [352, 8, 70, 80], [456, 8, 56, 36], [456, 52, 56, 36],
  [214, 120, 104, 32], [352, 120, 70, 32], [456, 120, 56, 32],
  [6, 262, 32, 60], [6, 330, 32, 62], [88, 262, 92, 44], [88, 314, 42, 78], [138, 314, 42, 78],
  [214, 262, 50, 60], [272, 262, 46, 60], [214, 330, 104, 62],
  [352, 262, 70, 40], [352, 310, 70, 82], [456, 262, 56, 130],
]
// Trees in the park (80, 114, 108, 104)
const TREES: Array<[number, number, number]> = [
  [100, 134, 9], [124, 128, 7], [150, 140, 10], [172, 130, 6], [96, 170, 7], [118, 186, 9], [146, 176, 6], [168, 196, 8], [136, 160, 5],
]

export function MapScene({ walk, pulse, label, className, style }: { walk: MotionValue<number>; pulse: MotionValue<number>; /** The business's name under the pin. */ label: string; className?: string; style?: React.CSSProperties }) {
  const cx = useTransform(walk, (t) => along(t)[0])
  const cy = useTransform(walk, (t) => along(t)[1])
  const pulseR = useTransform(pulse, [0, 1], [FENCE_R * 0.2, FENCE_R * 1.35])
  const pulseO = useTransform(pulse, [0, 0.15, 1], [0, 0.55, 0])

  return (
    <motion.svg viewBox="0 0 520 400" className={className} style={style} aria-hidden="true">
      <defs>
        <clipPath id="mk-map-clip">
          <rect width="520" height="400" rx="22" />
        </clipPath>
      </defs>
      <rect width="520" height="400" rx="22" fill={PAPER} />
      <g clipPath="url(#mk-map-clip)">
        {/* blocks with a curb */}
        {BLOCKS.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="5" fill={BLOCK} stroke={BLOCK_EDGE} strokeWidth="0.75" />
        ))}
        {/* building footprints */}
        {BUILDINGS.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="1.5" fill={BUILDING} />
        ))}
        {/* the park */}
        <rect x="80" y="114" width="108" height="104" rx="5" fill={PARK} stroke={BLOCK_EDGE} strokeWidth="0.75" />
        <path d="M80 166h108M134 114v104" stroke={PAPER} strokeWidth="4" strokeLinecap="round" />
        {TREES.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={TREE} />
        ))}
        {/* lane markings on the avenues */}
        <path d="M0 236h520" stroke={LANE} strokeWidth="1" strokeDasharray="7 7" />
        <path d="M197 0v400" stroke={LANE} strokeWidth="1" strokeDasharray="7 7" />
        {/* a roundabout where the avenues meet */}
        <circle cx="197" cy="236" r="22" fill={PAPER} />
        <circle cx="197" cy="236" r="9" fill={PARK} stroke={BLOCK_EDGE} strokeWidth="0.75" />
        <circle cx="197" cy="236" r="22" fill="none" stroke={LANE} strokeWidth="1" />

        {/* the geofence */}
        <circle cx={PIN[0]} cy={PIN[1]} r={FENCE_R} fill={CORAL} fillOpacity="0.07" stroke={CORAL} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="4 5" />
        <motion.circle cx={PIN[0]} cy={PIN[1]} r={pulseR} fill="none" stroke={CORAL} strokeWidth="1.5" style={{ opacity: pulseO }} />

        {/* the business: a pin with its name */}
        <ellipse cx={PIN[0]} cy={PIN[1] + 2} rx="7" ry="3" fill={INK} fillOpacity="0.18" />
        <path d={`M${PIN[0]} ${PIN[1]} c-9 -10 -14 -16 -14 -24 a14 14 0 1 1 28 0 c0 8 -5 14 -14 24z`} fill={CORAL} />
        <circle cx={PIN[0]} cy={PIN[1] - 24} r="6" fill="#fff" />
        {/* a cup */}
        <path d={`M${PIN[0] - 3} ${PIN[1] - 26}h5v3.5a2.5 2.5 0 0 1 -5 0z M${PIN[0] + 2} ${PIN[1] - 25.5}h1.3a1.2 1.2 0 0 1 0 2.4h-1.3`} fill={CORAL} stroke={CORAL} strokeWidth="0.6" />
        <text x={PIN[0]} y={PIN[1] + 16} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={INK} fontFamily="Inter, system-ui, sans-serif" stroke={PAPER} strokeWidth="3" paintOrder="stroke">
          {label}
        </text>

        {/* the customer: a location dot with its halo */}
        <motion.circle cx={cx} cy={cy} r="16" fill={INK} fillOpacity="0.1" />
        <motion.circle cx={cx} cy={cy} r="8" fill="#fff" />
        <motion.circle cx={cx} cy={cy} r="5.5" fill={INK} />
      </g>
    </motion.svg>
  )
}

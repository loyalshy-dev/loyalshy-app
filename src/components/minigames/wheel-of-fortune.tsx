"use client"

import { useState, useCallback, useMemo } from "react"

type WheelOfFortuneProps = {
  rewardText: string
  enrollmentId: string
  onReveal: () => void
  prizes?: string[]
  primaryColor?: string
  accentColor?: string
}

const SEGMENTS = 8
const SEGMENT_ANGLE = 360 / SEGMENTS
const DEFAULT_PRIMARY = "var(--brand)"
const DEFAULT_ACCENT = "oklch(0.85 0.03 250)"

const DEFAULT_LABELS = ["WIN", "TRY", "WIN", "SPIN", "WIN", "LUCK", "WIN", "GO"]

function hashToSegment(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  // Land on a "WIN" segment (0, 2, 4, 6)
  return [0, 2, 4, 6][Math.abs(hash) % 4]
}

function buildLabels(prizes: string[]): string[] {
  // Fill 8 segments by repeating prizes cyclically
  const labels: string[] = []
  for (let i = 0; i < SEGMENTS; i++) {
    labels.push(prizes[i % prizes.length])
  }
  return labels
}

function findWinSegment(labels: string[], rewardText: string): number {
  const idx = labels.findIndex((l) => l === rewardText)
  return idx >= 0 ? idx : 0
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label
  return label.slice(0, maxLen - 1) + "\u2026"
}

export function WheelOfFortune({ rewardText, enrollmentId, onReveal, prizes, primaryColor, accentColor }: WheelOfFortuneProps) {
  const [spinning, setSpinning] = useState(false)
  const [showReward, setShowReward] = useState(false)
  const [rotation, setRotation] = useState(0)

  const primary = primaryColor || DEFAULT_PRIMARY
  const accent = accentColor || DEFAULT_ACCENT
  const colors = useMemo(
    () => [primary, accent, primary, accent, primary, accent, primary, accent],
    [primary, accent],
  )

  const hasPrizes = prizes && prizes.length > 0
  const labels = useMemo(() => (hasPrizes ? buildLabels(prizes) : DEFAULT_LABELS), [hasPrizes, prizes])
  const winSegment = useMemo(
    () => (hasPrizes ? findWinSegment(labels, rewardText) : hashToSegment(enrollmentId)),
    [hasPrizes, labels, rewardText, enrollmentId],
  )

  const handleSpin = useCallback(() => {
    if (spinning) return
    setSpinning(true)

    // Calculate: pointer is at top (0deg), we need the win segment to land there
    const targetAngle = winSegment * SEGMENT_ANGLE + SEGMENT_ANGLE / 2
    const totalRotation = 1440 + (360 - targetAngle) // 4 full spins + offset
    setRotation(totalRotation)
  }, [spinning, winSegment])

  const handleTransitionEnd = useCallback(() => {
    setShowReward(true)
    onReveal()
  }, [onReveal])

  const size = 240
  const center = size / 2
  const radius = size / 2 - 4

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[280px] mx-auto">
      {/* Pointer triangle */}
      <div className="relative" style={{ width: size, height: size + 20 }}>
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 z-10"
          style={{
            width: 0,
            height: 0,
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderTop: `18px solid ${primary}`,
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))",
          }}
        />

        {/* Wheel */}
        <svg
          width={size}
          height={size}
          className="mt-5"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? "transform 2.5s cubic-bezier(0.2, 0, 0.1, 1)"
              : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {Array.from({ length: SEGMENTS }, (_, i) => {
            const startAngle = (i * SEGMENT_ANGLE - 90) * (Math.PI / 180)
            const endAngle = ((i + 1) * SEGMENT_ANGLE - 90) * (Math.PI / 180)
            const x1 = center + radius * Math.cos(startAngle)
            const y1 = center + radius * Math.sin(startAngle)
            const x2 = center + radius * Math.cos(endAngle)
            const y2 = center + radius * Math.sin(endAngle)
            const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0

            // Text position (middle of segment)
            const midAngle = ((i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2 - 90) * Math.PI) / 180
            const textR = radius * 0.65
            const tx = center + textR * Math.cos(midAngle)
            const ty = center + textR * Math.sin(midAngle)
            const textRotation = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2

            const displayLabel = hasPrizes ? truncateLabel(labels[i], 12) : labels[i]
            const fontSize = hasPrizes ? Math.min(11, Math.max(7, Math.floor(90 / displayLabel.length))) : 11

            return (
              <g key={i}>
                <path
                  d={`M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z`}
                  fill={colors[i]}
                  stroke="white"
                  strokeWidth={1.5}
                />
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={i % 2 === 0 ? "white" : primary}
                  fontSize={fontSize}
                  fontWeight={700}
                  transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                >
                  {displayLabel}
                </text>
              </g>
            )
          })}
          {/* Center circle */}
          <circle cx={center} cy={center} r={18} fill="white" stroke={primary} strokeWidth={2} />
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="central"
            fill={primary}
            fontSize={10}
            fontWeight={700}
          >
            {spinning ? "" : "TAP"}
          </text>
        </svg>

        {/* Click area — uses div to avoid nested-button issues in card previews */}
        {!spinning && (
          <div
            role="button"
            tabIndex={0}
            className="absolute inset-0 mt-5 rounded-full cursor-pointer"
            onClick={handleSpin}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSpin() } }}
            aria-label="Spin the wheel"
          />
        )}
      </div>

      {/* Reward text */}
      {showReward && (
        <div className="flex flex-col items-center gap-1 animate-[reward-reveal_0.4s_ease-out]">
          <p className="text-lg font-bold text-center" style={{ color: primary }}>
            {rewardText}
          </p>
        </div>
      )}
    </div>
  )
}

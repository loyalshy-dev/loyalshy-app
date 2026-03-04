"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Star,
  Gift,
  Trophy,
  Diamond,
  Crown,
  Sparkles,
  Heart,
  Clover,
} from "lucide-react"

type SlotMachineProps = {
  rewardText: string
  enrollmentId: string
  onReveal: () => void
  /** When false, user must tap to start. Defaults to true. */
  autoStart?: boolean
  primaryColor?: string
}

const ICONS = [Star, Gift, Trophy, Diamond, Crown, Sparkles, Heart, Clover]
const ICON_COUNT = ICONS.length
const REEL_ITEMS = 20 // total items per reel strip
const ITEM_SIZE = 56 // px per icon slot

function hashToIndex(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % ICON_COUNT
}

function buildReel(winIndex: number): number[] {
  const items: number[] = []
  for (let i = 0; i < REEL_ITEMS - 1; i++) {
    items.push(i % ICON_COUNT)
  }
  items.push(winIndex)
  return items
}

export function SlotMachine({ rewardText, enrollmentId, onReveal, autoStart = true, primaryColor }: SlotMachineProps) {
  const [spinning, setSpinning] = useState(false)
  const [stopped, setStopped] = useState([false, false, false])
  const [showReward, setShowReward] = useState(false)
  const revealed = useRef(false)
  const winIndex = useMemo(() => hashToIndex(enrollmentId), [enrollmentId])

  const reels = useMemo(
    () => [buildReel(winIndex), buildReel(winIndex), buildReel(winIndex)],
    [winIndex]
  )

  // Auto-start spin (only when autoStart is true)
  useEffect(() => {
    if (!autoStart) return
    const t = setTimeout(() => setSpinning(true), 300)
    return () => clearTimeout(t)
  }, [autoStart])

  // Staggered stop
  useEffect(() => {
    if (!spinning) return
    const timers = [
      setTimeout(() => setStopped((s) => [true, s[1], s[2]]), 800),
      setTimeout(() => setStopped((s) => [s[0], true, s[2]]), 1300),
      setTimeout(() => {
        setStopped([true, true, true])
      }, 1800),
    ]
    return () => timers.forEach(clearTimeout)
  }, [spinning])

  // Show reward after all reels stop
  useEffect(() => {
    if (stopped[0] && stopped[1] && stopped[2] && !revealed.current) {
      revealed.current = true
      const t = setTimeout(() => {
        setShowReward(true)
        onReveal()
      }, 400)
      return () => clearTimeout(t)
    }
  }, [stopped, onReveal])

  const WinIcon = ICONS[winIndex]

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[280px] mx-auto">
      {/* Slot machine housing */}
      <div
        className="relative flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 shadow-sm w-full"
        onClick={() => { if (!spinning && !autoStart) setSpinning(true) }}
      >
        {reels.map((reel, reelIdx) => (
          <div
            key={reelIdx}
            className="relative overflow-hidden rounded-lg border border-border bg-muted/30"
            style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
          >
            <div
              className="flex flex-col"
              style={{
                transform: spinning
                  ? stopped[reelIdx]
                    ? `translateY(-${(REEL_ITEMS - 1) * ITEM_SIZE}px)`
                    : undefined
                  : "translateY(0)",
                transition: stopped[reelIdx]
                  ? `transform ${0.8 + reelIdx * 0.25}s cubic-bezier(0.2, 0, 0.2, 1)`
                  : "none",
                animation:
                  spinning && !stopped[reelIdx]
                    ? `slot-spin 0.15s linear infinite`
                    : undefined,
                // @ts-expect-error CSS custom property
                "--slot-offset": `-${ICON_COUNT * ITEM_SIZE}px`,
              }}
            >
              {reel.map((iconIdx, i) => {
                const Icon = ICONS[iconIdx]
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center shrink-0"
                    style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
                  >
                    <Icon className="size-7" style={{ color: primaryColor || "var(--brand)" }} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Tap to start overlay */}
        {!autoStart && !spinning && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/60 backdrop-blur-[1px] cursor-pointer">
            <p className="text-xs font-medium text-muted-foreground">Tap to spin</p>
          </div>
        )}
      </div>

      {/* Reward text */}
      {showReward && (
        <div className="flex flex-col items-center gap-1.5 animate-[reward-reveal_0.4s_ease-out]">
          <div className="flex items-center gap-2">
            <WinIcon className="size-5" style={{ color: primaryColor || "var(--brand)" }} />
            <WinIcon className="size-5" style={{ color: primaryColor || "var(--brand)" }} />
            <WinIcon className="size-5" style={{ color: primaryColor || "var(--brand)" }} />
          </div>
          <p className="text-lg font-bold text-center" style={{ color: primaryColor || "var(--brand)" }}>
            {rewardText}
          </p>
        </div>
      )}
    </div>
  )
}

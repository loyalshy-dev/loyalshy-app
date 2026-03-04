"use client"

import { useState, useCallback, useRef } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScratchCard } from "./scratch-card"
import { SlotMachine } from "./slot-machine"
import { WheelOfFortune } from "./wheel-of-fortune"

type MinigameStepProps = {
  gameType: "scratch" | "slots" | "wheel"
  rewardText: string
  enrollmentId: string
  prizes?: string[]
  primaryColor?: string
  accentColor?: string
  onComplete: () => void
  onSkip: () => void
}

export function MinigameStep({
  gameType,
  rewardText,
  enrollmentId,
  prizes,
  primaryColor,
  accentColor,
  onComplete,
  onSkip,
}: MinigameStepProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleReveal = useCallback(() => {
    // After game reveals, wait 1.5s then call onComplete
    completeTimer.current = setTimeout(() => {
      onComplete()
    }, 1500)
  }, [onComplete])

  const handleSkip = useCallback(() => {
    if (completeTimer.current) clearTimeout(completeTimer.current)
    if (dontShowAgain) {
      try {
        localStorage.setItem(`minigame-dismissed:${enrollmentId}`, "1")
      } catch {
        // localStorage unavailable
      }
    }
    onSkip()
  }, [dontShowAgain, enrollmentId, onSkip])

  return (
    <div className="flex flex-col items-center py-6 px-4 animate-[minigame-fade-in_0.3s_ease-out]">
      {/* Skip button */}
      <div className="self-end -mt-2 -mr-1 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs gap-1 h-7"
          onClick={handleSkip}
        >
          Skip
          <X className="size-3" />
        </Button>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-muted-foreground mb-4">
        {gameType === "scratch"
          ? "Scratch to reveal your reward!"
          : gameType === "slots"
            ? "Spinning for your reward..."
            : "Tap to spin the wheel!"}
      </p>

      {/* Game */}
      {gameType === "scratch" && (
        <ScratchCard rewardText={rewardText} onReveal={handleReveal} primaryColor={primaryColor} accentColor={accentColor} />
      )}
      {gameType === "slots" && (
        <SlotMachine
          rewardText={rewardText}
          enrollmentId={enrollmentId}
          onReveal={handleReveal}
          primaryColor={primaryColor}
        />
      )}
      {gameType === "wheel" && (
        <WheelOfFortune
          rewardText={rewardText}
          enrollmentId={enrollmentId}
          onReveal={handleReveal}
          prizes={prizes}
          primaryColor={primaryColor}
          accentColor={accentColor}
        />
      )}

      {/* Don't show again checkbox */}
      <label className="flex items-center gap-2 mt-6 cursor-pointer">
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => setDontShowAgain(e.target.checked)}
          className="size-3.5 accent-foreground rounded"
        />
        <span className="text-[11px] text-muted-foreground">
          Don&apos;t show again for this card
        </span>
      </label>
    </div>
  )
}

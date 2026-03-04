"use client"

import { useRef, useEffect, useCallback, useState } from "react"

type ScratchCardProps = {
  rewardText: string
  onReveal: () => void
  primaryColor?: string
  accentColor?: string
}

const REVEAL_THRESHOLD = 0.45

export function ScratchCard({ rewardText, onReveal, primaryColor, accentColor }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)
  const revealed = useRef(false)
  const [isRevealed, setIsRevealed] = useState(false)

  const getScaledPos = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      return {
        x: (clientX - rect.left) * dpr,
        y: (clientY - rect.top) * dpr,
      }
    },
    []
  )

  const checkReveal = useCallback(() => {
    if (revealed.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let transparent = 0
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] === 0) transparent++
    }
    const total = imageData.data.length / 4
    if (transparent / total >= REVEAL_THRESHOLD) {
      revealed.current = true
      // Clear remaining overlay
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setIsRevealed(true)
      onReveal()
    }
  }, [onReveal])

  const scratch = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const pos = getScaledPos(clientX, clientY)
      if (!pos) return

      ctx.globalCompositeOperation = "destination-out"
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 28 * (window.devicePixelRatio || 1), 0, Math.PI * 2)
      ctx.fill()
    },
    [getScaledPos]
  )

  // Initialize canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Overlay gradient (silver by default, or tinted with accentColor)
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    if (accentColor) {
      gradient.addColorStop(0, accentColor)
      gradient.addColorStop(0.5, accentColor)
      gradient.addColorStop(1, accentColor)
    } else {
      gradient.addColorStop(0, "#c0c0c0")
      gradient.addColorStop(0.3, "#d8d8d8")
      gradient.addColorStop(0.5, "#b0b0b0")
      gradient.addColorStop(0.7, "#d0d0d0")
      gradient.addColorStop(1, "#a8a8a8")
    }
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // "Scratch here" text
    ctx.fillStyle = "#888"
    ctx.font = `${14 * dpr}px system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("Scratch to reveal!", canvas.width / 2, canvas.height / 2)
  }, [accentColor])

  // Pointer event handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDrawing.current = true
      scratch(e.clientX, e.clientY)
    },
    [scratch]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current) return
      scratch(e.clientX, e.clientY)
    },
    [scratch]
  )

  const handlePointerUp = useCallback(() => {
    isDrawing.current = false
    checkReveal()
  }, [checkReveal])

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[280px] mx-auto rounded-xl overflow-hidden select-none"
      style={{ aspectRatio: "5 / 3" }}
    >
      {/* Reward underneath */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl border transition-all duration-500 ${
          isRevealed ? "animate-[reward-reveal_0.4s_ease-out]" : ""
        } ${primaryColor ? "" : "bg-gradient-to-br from-brand/10 to-brand/5 border-brand/20"}`}
        style={primaryColor ? { background: `linear-gradient(to bottom right, ${primaryColor}1a, ${primaryColor}0d)`, borderColor: `${primaryColor}33` } : undefined}
      >
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          You won
        </p>
        <p className="text-lg font-bold text-center px-4" style={primaryColor ? { color: primaryColor } : undefined}>
          {primaryColor ? rewardText : <span className="text-brand">{rewardText}</span>}
        </p>
      </div>

      {/* Scratch overlay canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-pointer"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  )
}

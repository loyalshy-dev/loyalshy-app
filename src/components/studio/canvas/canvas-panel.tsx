"use client"

import { useState } from "react"
import type { PreviewFormat, DeviceFrame } from "@/types/editor"
import { WalletPassRenderer, type WalletPassDesign } from "@/components/wallet-pass-renderer"
import { DeviceFrameWrapper } from "./device-frame"

type PreviewState = "in-progress" | "almost-done" | "completed"

const PREVIEW_STATES: { id: PreviewState; label: string }[] = [
  { id: "in-progress", label: "In Progress" },
  { id: "almost-done", label: "Almost Done" },
  { id: "completed", label: "Completed" },
]

type CanvasPanelProps = {
  design: WalletPassDesign
  format: PreviewFormat
  deviceFrame: DeviceFrame
  restaurantName: string
  restaurantLogo: string | null
  programName: string
  visitsRequired: number
  rewardDescription: string
}

export function CanvasPanel({
  design,
  format,
  deviceFrame,
  restaurantName,
  restaurantLogo,
  programName,
  visitsRequired,
  rewardDescription,
}: CanvasPanelProps) {
  const [previewState, setPreviewState] = useState<PreviewState>("in-progress")

  const currentVisits =
    previewState === "completed"
      ? visitsRequired
      : previewState === "almost-done"
        ? visitsRequired - 1
        : Math.min(4, Math.floor(visitsRequired * 0.4))

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--muted)",
        backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        overflow: "auto",
        padding: 32,
        gap: 16,
      }}
    >
      {/* Preview state toggle */}
      <div
        style={{
          display: "flex",
          gap: 4,
          backgroundColor: "var(--background)",
          borderRadius: 8,
          padding: 3,
          border: "1px solid var(--border)",
        }}
      >
        {PREVIEW_STATES.map((state) => (
          <button
            key={state.id}
            onClick={() => setPreviewState(state.id)}
            aria-pressed={previewState === state.id}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              backgroundColor: previewState === state.id ? "var(--primary)" : "transparent",
              color: previewState === state.id ? "var(--primary-foreground)" : "var(--muted-foreground)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: previewState === state.id ? 600 : 400,
              transition: "all 0.15s ease",
            }}
          >
            {state.label}
          </button>
        ))}
      </div>

      <DeviceFrameWrapper frame={deviceFrame}>
        <WalletPassRenderer
          design={design}
          format={format}
          restaurantName={restaurantName}
          logoUrl={restaurantLogo}
          programName={programName}
          currentVisits={currentVisits}
          totalVisits={visitsRequired}
          rewardDescription={rewardDescription}
          customerName="Jane D."
          hasReward={previewState === "completed"}
        />
      </DeviceFrameWrapper>
    </div>
  )
}

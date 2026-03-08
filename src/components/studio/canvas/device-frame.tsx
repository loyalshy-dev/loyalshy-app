"use client"

import type { DeviceFrame } from "@/types/editor"

type DeviceFrameWrapperProps = {
  frame: DeviceFrame
  children: React.ReactNode
  /** When true, skip frame border-radius (e.g., for event ticket cards) */
  squareCorners?: boolean
}

export function DeviceFrameWrapper({ frame, children, squareCorners }: DeviceFrameWrapperProps) {
  if (frame === "none") {
    return <>{children}</>
  }

  if (frame === "minimal") {
    return (
      <div
        style={{
          borderRadius: squareCorners ? 0 : 8,
          boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    )
  }

  // iPhone / Pixel frame
  const isIphone = frame === "iphone"
  const frameColor = isIphone ? "#1a1a1a" : "#e5e5e5"
  const frameRadius = isIphone ? 44 : 32

  return (
    <div
      style={{
        padding: isIphone ? "48px 12px 40px" : "32px 12px 32px",
        borderRadius: frameRadius,
        backgroundColor: frameColor,
        position: "relative",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      {/* Notch / Camera (iPhone) */}
      {isIphone && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 28,
            borderRadius: 14,
            backgroundColor: "#000",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: 20,
              top: "50%",
              transform: "translateY(-50%)",
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#1a1a2e",
              border: "1.5px solid #333",
            }}
          />
        </div>
      )}

      {/* Camera (Pixel) */}
      {!isIphone && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#bbb",
          }}
        />
      )}

      <div style={{ borderRadius: squareCorners ? 0 : isIphone ? 32 : 20, overflow: "hidden" }}>
        {children}
      </div>

      {/* Home indicator (iPhone) */}
      {isIphone && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 100,
            height: 4,
            borderRadius: 2,
            backgroundColor: "#555",
          }}
        />
      )}
    </div>
  )
}

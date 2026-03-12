"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import type { ColorZone } from "@/types/editor"
import type { PreviewFormat } from "@/types/editor"

// ─── Strip geometry (must match wallet-pass-renderer) ───────

const HEADER_HEIGHT = 62

function getStripHeight(format: PreviewFormat, isTicket: boolean): number {
  if (isTicket && format === "apple") return 100
  if (format === "apple") return 130
  return 125
}

type StripZone = { top: number; height: number }

function getStripZone(
  format: PreviewFormat,
  showStrip: boolean,
  cardType: string,
  cardHeight: number,
): StripZone | null {
  if (!showStrip) return null
  const isTicket = cardType === "TICKET"
  const h = getStripHeight(format, isTicket)
  if (format === "apple") return { top: HEADER_HEIGHT, height: h }
  return { top: cardHeight - h, height: h }
}

// ─── Wrapper Component ─────────────────────────────────────

type Props = {
  store?: CardDesignStoreApi
  format: PreviewFormat
  showStrip: boolean
  cardType: string
  cardHeight: number
  isFlipped: boolean
  children: React.ReactNode
}

export function InteractiveCardWrapper({
  store,
  format,
  showStrip,
  cardType,
  cardHeight,
  isFlipped,
  children,
}: Props) {
  // When no store or flipped, just render children in a plain div
  if (!store || isFlipped) {
    return <div style={{ position: "relative" }}>{children}</div>
  }

  return (
    <InteractiveLayer
      store={store}
      format={format}
      showStrip={showStrip}
      cardType={cardType}
      cardHeight={cardHeight}
    >
      {children}
    </InteractiveLayer>
  )
}

// ─── Interactive Layer (click delegation + visual highlights) ─

function InteractiveLayer({
  store,
  format,
  showStrip,
  cardType,
  cardHeight,
  children,
}: {
  store: CardDesignStoreApi
  format: PreviewFormat
  showStrip: boolean
  cardType: string
  cardHeight: number
  children: React.ReactNode
}) {
  const selectedZone = useStore(store, (s) => s.ui.selectedColorZone)
  const [hoveredOverlay, setHoveredOverlay] = useState<"strip" | "background" | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const stripZone = getStripZone(format, showStrip, cardType, cardHeight)
  const isGoogle = format === "google"

  // Check if a Y position is inside the strip zone
  const isInStrip = useCallback(
    (clientY: number): boolean => {
      if (!stripZone || !wrapperRef.current) return false
      const rect = wrapperRef.current.getBoundingClientRect()
      const relY = clientY - rect.top
      return relY >= stripZone.top && relY <= stripZone.top + stripZone.height
    },
    [stripZone],
  )

  // Click handler on the wrapper — event delegation
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement

      const state = store.getState()

      // Clear menu tool when clicking card zones directly
      if (state.ui.activeTool) state.setActiveTool(null)

      // Check if avatar was clicked — open avatar tool
      const avatarEl = target.closest<HTMLElement>("[data-avatar-zone]")
      if (avatarEl) {
        state.setSelectedColorZone(null)
        state.setActiveTool(state.ui.activeTool === "avatar" ? null : "avatar")
        return
      }

      // Check if logo was clicked — open logo tool
      const logoEl = target.closest<HTMLElement>("[data-logo-zone]")
      if (logoEl) {
        state.setSelectedColorZone(null)
        state.setActiveTool(state.ui.activeTool === "logo" ? null : "logo")
        return
      }

      // Check if a [data-color-zone] element was clicked
      const zoneEl = target.closest<HTMLElement>("[data-color-zone]")
      if (zoneEl) {
        const zone = zoneEl.dataset.colorZone as ColorZone
        const resolved = zone === "labels" && isGoogle ? "text" : zone
        state.setSelectedColorZone(resolved === selectedZone ? null : resolved)
        return
      }

      // Check strip zone
      if (isInStrip(e.clientY)) {
        state.setSelectedColorZone(selectedZone === "strip" ? null : "strip")
        return
      }

      // Background
      state.setSelectedColorZone(selectedZone === "background" ? null : "background")
    },
    [store, selectedZone, isGoogle, isInStrip],
  )

  // Mouse move for strip/background hover (field hover is CSS-only)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-color-zone]") || target.closest("[data-avatar-zone]") || target.closest("[data-logo-zone]")) {
        setHoveredOverlay(null)
        return
      }
      setHoveredOverlay(isInStrip(e.clientY) ? "strip" : "background")
    },
    [isInStrip],
  )

  // Sync .zone-active class on [data-color-zone] elements
  useEffect(() => {
    const root = wrapperRef.current
    if (!root) return
    root.querySelectorAll("[data-color-zone].zone-active").forEach((el) => {
      el.classList.remove("zone-active")
    })
    if (selectedZone && selectedZone !== "background" && selectedZone !== "strip") {
      root.querySelectorAll(`[data-color-zone="${selectedZone}"]`).forEach((el) => {
        el.classList.add("zone-active")
      })
    }
  }, [selectedZone])

  return (
    <div
      ref={wrapperRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredOverlay(null)}
      style={{ position: "relative", cursor: "pointer" }}
    >
      {/* Hover + active CSS for [data-color-zone] elements */}
      <style>{`
        [data-color-zone] {
          cursor: pointer;
          border-radius: 3px;
          transition: outline 0.12s ease, background-color 0.12s ease;
          outline: 1.5px solid transparent;
          outline-offset: 2px;
        }
        [data-color-zone]:hover {
          outline: 1.5px dashed rgba(99, 102, 241, 0.5);
          background-color: rgba(99, 102, 241, 0.06);
        }
        [data-color-zone].zone-active {
          outline: 1.5px solid rgba(99, 102, 241, 0.7);
          background-color: rgba(99, 102, 241, 0.08);
        }
        [data-avatar-zone],
        [data-logo-zone] {
          transition: box-shadow 0.15s ease, transform 0.15s ease;
        }
        [data-avatar-zone]:hover,
        [data-logo-zone]:hover {
          box-shadow: 0 2px 12px rgba(0,0,0,0.2), 0 0 0 2px rgba(99, 102, 241, 0.6) !important;
          transform: scale(1.05);
        }
      `}</style>

      {children}

      {/* Visual-only overlay for background + strip highlights (pointer-events: none) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {/* Background highlight */}
        <ZoneHighlight
          active={selectedZone === "background"}
          hovered={hoveredOverlay === "background" && selectedZone !== "background"}
        />

        {/* Strip highlight */}
        {stripZone && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: stripZone.top,
              height: stripZone.height,
            }}
          >
            <ZoneHighlight
              active={selectedZone === "strip"}
              hovered={hoveredOverlay === "strip" && selectedZone !== "strip"}
            />
            {(hoveredOverlay === "strip" || selectedZone === "strip") && (
              <ZoneBadge label="Strip" active={selectedZone === "strip"} />
            )}
          </div>
        )}

        {/* Background badge */}
        {hoveredOverlay === "background" && selectedZone !== "background" && (
          <ZoneBadge label="Background" active={false} />
        )}
        {selectedZone === "background" && hoveredOverlay !== "strip" && (
          <ZoneBadge label="Background" active />
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────

function ZoneHighlight({ active, hovered }: { active: boolean; hovered: boolean }) {
  if (!active && !hovered) return null

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 2,
        border: hovered && !active ? "1.5px dashed rgba(99, 102, 241, 0.4)" : "none",
        backgroundColor: active
          ? "rgba(99, 102, 241, 0.07)"
          : "rgba(99, 102, 241, 0.03)",
        pointerEvents: "none",
        transition: "all 0.15s ease",
      }}
    />
  )
}

function ZoneBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 4,
        right: 4,
        padding: "2px 6px",
        borderRadius: 4,
        backgroundColor: active ? "var(--primary)" : "rgba(0,0,0,0.6)",
        color: "#fff",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.03em",
        pointerEvents: "none",
        zIndex: 12,
      }}
    >
      {label}
    </div>
  )
}

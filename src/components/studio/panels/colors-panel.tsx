"use client"

import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { PALETTE_PRESETS, computeTextColor } from "@/lib/wallet/card-design"
import { blendColors } from "@/lib/wallet/apple/colors"
import type { ColorZone } from "@/types/editor"

// ─── WCAG Contrast Helpers ────────────────────────────────

function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "")
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  const toLinear = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function wcagLevel(ratio: number): { label: string; color: string } {
  if (ratio >= 7) return { label: "AAA", color: "#22c55e" }
  if (ratio >= 4.5) return { label: "AA", color: "#84cc16" }
  if (ratio >= 3) return { label: "AA Large", color: "#f59e0b" }
  return { label: "Fail", color: "#ef4444" }
}

// ─── Zone → Color mapping ──────────────────────────────────

const ZONE_CONFIG: { zone: ColorZone; label: string; description: string }[] = [
  { zone: "background", label: "Background", description: "Card background color" },
  { zone: "strip", label: "Strip / Accent", description: "Strip area and accents" },
  { zone: "text", label: "Field Values", description: "Text on the card" },
  { zone: "labels", label: "Labels", description: "Field label text (Apple only)" },
]

// ─── Component ────────────────────────────────────────────

type Props = { store: CardDesignStoreApi }

export function ColorsPanel({ store }: Props) {
  const primaryColor = useStore(store, (s) => s.wallet.primaryColor)
  const secondaryColor = useStore(store, (s) => s.wallet.secondaryColor)
  const textColor = useStore(store, (s) => s.wallet.textColor)
  const labelColor = useStore(store, (s) => s.wallet.labelColor)
  const autoTextColor = useStore(store, (s) => s.wallet.autoTextColor)
  const selectedZone = useStore(store, (s) => s.ui.selectedColorZone)
  const previewFormat = useStore(store, (s) => s.ui.previewFormat)

  const ratio = contrastRatio(primaryColor, textColor)
  const { label: wcagLabel, color: wcagColor } = wcagLevel(ratio)

  const isGoogle = previewFormat === "google"

  function getZoneColor(zone: ColorZone): string {
    switch (zone) {
      case "background": return primaryColor
      case "strip": return secondaryColor
      case "text": return textColor
      case "labels": return labelColor ?? blendColors(textColor, primaryColor, 0.3)
      case "logo": return primaryColor
      case "progress": return textColor
    }
  }

  function setZoneColor(zone: ColorZone, value: string) {
    const state = store.getState()
    switch (zone) {
      case "background":
        state.setWalletField("primaryColor", value)
        if (autoTextColor) {
          state.setWalletField("textColor", computeTextColor(value))
        }
        break
      case "strip":
        state.setWalletField("secondaryColor", value)
        break
      case "text":
        state.setWalletField("textColor", value)
        state.setWalletField("autoTextColor", false)
        break
      case "labels":
        state.setWalletField("labelColor", value)
        break
      case "logo":
      case "progress":
        break
    }
  }

  function selectZone(zone: ColorZone) {
    store.getState().setSelectedColorZone(selectedZone === zone ? null : zone)
  }

  function applyPreset(preset: (typeof PALETTE_PRESETS)[0]) {
    const state = store.getState()
    state.setWalletField("primaryColor", preset.primary)
    state.setWalletField("secondaryColor", preset.secondary)
    state.setWalletField("textColor", preset.text)
    state.setWalletField("palettePreset", preset.id)
  }

  function handleAutoTextToggle() {
    const state = store.getState()
    const newAuto = !autoTextColor
    state.setWalletField("autoTextColor", newAuto)
    if (newAuto) {
      state.setWalletField("textColor", computeTextColor(primaryColor))
    }
  }

  return (
    <div>
      {/* Hint */}
      <div
        style={{
          fontSize: 11,
          color: "var(--muted-foreground)",
          marginBottom: 12,
        }}
      >
        Click a color below or tap an area on the card preview to edit.
      </div>

      {/* Color zone rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
        {ZONE_CONFIG.map(({ zone, label, description }) => {
          const isSelected = selectedZone === zone
          const color = getZoneColor(zone)
          const isDisabled = zone === "labels" && isGoogle

          return (
            <div
              key={zone}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              onClick={() => !isDisabled && selectZone(zone)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                  e.preventDefault()
                  selectZone(zone)
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 12,
                border: "none",
                borderLeft: isSelected
                  ? "3px solid var(--primary)"
                  : "3px solid transparent",
                backgroundColor: isSelected ? "var(--accent)" : "transparent",
                cursor: isDisabled ? "default" : "pointer",
                opacity: isDisabled ? 0.4 : 1,
                transition: "all 0.12s ease",
                width: "100%",
                textAlign: "left",
              }}
              title={isDisabled ? "Google Wallet doesn't support custom label colors" : description}
            >
              {/* Color swatch */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: color,
                    border: "1px solid var(--border)",
                  }}
                />
                {/* Inline color input — overlaid on the swatch */}
                {!isDisabled && (
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      setZoneColor(zone, e.target.value)
                      if (!isSelected) store.getState().setSelectedColorZone(zone)
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer",
                      border: "none",
                    }}
                    aria-label={`Pick ${label} color`}
                  />
                )}
              </div>

              {/* Label + hex */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: isSelected ? 600 : 500, color: "var(--foreground)" }}>
                  {label}
                  {zone === "labels" && isGoogle && (
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 4 }}>
                      (Google: same as text)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                  {color.toUpperCase()}
                </div>
              </div>

              {/* Reset button for labels */}
              {zone === "labels" && labelColor && !isDisabled && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    store.getState().setWalletField("labelColor", null)
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 9999,
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    flexShrink: 0,
                  }}
                >
                  Auto
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* WCAG contrast */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderRadius: 12,
          backgroundColor: "var(--muted)",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Text contrast
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: wcagColor,
            padding: "4px 8px",
            borderRadius: 9999,
            border: `1px solid ${wcagColor}`,
          }}
        >
          {wcagLabel} {ratio.toFixed(1)}:1
        </span>
      </div>

      {/* Auto text color toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderRadius: 12,
          backgroundColor: "var(--muted)",
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "var(--foreground)" }}>Auto text color</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Compute from background</div>
        </div>
        <button
          onClick={handleAutoTextToggle}
          aria-pressed={autoTextColor}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            backgroundColor: autoTextColor ? "var(--primary)" : "var(--muted-foreground)",
            position: "relative",
            transition: "background-color 0.15s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: autoTextColor ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: "#fff",
              transition: "left 0.15s",
            }}
          />
        </button>
      </div>

      {/* Palette presets */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        Presets
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {PALETTE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            title={preset.name}
            style={{
              height: 32,
              borderRadius: 10,
              border: "2px solid transparent",
              cursor: "pointer",
              background: `linear-gradient(135deg, ${preset.primary} 50%, ${preset.secondary} 100%)`,
            }}
            aria-label={`Apply ${preset.name} palette`}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginTop: 4 }}>
        {PALETTE_PRESETS.map((preset) => (
          <div
            key={preset.id}
            style={{ fontSize: 9, textAlign: "center", color: "var(--muted-foreground)", lineHeight: 1.2 }}
          >
            {preset.name}
          </div>
        ))}
      </div>
    </div>
  )
}

"use client"

import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { PALETTE_PRESETS, computeTextColor } from "@/lib/wallet/card-design"

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

// ─── Helpers ────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: "var(--muted-foreground)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginTop: 20,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--foreground)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
          {value.toUpperCase()}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 28, height: 28, border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", padding: 1 }}
        />
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────

type Props = { store: CardDesignStoreApi }

export function ColorsPanel({ store }: Props) {
  const primaryColor = useStore(store, (s) => s.wallet.primaryColor)
  const secondaryColor = useStore(store, (s) => s.wallet.secondaryColor)
  const textColor = useStore(store, (s) => s.wallet.textColor)
  const autoTextColor = useStore(store, (s) => s.wallet.autoTextColor)

  const ratio = contrastRatio(primaryColor, textColor)
  const { label: wcagLabel, color: wcagColor } = wcagLevel(ratio)

  function setColor(key: "primaryColor" | "secondaryColor" | "textColor", value: string) {
    const state = store.getState()
    state.setWalletField(key, value)
    // When the user manually picks a text color, disable auto-computation
    if (key === "textColor") {
      state.setWalletField("autoTextColor", false)
    }
    // When primary changes and auto is on, recompute text color
    if (key === "primaryColor" && autoTextColor) {
      state.setWalletField("textColor", computeTextColor(value))
    }
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
      {/* WCAG badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderRadius: 6,
          backgroundColor: "var(--muted)",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Text contrast vs background
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: wcagColor,
            padding: "2px 6px",
            borderRadius: 4,
            border: `1px solid ${wcagColor}`,
          }}
        >
          {wcagLabel} {ratio.toFixed(1)}:1
        </span>
      </div>

      <SectionHeader>Colors</SectionHeader>

      <ColorRow label="Primary / Background" value={primaryColor} onChange={(v) => setColor("primaryColor", v)} />
      <ColorRow label="Secondary" value={secondaryColor} onChange={(v) => setColor("secondaryColor", v)} />
      <ColorRow label="Text" value={textColor} onChange={(v) => setColor("textColor", v)} />

      {/* Auto text color toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
          padding: "8px 10px",
          borderRadius: 6,
          backgroundColor: "var(--muted)",
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

      <SectionHeader>Palette Presets</SectionHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {PALETTE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            title={preset.name}
            style={{
              height: 32,
              borderRadius: 6,
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

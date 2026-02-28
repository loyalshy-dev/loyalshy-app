"use client"

import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import type { CardShape } from "@/lib/wallet/card-design"

const SHAPES: { id: CardShape; name: string; description: string }[] = [
  { id: "CLEAN", name: "Clean", description: "No strip image. Progress, reward, visits, and member info fields." },
  { id: "SHOWCASE", name: "Showcase", description: "Large strip/hero image. Progress overlaid on image. Fewer fields." },
  { id: "INFO_RICH", name: "Info Rich", description: "Strip image + extra fields. Member number, visits, since date." },
]

type Props = { store: CardDesignStoreApi }

export function ShapePanel({ store }: Props) {
  const shape = useStore(store, (s) => s.wallet.shape)

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
        Shape determines the field layout on the wallet pass — how fields are arranged and whether a strip image is shown.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SHAPES.map((s) => (
          <button
            key={s.id}
            onClick={() => store.getState().setWalletField("shape", s.id)}
            aria-pressed={shape === s.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "12px 14px",
              borderRadius: 8,
              border: `2px solid ${shape === s.id ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: shape === s.id ? "var(--accent)" : "transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: shape === s.id ? 600 : 500, color: "var(--foreground)" }}>
                {s.name}
              </span>
              {shape === s.id && (
                <span style={{ fontSize: 12, color: "var(--primary)" }}>✓</span>
              )}
            </div>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
              {s.description}
            </span>
            {/* Mini field layout diagram */}
            <ShapeDiagram shape={s.id} active={shape === s.id} />
          </button>
        ))}
      </div>
    </div>
  )
}

function ShapeDiagram({ shape, active }: { shape: CardShape; active: boolean }) {
  const fg = active ? "var(--primary)" : "var(--muted-foreground)"
  const bg = active ? "var(--primary)" : "var(--border)"

  return (
    <div
      style={{
        marginTop: 4,
        width: "100%",
        height: 64,
        borderRadius: 6,
        border: `1px solid ${bg}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontSize: 8,
        color: fg,
        opacity: active ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div style={{ padding: "3px 6px", display: "flex", alignItems: "center", gap: 3 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", border: `1px solid ${fg}` }} />
        <span>Restaurant</span>
      </div>

      {/* Strip (SHOWCASE / INFO_RICH) */}
      {(shape === "SHOWCASE" || shape === "INFO_RICH") && (
        <div
          style={{
            height: 16,
            backgroundColor: `color-mix(in oklch, ${fg} 10%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 7, opacity: 0.5 }}>strip image</span>
        </div>
      )}

      {/* Fields */}
      <div style={{ flex: 1, padding: "2px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Progress</span>
          <span>Reward</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {shape === "INFO_RICH" && <span>Visits</span>}
          {shape !== "SHOWCASE" && <span>Since</span>}
          <span>Name</span>
        </div>
      </div>
    </div>
  )
}

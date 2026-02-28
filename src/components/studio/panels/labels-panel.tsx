"use client"

import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { formatLabel, type LabelFormat } from "@/lib/wallet/card-design"

const LABEL_FORMATS: { id: LabelFormat; name: string }[] = [
  { id: "UPPERCASE", name: "UPPERCASE" },
  { id: "TITLE_CASE", name: "Title Case" },
  { id: "LOWERCASE", name: "lowercase" },
]

const PREVIEW_LABELS = ["Next Reward", "Progress", "Member Since", "Visits"]

type Props = { store: CardDesignStoreApi }

export function LabelsPanel({ store }: Props) {
  const labelFormat = useStore(store, (s) => s.wallet.labelFormat)

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
        Controls how field labels are formatted on the wallet pass.
      </div>

      {/* Format selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {LABEL_FORMATS.map((fmt) => (
          <button
            key={fmt.id}
            onClick={() => store.getState().setWalletField("labelFormat", fmt.id)}
            aria-pressed={labelFormat === fmt.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: 8,
              border: `2px solid ${labelFormat === fmt.id ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: labelFormat === fmt.id ? "var(--accent)" : "transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: labelFormat === fmt.id ? 600 : 400, color: "var(--foreground)" }}>
              {fmt.name}
            </span>
            {labelFormat === fmt.id && (
              <span style={{ fontSize: 12, color: "var(--primary)" }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Live preview */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 16, marginBottom: 8 }}>
        Preview
      </div>
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 8,
          backgroundColor: "var(--muted)",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 16px",
        }}
      >
        {PREVIEW_LABELS.map((label) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", opacity: 0.6 }}>
              {formatLabel(label, labelFormat)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
              Value
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

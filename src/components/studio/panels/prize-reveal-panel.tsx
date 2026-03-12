"use client"

import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"

// ─── Prize Reveal (Minigame) Panel ──────────────────────────

export function PrizeRevealPanel({ store }: { store: CardDesignStoreApi }) {
  const enabled = useStore(store, (s) => s.programConfig.minigameEnabled)
  const gameType = useStore(store, (s) => s.programConfig.minigameType)
  const prizes = useStore(store, (s) => s.programConfig.minigamePrizes)
  const rewardDescription = useStore(store, (s) => s.programConfig.rewardDescription)
  const cardPrimary = useStore(store, (s) => s.wallet.primaryColor)
  const cardSecondary = useStore(store, (s) => s.wallet.secondaryColor)
  const set = store.getState().setConfigField

  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0)
  const filledPrizes = prizes.filter((p) => p.name.trim())
  const needsMorePrizes = enabled && filledPrizes.length < 2

  function addPrize() {
    if (prizes.length >= 8) return
    set("minigamePrizes", [...prizes, { name: "", weight: 1 }])
  }

  function updatePrize(index: number, field: "name" | "weight", value: string | number) {
    const updated = [...prizes]
    if (field === "name") {
      updated[index] = { ...updated[index], name: value as string }
    } else {
      updated[index] = { ...updated[index], weight: Math.max(1, Math.min(10, value as number)) }
    }
    set("minigamePrizes", updated)
  }

  function removePrize(index: number) {
    set("minigamePrizes", prizes.filter((_, i) => i !== index))
  }

  return (
    <div>
      {/* Reward description */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
          Reward description
        </div>
        <input
          value={rewardDescription}
          onChange={(e) => set("rewardDescription", e.target.value)}
          placeholder="Free coffee"
          maxLength={200}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 9999,
            border: "1px solid var(--border)",
            backgroundColor: "var(--background)",
            fontSize: 13,
            color: "var(--foreground)",
            outline: "none",
          }}
        />
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.4 }}>
          Shown on the card as the next reward. Used as fallback when no prizes are set.
        </div>
      </div>

      {/* Enable toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 0",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
            Reward reveal game
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.4 }}>
            {enabled && filledPrizes.length >= 2
              ? `${filledPrizes.length} prizes configured — ${filledPrizes.map((p) => p.name).join(", ")}`
              : "Show a fun minigame when customers earn a reward"}
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => set("minigameEnabled", !enabled)}
          style={{
            width: 38,
            height: 22,
            borderRadius: 9999,
            border: "none",
            backgroundColor: enabled ? "var(--primary)" : "var(--muted)",
            cursor: "pointer",
            position: "relative",
            flexShrink: 0,
            marginTop: 2,
            transition: "background-color 0.15s ease",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 9999,
              backgroundColor: "#fff",
              position: "absolute",
              top: 3,
              left: enabled ? 19 : 3,
              transition: "left 0.15s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Game type */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
              Game type
            </div>
            <select
              value={gameType}
              onChange={(e) => set("minigameType", e.target.value as "scratch" | "slots" | "wheel")}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                backgroundColor: "var(--background)",
                fontSize: 13,
                color: "var(--foreground)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="scratch">Scratch Card</option>
              <option value="slots">Slot Machine</option>
              <option value="wheel">Wheel of Fortune</option>
            </select>
          </div>

          {/* Prizes */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 4 }}>
              Prizes
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.4 }}>
              Add at least 2 prizes so the game feels rewarding. Weights (1–10) control probability.
            </div>

            {needsMorePrizes && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 12,
                  backgroundColor: "color-mix(in oklch, var(--warning) 10%, transparent)",
                  border: "1px solid color-mix(in oklch, var(--warning) 25%, transparent)",
                  marginBottom: 10,
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: "var(--foreground)",
                }}
              >
                <span style={{ flexShrink: 0, fontSize: 14, lineHeight: 1.2 }}>!</span>
                <span>
                  {filledPrizes.length === 0
                    ? `Add at least 2 prizes. Currently falls back to "${rewardDescription || "reward"}".`
                    : `Add one more prize — a single option doesn\u2019t make the game exciting.`}
                </span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {prizes.map((prize, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    value={prize.name}
                    onChange={(e) => updatePrize(i, "name", e.target.value)}
                    placeholder="e.g. Free Drink"
                    maxLength={100}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 9999,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--background)",
                      fontSize: 13,
                      color: "var(--foreground)",
                      outline: "none",
                    }}
                  />
                  <input
                    type="number"
                    value={prize.weight}
                    onChange={(e) => updatePrize(i, "weight", parseInt(e.target.value) || 1)}
                    min={1}
                    max={10}
                    style={{
                      width: 48,
                      padding: "8px 6px",
                      borderRadius: 9999,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--background)",
                      fontSize: 13,
                      color: "var(--foreground)",
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)", width: 36, textAlign: "right", flexShrink: 0 }}>
                    {totalWeight > 0 ? Math.round((prize.weight / totalWeight) * 100) : 0}%
                  </span>
                  <button
                    onClick={() => removePrize(i)}
                    style={{
                      padding: 4,
                      borderRadius: 9999,
                      border: "none",
                      background: "none",
                      color: "var(--muted-foreground)",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                    aria-label={`Remove prize ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {prizes.length < 8 && (
              <button
                onClick={addPrize}
                style={{
                  padding: "6px 14px",
                  borderRadius: 9999,
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--background)",
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                + Add prize
              </button>
            )}
          </div>

          {/* Game Colors (from Colors section) */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 4 }}>
              Game colors
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.4 }}>
              Uses your card&apos;s primary and accent colors from the Colors section.
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: cardPrimary,
                    border: "1px solid var(--border)",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Primary</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: cardSecondary,
                    border: "1px solid var(--border)",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Accent</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

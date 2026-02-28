"use client"

import React, { useState } from "react"
import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { CARD_TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/wallet/card-templates"
import type { CardTemplate, RestaurantCategory } from "@/lib/wallet/card-templates"

type Props = { store: CardDesignStoreApi }

export function TemplatePanel({ store }: Props) {
  const currentTemplateId = useStore(store, (s) => s.wallet.templateId)
  const [categoryFilter, setCategoryFilter] = useState<RestaurantCategory | "all">("all")

  // Filter templates
  const filtered = CARD_TEMPLATES.filter((t) => {
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false
    return true
  })

  function applyTemplate(template: CardTemplate) {
    const s = store.getState()
    s.applyTemplate({
      wallet: {
        shape: template.design.shape,
        primaryColor: template.design.primaryColor,
        secondaryColor: template.design.secondaryColor,
        textColor: template.design.textColor,
        patternStyle: template.design.patternStyle,
        progressStyle: template.design.progressStyle,
        labelFormat: template.design.labelFormat,
        palettePreset: template.design.palettePreset,
        templateId: template.id,
      },
    })
  }

  function startFromScratch() {
    const s = store.getState()
    s.applyTemplate({
      wallet: {
        shape: "CLEAN",
        primaryColor: "#1a1a2e",
        secondaryColor: "#ffffff",
        textColor: "#ffffff",
        patternStyle: "NONE",
        progressStyle: "NUMBERS",
        labelFormat: "UPPERCASE",
        palettePreset: null,
        templateId: null,
      },
    })
  }

  return (
    <div>
      {/* Category filter */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryFilter(c.id as RestaurantCategory | "all")}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              border: "none",
              backgroundColor: categoryFilter === c.id ? "var(--accent)" : "transparent",
              color: categoryFilter === c.id ? "var(--accent-foreground)" : "var(--muted-foreground)",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: categoryFilter === c.id ? 600 : 400,
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Start from scratch */}
      <button
        onClick={startFromScratch}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px dashed var(--border)",
          backgroundColor: "transparent",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 18 }}>+</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>
            Blank Card
          </div>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
            Start with default settings
          </div>
        </div>
      </button>

      {/* Template grid */}
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", margin: "0 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {filtered.length} template{filtered.length !== 1 ? "s" : ""}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {filtered.map((t) => {
          const isActive = currentTemplateId === t.id
          return (
            <button
              key={t.id}
              onClick={() => applyTemplate(t)}
              style={{
                borderRadius: 8,
                border: `2px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                backgroundColor: "var(--background)",
                cursor: "pointer",
                overflow: "hidden",
                padding: 0,
                textAlign: "left",
              }}
            >
              {/* Color swatch preview */}
              <div
                style={{
                  height: 48,
                  background: `linear-gradient(135deg, ${t.design.primaryColor}, ${t.design.secondaryColor})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 9, color: t.design.textColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.9 }}>
                  {t.design.shape}
                </span>
              </div>
              <div style={{ padding: "6px 8px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted-foreground)", marginTop: 1 }}>
                  {t.category}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useStore } from "zustand"
import { useTranslations } from "next-intl"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { computeTextColor, getFieldConfig } from "@/lib/wallet/card-design"
import { blendColors } from "@/lib/wallet/apple/colors"

// ─── WCAG helpers ────────────────────────────────────────────

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
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function wcagLevel(ratio: number): { label: string; color: string } {
  if (ratio >= 7) return { label: "AAA", color: "#22c55e" }
  if (ratio >= 4.5) return { label: "AA", color: "#84cc16" }
  if (ratio >= 3) return { label: "AA Large", color: "#f59e0b" }
  return { label: "Fail", color: "#ef4444" }
}

// ─── Component ───────────────────────────────────────────────

type Props = {
  store: CardDesignStoreApi
  passType: string
}

export function FieldsPanel({ store, passType }: Props) {
  const t = useTranslations("studio.panels")
  const primaryColor = useStore(store, (s) => s.wallet.primaryColor)
  const textColor = useStore(store, (s) => s.wallet.textColor)
  const labelColor = useStore(store, (s) => s.wallet.labelColor)
  const autoTextColor = useStore(store, (s) => s.wallet.autoTextColor)
  const showStrip = useStore(store, (s) => s.wallet.showStrip)
  const showPrimaryField = useStore(store, (s) => s.wallet.showPrimaryField)
  const previewFormat = useStore(store, (s) => s.ui.previewFormat)

  const isGoogle = previewFormat === "google"
  const ratio = contrastRatio(primaryColor, textColor)
  const wcag = wcagLevel(ratio)

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
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
        {t("fieldsPanelDesc")}
      </div>

      {/* ── Text & Label Colors ── */}
      <SectionHeader>{t("textColors")}</SectionHeader>

      {/* Text color row */}
      <ColorRow
        label={t("fieldValues")}
        color={textColor}
        onChange={(v) => {
          store.getState().setWalletField("textColor", v)
          store.getState().setWalletField("autoTextColor", false)
        }}
      />

      {/* Label color row (Apple only) */}
      {!isGoogle && (
        <ColorRow
          label={t("labels")}
          color={labelColor ?? blendColors(textColor, primaryColor, 0.3)}
          onChange={(v) => store.getState().setWalletField("labelColor", v)}
          onReset={labelColor ? () => store.getState().setWalletField("labelColor", null) : undefined}
        />
      )}

      {/* WCAG contrast */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderRadius: 12,
          backgroundColor: "var(--muted)",
          marginBottom: 8,
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {t("textContrast")}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: wcag.color,
            padding: "4px 8px",
            borderRadius: 9999,
            border: `1px solid ${wcag.color}`,
          }}
        >
          {wcag.label} {ratio.toFixed(1)}:1
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
          <div style={{ fontSize: 12, color: "var(--foreground)" }}>{t("autoTextColor")}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{t("computeFromBackground")}</div>
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

      {/* ── Show Primary Field on Strip (Apple only) ── */}
      {showStrip && !isGoogle && (
        <>
          <SectionHeader>{t("primaryFieldSection")}</SectionHeader>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderRadius: 14,
              border: `1.5px solid ${showPrimaryField ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: showPrimaryField ? "var(--accent)" : "transparent",
              cursor: "pointer",
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{t("showPrimaryField")}</span>
            <input
              type="checkbox"
              checked={showPrimaryField}
              onChange={(e) => store.getState().setWalletField("showPrimaryField", e.target.checked)}
              style={{ accentColor: "var(--primary)", width: 16, height: 16 }}
            />
          </label>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 12, lineHeight: 1.4 }}>
            {t("showPrimaryFieldHint")}
          </div>
        </>
      )}

      {/* ── Card Fields ── */}
      <CardFieldsSection store={store} passType={passType} />
    </div>
  )
}

// ─── Color Row ───────────────────────────────────────────────

function ColorRow({
  label,
  color,
  onChange,
  onReset,
}: {
  label: string
  color: string
  onChange: (v: string) => void
  onReset?: () => void
}) {
  const t = useTranslations("studio.panels")
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 12,
        marginBottom: 2,
      }}
    >
      {/* Swatch */}
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
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
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
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
          {color.toUpperCase()}
        </div>
      </div>

      {onReset && (
        <button
          onClick={onReset}
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
          {t("auto")}
        </button>
      )}
    </div>
  )
}

// ─── Section Header ─────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: "var(--muted-foreground)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginTop: 16,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

// ─── Card Fields Section ────────────────────────────────────

function CardFieldsSection({ store, passType }: { store: CardDesignStoreApi; passType: string }) {
  const t = useTranslations("studio.panels")
  const rawFields = useStore(store, (s) => s.wallet.fields)
  const rawFieldLabels = useStore(store, (s) => s.wallet.fieldLabels)
  const rawHeader = useStore(store, (s) => s.wallet.headerFields)
  const rawSecondary = useStore(store, (s) => s.wallet.secondaryFields)
  const setWallet = store.getState().setWalletField

  const fieldConfig = getFieldConfig(passType)
  const fields = rawFields
    ?? (rawHeader || rawSecondary
      ? [...(rawHeader ?? fieldConfig.defaultHeader), ...(rawSecondary ?? fieldConfig.defaultSecondary)]
      : null)
    ?? [...fieldConfig.defaultFields]
  const fieldLabels = rawFieldLabels ?? {}

  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  function handleFieldsChange(updated: string[]) {
    setWallet("fields", updated)
    setWallet("headerFields", null)
    setWallet("secondaryFields", null)
  }

  function handleLabelChange(fieldId: string, newLabel: string) {
    const updated = { ...fieldLabels }
    if (!newLabel) {
      delete updated[fieldId]
    } else {
      updated[fieldId] = newLabel
    }
    setWallet("fieldLabels", Object.keys(updated).length > 0 ? updated : null)
  }

  function getDefaultLabel(id: string) {
    return fieldConfig.availableFields.find((f) => f.id === id)?.label ?? id
  }

  function getDisplayLabel(id: string) {
    return fieldLabels[id] ?? getDefaultLabel(id)
  }

  function startEdit(id: string) {
    setEditingLabel(id)
    setEditValue(fieldLabels[id] ?? getDefaultLabel(id))
  }

  function commitEdit(id: string) {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== getDefaultLabel(id)) {
      handleLabelChange(id, trimmed)
    } else {
      handleLabelChange(id, "")
    }
    setEditingLabel(null)
  }

  function moveField(index: number, dir: -1 | 1) {
    const ni = index + dir
    if (ni < 0 || ni >= fields.length) return
    const updated = [...fields]
    const tmp = updated[index]
    updated[index] = updated[ni]
    updated[ni] = tmp
    handleFieldsChange(updated)
  }

  function removeField(id: string) {
    handleFieldsChange(fields.filter((f) => f !== id))
  }

  function addField(id: string) {
    if (fields.length >= 6) return
    handleFieldsChange([...fields, id])
  }

  const available = fieldConfig.availableFields.filter((f) => !fields.includes(f.id))

  return (
    <>
      <SectionHeader>{t("cardFields")}</SectionHeader>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>
        {t("cardFieldsDesc")}
      </div>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.4 }}>
        {t("cardFieldsHint")}
      </div>

      {/* Field list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
        {fields.map((id, i) => (
          <div
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              backgroundColor: "var(--accent)",
              fontSize: 12,
            }}
          >
            {/* Position indicator */}
            <span style={{ fontSize: 10, color: "var(--muted-foreground)", width: 14, textAlign: "center", flexShrink: 0 }}>
              {i === 0 ? "H" : `${i}`}
            </span>

            {editingLabel === id ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitEdit(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit(id)
                  if (e.key === "Escape") setEditingLabel(null)
                }}
                maxLength={50}
                style={{
                  flex: 1,
                  padding: "3px 8px",
                  borderRadius: 9999,
                  border: "1px solid var(--primary)",
                  backgroundColor: "var(--background)",
                  fontSize: 12,
                  color: "var(--foreground)",
                  outline: "none",
                  minWidth: 0,
                }}
              />
            ) : (
              <span
                style={{ flex: 1, color: "var(--foreground)", cursor: "text", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={t("clickToRename")}
                onClick={() => startEdit(id)}
              >
                {getDisplayLabel(id)}
                {fieldLabels[id] && (
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 3 }}>✎</span>
                )}
              </span>
            )}

            <button
              onClick={() => moveField(i, -1)}
              disabled={i === 0}
              style={{
                padding: "0 3px",
                border: "none",
                background: "none",
                color: i === 0 ? "var(--muted)" : "var(--muted-foreground)",
                cursor: i === 0 ? "default" : "pointer",
                fontSize: 11,
                lineHeight: 1,
              }}
              aria-label={t("moveUp", { label: getDisplayLabel(id) })}
            >
              ↑
            </button>
            <button
              onClick={() => moveField(i, 1)}
              disabled={i === fields.length - 1}
              style={{
                padding: "0 3px",
                border: "none",
                background: "none",
                color: i === fields.length - 1 ? "var(--muted)" : "var(--muted-foreground)",
                cursor: i === fields.length - 1 ? "default" : "pointer",
                fontSize: 11,
                lineHeight: 1,
              }}
              aria-label={t("moveDown", { label: getDisplayLabel(id) })}
            >
              ↓
            </button>
            <button
              onClick={() => removeField(id)}
              style={{ padding: "0 3px", border: "none", background: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 12, lineHeight: 1 }}
              aria-label={t("removeField", { label: getDisplayLabel(id) })}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add field dropdown */}
      {fields.length < 6 && available.length > 0 && (
        <select
          value=""
          onChange={(e) => { if (e.target.value) addField(e.target.value) }}
          style={{
            width: "100%",
            padding: "6px 10px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            backgroundColor: "var(--background)",
            fontSize: 11,
            color: "var(--muted-foreground)",
            cursor: "pointer",
            marginBottom: 6,
          }}
        >
          <option value="">{t("addField")}</option>
          {available.map((f) => (
            <option key={f.id} value={f.id}>{fieldLabels[f.id] ?? f.label}</option>
          ))}
        </select>
      )}

      <button
        onClick={() => {
          setWallet("fields", null)
          setWallet("headerFields", null)
          setWallet("secondaryFields", null)
          setWallet("fieldLabels", null)
        }}
        style={{
          fontSize: 11,
          color: "var(--muted-foreground)",
          background: "none",
          border: "none",
          cursor: "pointer",
          textDecoration: "underline",
          padding: 0,
        }}
      >
        {t("resetToDefaults")}
      </button>
    </>
  )
}

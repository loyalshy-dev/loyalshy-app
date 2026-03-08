"use client"

import { useState, useRef } from "react"
import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { formatProgressValue, type ProgressStyle, type StampGridConfig } from "@/lib/wallet/card-design"
import { STAMP_ICONS, REWARD_ICONS, getStampIconPaths } from "@/lib/wallet/stamp-icons"
import { uploadStampIcon, deleteStampIcon, uploadRewardIcon, deleteRewardIcon, uploadEmptyIcon, deleteEmptyIcon } from "@/server/org-settings-actions"

// ─── Shared helpers ───────────────────────────────────────────

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

function IconUploadWidget({
  url,
  label,
  isUploading,
  inputRef,
  programId,
  onUpload,
  onDelete,
  onUrlChange,
}: {
  url: string | null
  label: string
  isUploading: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  programId: string
  onUpload: (formData: FormData) => Promise<{ success?: boolean; url?: string; error?: string }>
  onDelete: (id: string) => Promise<{ success?: boolean; error?: string }>
  onUrlChange: (url: string | null) => void
}) {
  if (url) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          style={{
            width: 40,
            height: 40,
            objectFit: "contain",
            borderRadius: 6,
            border: "1px solid var(--border)",
            backgroundColor: "var(--muted)",
          }}
        />
        <button
          onClick={async () => {
            const result = await onDelete(programId)
            if (result.success) onUrlChange(null)
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            cursor: "pointer",
            fontSize: 11,
            color: "var(--destructive)",
          }}
        >
          Remove
        </button>
      </div>
    )
  }
  return (
    <div style={{ marginBottom: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const formData = new FormData()
          formData.set("templateId", programId)
          formData.set("file", file)
          const result = await onUpload(formData)
          if (result.success && result.url) onUrlChange(result.url)
          if (inputRef.current) inputRef.current.value = ""
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        style={{
          padding: "6px 12px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          backgroundColor: "var(--muted)",
          cursor: isUploading ? "wait" : "pointer",
          fontSize: 11,
          color: "var(--foreground)",
          width: "100%",
        }}
      >
        {isUploading ? "Uploading..." : "Upload custom icon"}
      </button>
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────

type StyleOption = {
  id: "STAMP_GRID" | ProgressStyle
  name: string
  example: string
  badge?: string
}

const STYLE_OPTIONS: StyleOption[] = [
  { id: "STAMP_GRID", name: "Stamp Grid", example: "", badge: "Visual" },
  { id: "NUMBERS", name: "Numbers", example: "4 / 10 Visits" },
  { id: "CIRCLES", name: "Circles", example: "●●●●○○○○○○" },
  { id: "SQUARES", name: "Squares", example: "■■■■□□□□□□" },
  { id: "STARS", name: "Stars", example: "★★★★☆☆☆☆☆☆" },
  { id: "STAMPS", name: "Stamps", example: "◉◉◉◉◎◎◎◎◎◎" },
  { id: "PERCENTAGE", name: "Percentage", example: "40%" },
  { id: "REMAINING", name: "Remaining", example: "6 visits left" },
]

const STAMP_SHAPES: { id: StampGridConfig["stampShape"]; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "rounded-square", label: "Rounded" },
  { id: "square", label: "Square" },
]

const FILLED_STYLES: { id: StampGridConfig["filledStyle"]; label: string }[] = [
  { id: "icon", label: "Icon" },
  { id: "icon-with-border", label: "Icon + Border" },
  { id: "solid", label: "Solid" },
]

const TEXT_PROGRESS_STYLES: { id: ProgressStyle; name: string }[] = [
  { id: "NUMBERS", name: "Numbers — 4 / 10 Visits" },
  { id: "CIRCLES", name: "Circles — ●●●●○○" },
  { id: "SQUARES", name: "Squares — ■■■■□□" },
  { id: "STARS", name: "Stars — ★★★★☆☆" },
  { id: "STAMPS", name: "Stamps — ◉◉◉◉◎◎" },
  { id: "PERCENTAGE", name: "Percentage — 40%" },
  { id: "REMAINING", name: "Remaining — 6 visits left" },
]

// ─── Mini Stamp Grid Preview (for option card) ───────────────

function StampGridMiniPreview({ config }: { config: StampGridConfig }) {
  const iconPaths = getStampIconPaths(config.stampIcon)
  const slots = 6 // 3×2 mini grid
  const filled = 4

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 10px)",
        gap: 2,
      }}
    >
      {Array.from({ length: slots }, (_, i) => {
        const isFilled = i < filled
        const borderRadius = config.stampShape === "circle" ? "50%" : config.stampShape === "rounded-square" ? "20%" : "0"
        return (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius,
              backgroundColor: isFilled ? "var(--primary)" : "transparent",
              border: isFilled ? "none" : "1px solid var(--muted-foreground)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: isFilled ? 1 : 0.4,
            }}
          >
            {isFilled && !config.customStampIconUrl && (
              <svg
                width={6}
                height={6}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: iconPaths }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────

type Props = {
  store: CardDesignStoreApi
  programId: string
  visitsRequired: number
  onUploadStampIcon?: (formData: FormData) => Promise<{ success?: boolean; url?: string; error?: string }>
  onDeleteStampIcon?: (id: string) => Promise<{ success?: boolean; error?: string }>
}

export function ProgressPanel({ store, programId, visitsRequired, onUploadStampIcon, onDeleteStampIcon }: Props) {
  const wallet = useStore(store, (s) => s.wallet)
  const progressStyle = wallet.progressStyle
  const customProgressLabel = wallet.customProgressLabel
  const useStampGrid = wallet.useStampGrid
  const stampGridConfig = wallet.stampGridConfig
  const showStrip = wallet.showStrip

  const stampFilledColor = wallet.stampFilledColor
  const stripColor2 = wallet.stripColor2
  const secondaryColor = wallet.secondaryColor
  const effectiveStampColor = stampFilledColor ?? stripColor2 ?? secondaryColor

  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingReward, setIsUploadingReward] = useState(false)
  const [isUploadingEmpty, setIsUploadingEmpty] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rewardFileInputRef = useRef<HTMLInputElement>(null)
  const emptyFileInputRef = useRef<HTMLInputElement>(null)

  // Derived: which option is active
  const activeId: "STAMP_GRID" | ProgressStyle = useStampGrid ? "STAMP_GRID" : progressStyle

  // Live preview for text styles
  const livePreview = formatProgressValue(4, visitsRequired, progressStyle, false)

  function updateStampGridConfig(patch: Partial<StampGridConfig>) {
    store.getState().setWalletField("stampGridConfig", { ...stampGridConfig, ...patch })
  }

  function handleStyleSelect(id: "STAMP_GRID" | ProgressStyle) {
    if (id === "STAMP_GRID") {
      store.getState().setWalletField("useStampGrid", true)
      // Stamp grid needs the strip area to render
      if (!showStrip) store.getState().setWalletField("showStrip", true)
    } else {
      store.getState().setWalletField("useStampGrid", false)
      store.getState().setWalletField("progressStyle", id)
    }
  }

  return (
    <div>
      {/* ─── B. Unified Style Picker ─── */}
      <SectionHeader>Progress Style</SectionHeader>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          marginBottom: 16,
        }}
      >
        {STYLE_OPTIONS.map((opt) => {
          const isActive = activeId === opt.id
          const isStampGridOption = opt.id === "STAMP_GRID"

          return (
            <button
              key={opt.id}
              onClick={() => handleStyleSelect(opt.id)}
              aria-pressed={isActive}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "10px 6px",
                borderRadius: 8,
                border: `2px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                backgroundColor: isActive ? "var(--accent)" : "transparent",
                cursor: "pointer",
                textAlign: "center",
                minHeight: 58,
                position: "relative",
              }}
            >
              {/* Badge for stamp grid */}
              {opt.badge && (
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 3,
                    fontSize: 8,
                    fontWeight: 700,
                    color: "var(--primary)",
                    backgroundColor: "var(--accent)",
                    padding: "1px 4px",
                    borderRadius: 3,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {opt.badge}
                </span>
              )}

              {/* Stamp grid: mini icon cluster */}
              {isStampGridOption ? (
                <StampGridMiniPreview config={stampGridConfig} />
              ) : (
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "var(--muted-foreground)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                    lineHeight: 1.3,
                  }}
                >
                  {opt.example}
                </div>
              )}

              <div
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  color: "var(--foreground)",
                }}
              >
                {opt.name}
              </div>

            </button>
          )
        })}
      </div>

      {/* ─── C. Stamp Grid Config (when stamp grid selected) ─── */}
      {useStampGrid && (
        <>
          <div style={{ height: 1, backgroundColor: "var(--border)", marginBottom: 16 }} />

          {/* Custom Stamp Icon Upload */}
          <SectionHeader>Filled Stamp Icon</SectionHeader>
          <IconUploadWidget
            url={stampGridConfig.customStampIconUrl}
            label="Custom stamp icon"
            isUploading={isUploading}
            inputRef={fileInputRef}
            programId={programId}
            onUpload={onUploadStampIcon ?? uploadStampIcon}
            onDelete={onDeleteStampIcon ?? deleteStampIcon}
            onUrlChange={(url) => updateStampGridConfig({ customStampIconUrl: url })}
          />

          {/* Uniform icon toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              padding: "8px 10px",
              borderRadius: 6,
              border: `1.5px solid ${stampGridConfig.useUniformIcon ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: stampGridConfig.useUniformIcon ? "var(--accent)" : "transparent",
              marginBottom: 12,
            }}
          >
            <input
              type="checkbox"
              checked={stampGridConfig.useUniformIcon}
              onChange={(e) => updateStampGridConfig({ useUniformIcon: e.target.checked })}
              style={{ accentColor: "var(--primary)", width: 14, height: 14 }}
            />
            <span style={{ fontSize: 12, color: "var(--foreground)" }}>Same icon for all slots</span>
          </label>

          {/* Preset Icons */}
          <SectionHeader>Preset Icons</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
            {STAMP_ICONS.map((icon) => (
              <button
                key={icon.id}
                onClick={() => {
                  if (stampGridConfig.customStampIconUrl) {
                    (onDeleteStampIcon ?? deleteStampIcon)(programId).catch(() => {})
                  }
                  updateStampGridConfig({ stampIcon: icon.id, customStampIconUrl: null })
                }}
                aria-pressed={!stampGridConfig.customStampIconUrl && stampGridConfig.stampIcon === icon.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 4px",
                  borderRadius: 6,
                  border: `2px solid ${!stampGridConfig.customStampIconUrl && stampGridConfig.stampIcon === icon.id ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: !stampGridConfig.customStampIconUrl && stampGridConfig.stampIcon === icon.id ? "var(--accent)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <svg
                  width={28}
                  height={28}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dangerouslySetInnerHTML={{ __html: icon.paths }}
                />
                <span style={{ fontSize: 9, color: "var(--foreground)", lineHeight: 1 }}>{icon.label}</span>
              </button>
            ))}
          </div>

          {/* Stamp Shape */}
          <SectionHeader>Stamp Shape</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {STAMP_SHAPES.map((s) => (
              <button
                key={s.id}
                onClick={() => updateStampGridConfig({ stampShape: s.id })}
                aria-pressed={stampGridConfig.stampShape === s.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: `2px solid ${stampGridConfig.stampShape === s.id ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: stampGridConfig.stampShape === s.id ? "var(--accent)" : "transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: stampGridConfig.stampShape === s.id ? 600 : 400,
                  color: "var(--foreground)",
                  textAlign: "center",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Filled Style */}
          <SectionHeader>Filled Style</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {FILLED_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => updateStampGridConfig({ filledStyle: s.id })}
                aria-pressed={stampGridConfig.filledStyle === s.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: `2px solid ${stampGridConfig.filledStyle === s.id ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: stampGridConfig.filledStyle === s.id ? "var(--accent)" : "transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: stampGridConfig.filledStyle === s.id ? 600 : 400,
                  color: "var(--foreground)",
                  textAlign: "center",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Icon Size */}
          <SectionHeader>Icon Size</SectionHeader>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0.4}
              max={0.9}
              step={0.05}
              value={stampGridConfig.stampIconScale ?? 0.6}
              onChange={(e) => updateStampGridConfig({ stampIconScale: parseFloat(e.target.value) })}
              style={{ flex: 1, accentColor: "var(--primary)" }}
            />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace", minWidth: 32, textAlign: "right" }}>
              {Math.round((stampGridConfig.stampIconScale ?? 0.6) * 100)}%
            </span>
          </div>

          {/* Reward & Empty icons — only when not using uniform icon */}
          {!stampGridConfig.useUniformIcon && (
            <>
              {/* Reward Icon */}
              <SectionHeader>Reward Slot Icon</SectionHeader>
              <IconUploadWidget
                url={stampGridConfig.customRewardIconUrl}
                label="Custom reward icon"
                isUploading={isUploadingReward}
                inputRef={rewardFileInputRef}
                programId={programId}
                onUpload={uploadRewardIcon}
                onDelete={deleteRewardIcon}
                onUrlChange={(url) => updateStampGridConfig({ customRewardIconUrl: url })}
              />
              {!stampGridConfig.customRewardIconUrl && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                  {REWARD_ICONS.map((icon) => (
                    <button
                      key={icon.id}
                      onClick={() => updateStampGridConfig({ rewardIcon: icon.id })}
                      aria-pressed={stampGridConfig.rewardIcon === icon.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 4px",
                        borderRadius: 6,
                        border: `2px solid ${stampGridConfig.rewardIcon === icon.id ? "var(--primary)" : "var(--border)"}`,
                        backgroundColor: stampGridConfig.rewardIcon === icon.id ? "var(--accent)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <svg
                        width={24}
                        height={24}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        dangerouslySetInnerHTML={{ __html: icon.paths }}
                      />
                      <span style={{ fontSize: 9, color: "var(--foreground)", lineHeight: 1 }}>{icon.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Reward Slot Icon Color */}
              <SectionHeader>Reward Slot Color</SectionHeader>
              <ColorRow
                label="Icon Color"
                value={stampGridConfig.rewardSlotColor ?? wallet.stripColor1 ?? wallet.primaryColor}
                onChange={(v) => updateStampGridConfig({ rewardSlotColor: v })}
              />
              {stampGridConfig.rewardSlotColor && (
                <button
                  onClick={() => updateStampGridConfig({ rewardSlotColor: null })}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    fontSize: 10,
                    color: "var(--muted-foreground)",
                    marginBottom: 8,
                  }}
                >
                  Reset to default
                </button>
              )}
              {stampGridConfig.rewardSlotBg !== "transparent" && (
                <ColorRow
                  label="Icon Fill"
                  value={stampGridConfig.rewardSlotBg ?? effectiveStampColor}
                  onChange={(v) => updateStampGridConfig({ rewardSlotBg: v })}
                />
              )}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: `1.5px solid ${stampGridConfig.rewardSlotBg === "transparent" ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: stampGridConfig.rewardSlotBg === "transparent" ? "var(--accent)" : "transparent",
                  marginTop: stampGridConfig.rewardSlotBg === "transparent" ? 0 : 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={stampGridConfig.rewardSlotBg === "transparent"}
                  onChange={(e) => updateStampGridConfig({ rewardSlotBg: e.target.checked ? "transparent" : null })}
                  style={{ accentColor: "var(--primary)", width: 14, height: 14 }}
                />
                <span style={{ fontSize: 12, color: "var(--foreground)" }}>Transparent</span>
              </label>

              {/* Unfilled Slot Opacity — shared by empty + reward when not filled */}
              <SectionHeader>Unfilled Opacity</SectionHeader>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={stampGridConfig.emptySlotOpacity ?? 0.35}
                  onChange={(e) => updateStampGridConfig({ emptySlotOpacity: parseFloat(e.target.value) })}
                  style={{ flex: 1, accentColor: "var(--primary)" }}
                />
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace", minWidth: 32, textAlign: "right" }}>
                  {Math.round((stampGridConfig.emptySlotOpacity ?? 0.35) * 100)}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4, marginBottom: 4 }}>
                Applies to empty and unfilled reward slots.
              </div>

              {/* Empty Slot Icon */}
              <SectionHeader>Empty Slot Icon</SectionHeader>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 8 }}>
                Replaces slot numbers with a custom icon.
              </div>
              <IconUploadWidget
                url={stampGridConfig.customEmptyIconUrl}
                label="Custom empty slot icon"
                isUploading={isUploadingEmpty}
                inputRef={emptyFileInputRef}
                programId={programId}
                onUpload={uploadEmptyIcon}
                onDelete={deleteEmptyIcon}
                onUrlChange={(url) => updateStampGridConfig({ customEmptyIconUrl: url })}
              />

              {/* Empty Slot Color */}
              <SectionHeader>Empty Slot Color</SectionHeader>
              {(stampGridConfig.customEmptyIconUrl || stampGridConfig.useUniformIcon) && (
                <>
                  <ColorRow
                    label="Icon Color"
                    value={stampGridConfig.emptySlotColor ?? wallet.textColor}
                    onChange={(v) => updateStampGridConfig({ emptySlotColor: v })}
                  />
                  {stampGridConfig.emptySlotColor && (
                    <button
                      onClick={() => updateStampGridConfig({ emptySlotColor: null })}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        fontSize: 10,
                        color: "var(--muted-foreground)",
                        marginBottom: 8,
                      }}
                    >
                      Reset to text color
                    </button>
                  )}
                </>
              )}
              {stampGridConfig.emptySlotBg !== "transparent" && (
                <ColorRow
                  label="Icon Fill"
                  value={stampGridConfig.emptySlotBg ?? wallet.stripColor1 ?? wallet.primaryColor}
                  onChange={(v) => updateStampGridConfig({ emptySlotBg: v })}
                />
              )}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: `1.5px solid ${stampGridConfig.emptySlotBg === "transparent" ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: stampGridConfig.emptySlotBg === "transparent" ? "var(--accent)" : "transparent",
                  marginTop: stampGridConfig.emptySlotBg === "transparent" ? 0 : 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={stampGridConfig.emptySlotBg === "transparent"}
                  onChange={(e) => updateStampGridConfig({ emptySlotBg: e.target.checked ? "transparent" : null })}
                  style={{ accentColor: "var(--primary)", width: 14, height: 14 }}
                />
                <span style={{ fontSize: 12, color: "var(--foreground)" }}>Transparent</span>
              </label>

              {/* Empty slot number customization — only when showing numbers (no custom empty icon) */}
              {!stampGridConfig.customEmptyIconUrl && (
                <>
                  <SectionHeader>Empty Slot Numbers</SectionHeader>
                  <ColorRow
                    label="Number Color"
                    value={stampGridConfig.emptyNumberColor ?? wallet.textColor}
                    onChange={(v) => updateStampGridConfig({ emptyNumberColor: v })}
                  />
                  {stampGridConfig.emptyNumberColor && (
                    <button
                      onClick={() => updateStampGridConfig({ emptyNumberColor: null })}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        fontSize: 10,
                        color: "var(--muted-foreground)",
                        marginBottom: 8,
                      }}
                    >
                      Reset to text color
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: "var(--foreground)", marginBottom: 4 }}>Number Size</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="range"
                      min={0.2}
                      max={0.6}
                      step={0.05}
                      value={stampGridConfig.emptyNumberScale ?? 0.35}
                      onChange={(e) => updateStampGridConfig({ emptyNumberScale: parseFloat(e.target.value) })}
                      style={{ flex: 1, accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace", minWidth: 32, textAlign: "right" }}>
                      {Math.round((stampGridConfig.emptyNumberScale ?? 0.35) * 100)}%
                    </span>
                  </div>
                </>
              )}
            </>
          )}

          {/* Stamp Icon Color */}
          <SectionHeader>Stamp Icon Color</SectionHeader>
          {stampFilledColor !== "transparent" && (
            <ColorRow
              label="Icon Fill"
              value={effectiveStampColor}
              onChange={(v) => store.getState().setWalletField("stampFilledColor", v)}
            />
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              padding: "8px 10px",
              borderRadius: 6,
              border: `1.5px solid ${stampFilledColor === "transparent" ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: stampFilledColor === "transparent" ? "var(--accent)" : "transparent",
              marginTop: stampFilledColor === "transparent" ? 0 : 4,
            }}
          >
            <input
              type="checkbox"
              checked={stampFilledColor === "transparent"}
              onChange={(e) => store.getState().setWalletField("stampFilledColor", e.target.checked ? "transparent" : null)}
              style={{ accentColor: "var(--primary)", width: 14, height: 14 }}
            />
            <span style={{ fontSize: 12, color: "var(--foreground)" }}>Transparent</span>
          </label>
        </>
      )}

      {/* ─── D. Text Preview (when text style selected) ─── */}
      {!useStampGrid && (
        <>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              backgroundColor: "var(--muted)",
              marginBottom: 4,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 4 }}>
              Preview ({4}/{visitsRequired} visits)
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "monospace", letterSpacing: "0.05em" }}>
              {livePreview}
            </div>
          </div>
        </>
      )}

      {/* ─── E. Custom Label (non-stamp-grid only) ─── */}
      {!useStampGrid && (
        <>
          <SectionHeader>Custom Label</SectionHeader>
          <input
            type="text"
            value={customProgressLabel}
            onChange={(e) => store.getState().setWalletField("customProgressLabel", e.target.value)}
            placeholder="e.g. Coffee Points"
            maxLength={30}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              backgroundColor: "var(--background)",
              fontSize: 12,
              color: "var(--foreground)",
              outline: "none",
            }}
          />
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
            Used as the progress field label on the pass. Leave empty for &ldquo;Progress&rdquo;.
          </div>
        </>
      )}
    </div>
  )
}

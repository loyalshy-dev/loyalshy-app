"use client"

import { useState, useRef } from "react"
import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { formatProgressValue, type ProgressStyle, type StampGridConfig } from "@/lib/wallet/card-design"
import { STAMP_ICONS, REWARD_ICONS, getStampIconPaths, getRewardIconPaths } from "@/lib/wallet/stamp-icons"
import { uploadStampIcon, deleteStampIcon, uploadRewardIcon, deleteRewardIcon, uploadEmptyIcon, deleteEmptyIcon } from "@/server/org-settings-actions"

// ─── Shared UI helpers ────────────────────────────────────────

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

function GroupBox({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        marginTop: 12,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          backgroundColor: "var(--muted)",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--foreground)",
          letterSpacing: "0.02em",
        }}
      >
        {title}
        <span
          style={{
            fontSize: 10,
            color: "var(--muted-foreground)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div style={{ padding: "8px 12px 12px" }}>
          {children}
        </div>
      )}
    </div>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", marginBottom: 6, marginTop: 8 }}>
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

function ResetLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        color: "var(--muted-foreground)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 0",
        textDecoration: "underline",
        textUnderlineOffset: 2,
        textAlign: "left",
      }}
    >
      {label}
    </button>
  )
}

function TransparentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        padding: "8px 10px",
        borderRadius: 6,
        border: `1.5px solid ${checked ? "var(--primary)" : "var(--border)"}`,
        backgroundColor: checked ? "var(--accent)" : "transparent",
        marginTop: 4,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "var(--primary)", width: 14, height: 14 }}
      />
      <span style={{ fontSize: 12, color: "var(--foreground)" }}>Transparent</span>
    </label>
  )
}

function IconUploadWidget({
  url,
  label,
  inputRef,
  programId,
  onUpload,
  onDelete,
  onUrlChange,
}: {
  url: string | null
  label: string
  inputRef: React.RefObject<HTMLInputElement | null>
  programId: string
  onUpload: (formData: FormData) => Promise<{ success?: boolean; url?: string; error?: string }>
  onDelete: (id: string) => Promise<{ success?: boolean; error?: string }>
  onUrlChange: (url: string | null) => void
}) {
  const [isUploading, setIsUploading] = useState(false)

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
          setIsUploading(true)
          const formData = new FormData()
          formData.set("templateId", programId)
          formData.set("file", file)
          const result = await onUpload(formData)
          if (result.success && result.url) onUrlChange(result.url)
          if (inputRef.current) inputRef.current.value = ""
          setIsUploading(false)
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

// ─── Filled Style Preview ─────────────────────────────────────

function FilledStylePreview({ style, shape }: { style: StampGridConfig["filledStyle"]; shape: StampGridConfig["stampShape"] }) {
  const size = 22
  const borderRadius = shape === "circle" ? "50%" : shape === "rounded-square" ? "20%" : "0"
  const bg = "var(--primary)"
  const fg = "var(--primary-foreground)"

  if (style === "solid") {
    return (
      <div style={{ width: size, height: size, borderRadius, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: fg }}>
        {"\u2713"}
      </div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: bg,
        border: style === "icon-with-border" ? `2px solid ${bg}` : "none",
        boxShadow: style === "icon-with-border" ? `0 0 0 1px color-mix(in srgb, ${bg} 50%, transparent)` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </div>
  )
}

// ─── Filled Style Picker (shared between Filled Stamps and Reward Slot) ───

const FILLED_STYLES: { id: StampGridConfig["filledStyle"]; label: string }[] = [
  { id: "icon", label: "Icon" },
  { id: "icon-with-border", label: "Border" },
  { id: "solid", label: "Solid" },
]

function FilledStylePicker({
  value,
  shape,
  onChange,
}: {
  value: StampGridConfig["filledStyle"]
  shape: StampGridConfig["stampShape"]
  onChange: (v: StampGridConfig["filledStyle"]) => void
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
      {FILLED_STYLES.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          aria-pressed={value === s.id}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "8px 6px",
            borderRadius: 6,
            border: `2px solid ${value === s.id ? "var(--primary)" : "var(--border)"}`,
            backgroundColor: value === s.id ? "var(--accent)" : "transparent",
            cursor: "pointer",
          }}
        >
          <FilledStylePreview style={s.id} shape={shape} />
          <span style={{ fontSize: 10, fontWeight: value === s.id ? 600 : 400, color: "var(--foreground)" }}>
            {s.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Icon Preset Grid ─────────────────────────────────────────

function IconPresetGrid({
  icons,
  activeId,
  onSelect,
  cols = 4,
}: {
  icons: { id: string; label: string; paths: string }[]
  activeId: string
  onSelect: (id: string) => void
  cols?: number
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
      {icons.map((icon) => (
        <button
          key={icon.id}
          onClick={() => onSelect(icon.id)}
          aria-pressed={activeId === icon.id}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "6px 4px",
            borderRadius: 6,
            border: `2px solid ${activeId === icon.id ? "var(--primary)" : "var(--border)"}`,
            backgroundColor: activeId === icon.id ? "var(--accent)" : "transparent",
            cursor: "pointer",
          }}
        >
          <svg
            width={cols >= 4 ? 28 : 24}
            height={cols >= 4 ? 28 : 24}
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

// ─── Mini Stamp Grid Preview (for option card) ───────────────

function StampGridMiniPreview({ config }: { config: StampGridConfig }) {
  const iconPaths = getStampIconPaths(config.stampIcon)
  const slots = 6
  const filled = 4

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 10px)", gap: 2 }}>
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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const rewardFileInputRef = useRef<HTMLInputElement>(null)
  const emptyFileInputRef = useRef<HTMLInputElement>(null)

  const activeId: "STAMP_GRID" | ProgressStyle = useStampGrid ? "STAMP_GRID" : progressStyle
  const livePreview = formatProgressValue(4, visitsRequired, progressStyle, false)

  function updateStampGridConfig(patch: Partial<StampGridConfig>) {
    store.getState().setWalletField("stampGridConfig", { ...stampGridConfig, ...patch })
  }

  function handleStyleSelect(id: "STAMP_GRID" | ProgressStyle) {
    if (id === "STAMP_GRID") {
      store.getState().setWalletField("useStampGrid", true)
      if (!showStrip) store.getState().setWalletField("showStrip", true)
    } else {
      store.getState().setWalletField("useStampGrid", false)
      store.getState().setWalletField("progressStyle", id)
    }
  }

  return (
    <div>
      {/* ─── Progress Style Picker ─── */}
      <SectionHeader>Progress Style</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 4 }}>
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
              {opt.badge && (
                <span style={{ position: "absolute", top: 3, right: 3, fontSize: 8, fontWeight: 700, color: "var(--primary)", backgroundColor: "var(--accent)", padding: "1px 4px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {opt.badge}
                </span>
              )}
              {isStampGridOption ? (
                <StampGridMiniPreview config={stampGridConfig} />
              ) : (
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", lineHeight: 1.3 }}>
                  {opt.example}
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: "var(--foreground)" }}>
                {opt.name}
              </div>
            </button>
          )
        })}
      </div>

      {/* ─── Stamp Grid Configuration ─── */}
      {useStampGrid && (
        <>
          {/* ── Shared: Shape & Size ── */}
          <GroupBox title="Shape & Size" defaultOpen>
            <SubLabel>Shape</SubLabel>
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

            <SubLabel>Icon Size</SubLabel>
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

            {/* Same icon for all slots */}
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
                marginTop: 10,
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
          </GroupBox>

          {/* ═══════════════════════════════════════════════════════
               Section 1: Filled Stamps
              ═══════════════════════════════════════════════════════ */}
          <GroupBox title="Filled Stamps" defaultOpen>
            {/* Icon */}
            <SubLabel>Icon</SubLabel>
            <IconUploadWidget
              url={stampGridConfig.customStampIconUrl}
              label="Custom stamp icon"
              inputRef={fileInputRef}
              programId={programId}
              onUpload={onUploadStampIcon ?? uploadStampIcon}
              onDelete={onDeleteStampIcon ?? deleteStampIcon}
              onUrlChange={(url) => updateStampGridConfig({ customStampIconUrl: url })}
            />
            {!stampGridConfig.customStampIconUrl && (
              <>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 6 }}>Presets</div>
                <IconPresetGrid
                  icons={STAMP_ICONS}
                  activeId={stampGridConfig.stampIcon}
                  onSelect={(id) => {
                    if (stampGridConfig.customStampIconUrl) {
                      (onDeleteStampIcon ?? deleteStampIcon)(programId).catch(() => {})
                    }
                    updateStampGridConfig({ stampIcon: id, customStampIconUrl: null })
                  }}
                  cols={4}
                />
              </>
            )}

            {/* Filled Style */}
            <SubLabel>Style</SubLabel>
            <FilledStylePicker
              value={stampGridConfig.filledStyle}
              shape={stampGridConfig.stampShape}
              onChange={(v) => updateStampGridConfig({ filledStyle: v })}
            />

            {/* Colors */}
            <SubLabel>Colors</SubLabel>
            {stampFilledColor === null ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: effectiveStampColor, border: "1px solid var(--border)", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", flex: 1 }}>Using secondary color</span>
                <button
                  onClick={() => store.getState().setWalletField("stampFilledColor", effectiveStampColor)}
                  style={{ fontSize: 11, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline", textUnderlineOffset: 2 }}
                >
                  Customize
                </button>
              </div>
            ) : stampFilledColor === "transparent" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: "1px dashed var(--border)", flexShrink: 0, background: "repeating-conic-gradient(var(--muted) 0% 25%, transparent 0% 50%) 50% / 8px 8px" }} />
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", flex: 1 }}>Transparent</span>
                <ResetLink label="Reset" onClick={() => store.getState().setWalletField("stampFilledColor", null)} />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <ColorRow label="Background" value={stampFilledColor} onChange={(v) => store.getState().setWalletField("stampFilledColor", v)} />
                <ResetLink label="Reset to secondary color" onClick={() => store.getState().setWalletField("stampFilledColor", null)} />
              </div>
            )}
            <TransparentCheckbox
              checked={stampFilledColor === "transparent"}
              onChange={(checked) => store.getState().setWalletField("stampFilledColor", checked ? "transparent" : null)}
            />
          </GroupBox>

          {/* ═══════════════════════════════════════════════════════
               Section 2: Empty Slots
              ═══════════════════════════════════════════════════════ */}
          <GroupBox title="Empty Slots" defaultOpen={false}>
            {/* Opacity */}
            <SubLabel>Opacity</SubLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
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

            {/* Custom Empty Icon */}
            {!stampGridConfig.useUniformIcon && (
              <>
                <SubLabel>Custom Icon</SubLabel>
                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 8 }}>
                  Replaces slot numbers with a custom icon.
                </div>
                <IconUploadWidget
                  url={stampGridConfig.customEmptyIconUrl}
                  label="Custom empty slot icon"
                  inputRef={emptyFileInputRef}
                  programId={programId}
                  onUpload={uploadEmptyIcon}
                  onDelete={deleteEmptyIcon}
                  onUrlChange={(url) => updateStampGridConfig({ customEmptyIconUrl: url })}
                />
              </>
            )}

            {/* Colors */}
            <SubLabel>Colors</SubLabel>
            {(stampGridConfig.customEmptyIconUrl || stampGridConfig.useUniformIcon) && (
              <>
                <ColorRow
                  label="Stroke"
                  value={stampGridConfig.emptySlotColor ?? wallet.textColor}
                  onChange={(v) => updateStampGridConfig({ emptySlotColor: v })}
                />
                {stampGridConfig.emptySlotColor && (
                  <ResetLink label="Reset to text color" onClick={() => updateStampGridConfig({ emptySlotColor: null })} />
                )}
              </>
            )}
            {stampGridConfig.emptySlotBg !== "transparent" && (
              <ColorRow
                label="Background"
                value={stampGridConfig.emptySlotBg ?? wallet.stripColor1 ?? wallet.primaryColor}
                onChange={(v) => updateStampGridConfig({ emptySlotBg: v })}
              />
            )}
            <TransparentCheckbox
              checked={stampGridConfig.emptySlotBg === "transparent"}
              onChange={(checked) => updateStampGridConfig({ emptySlotBg: checked ? "transparent" : null })}
            />

            {/* Slot Numbers (only when no custom empty icon) */}
            {!stampGridConfig.customEmptyIconUrl && !stampGridConfig.useUniformIcon && (
              <>
                <SubLabel>Slot Numbers</SubLabel>
                <ColorRow
                  label="Number Color"
                  value={stampGridConfig.emptyNumberColor ?? wallet.textColor}
                  onChange={(v) => updateStampGridConfig({ emptyNumberColor: v })}
                />
                {stampGridConfig.emptyNumberColor && (
                  <ResetLink label="Reset to text color" onClick={() => updateStampGridConfig({ emptyNumberColor: null })} />
                )}
                <div style={{ fontSize: 11, color: "var(--foreground)", marginBottom: 4, marginTop: 8 }}>Number Size</div>
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
          </GroupBox>

          {/* ═══════════════════════════════════════════════════════
               Section 3: Reward Slot
              ═══════════════════════════════════════════════════════ */}
          <GroupBox title="Reward Slot" defaultOpen={false}>
            {/* Icon */}
            {!stampGridConfig.useUniformIcon && (
              <>
                <SubLabel>Icon</SubLabel>
                <IconUploadWidget
                  url={stampGridConfig.customRewardIconUrl}
                  label="Custom reward icon"
                  inputRef={rewardFileInputRef}
                  programId={programId}
                  onUpload={uploadRewardIcon}
                  onDelete={deleteRewardIcon}
                  onUrlChange={(url) => updateStampGridConfig({ customRewardIconUrl: url })}
                />
                {!stampGridConfig.customRewardIconUrl && (
                  <>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 6 }}>Presets</div>
                    <IconPresetGrid
                      icons={REWARD_ICONS}
                      activeId={stampGridConfig.rewardIcon}
                      onSelect={(id) => updateStampGridConfig({ rewardIcon: id })}
                      cols={3}
                    />
                  </>
                )}
              </>
            )}

            {/* Filled Style */}
            <SubLabel>Style</SubLabel>
            <FilledStylePicker
              value={stampGridConfig.rewardFilledStyle ?? stampGridConfig.filledStyle}
              shape={stampGridConfig.stampShape}
              onChange={(v) => updateStampGridConfig({ rewardFilledStyle: v })}
            />

            {/* Colors */}
            <SubLabel>Colors</SubLabel>
            <ColorRow
              label="Stroke"
              value={stampGridConfig.rewardSlotColor ?? wallet.stripColor1 ?? wallet.primaryColor}
              onChange={(v) => updateStampGridConfig({ rewardSlotColor: v })}
            />
            {stampGridConfig.rewardSlotColor && (
              <ResetLink label="Reset to default" onClick={() => updateStampGridConfig({ rewardSlotColor: null })} />
            )}
            {stampGridConfig.rewardSlotBg !== "transparent" && (
              <ColorRow
                label="Background"
                value={stampGridConfig.rewardSlotBg ?? effectiveStampColor}
                onChange={(v) => updateStampGridConfig({ rewardSlotBg: v })}
              />
            )}
            <TransparentCheckbox
              checked={stampGridConfig.rewardSlotBg === "transparent"}
              onChange={(checked) => updateStampGridConfig({ rewardSlotBg: checked ? "transparent" : null })}
            />
          </GroupBox>
        </>
      )}

      {/* ─── Text Preview (when text style selected) ─── */}
      {!useStampGrid && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            backgroundColor: "var(--muted)",
            marginTop: 12,
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
      )}

      {/* ─── Custom Label (non-stamp-grid only) ─── */}
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

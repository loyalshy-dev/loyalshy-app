"use client"

import { useState, useRef, useCallback } from "react"
import { useStore } from "zustand"
import { useTranslations } from "next-intl"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import type { PatternStyle } from "@/lib/wallet/card-design"
import { uploadStripImage, deleteStripImage } from "@/server/org-settings-actions"
import { MediaGallery } from "./media-gallery"

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
          style={{ width: 28, height: 28, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", padding: 1 }}
        />
      </div>
    </div>
  )
}

type Props = {
  store: CardDesignStoreApi
  programId: string
  /** When true, strip cannot be toggled off (used for stamp/points cards where progress is baked into strip) */
  forceStrip?: boolean
  /** Card type for type-specific options (e.g., holder photo for BUSINESS_ID) */
  cardType?: string
  /** Organization ID for media gallery (optional — gallery hidden when omitted) */
  organizationId?: string
  onUploadStrip?: (formData: FormData) => Promise<{ success?: boolean; originalUrl?: string; appleUrl?: string; googleUrl?: string; error?: string }>
  onDeleteStrip?: (id: string) => Promise<{ success?: boolean; error?: string }>
}

export function StripPanel({ store, programId, forceStrip, cardType, organizationId, onUploadStrip, onDeleteStrip }: Props) {
  const t = useTranslations("studio.strip")

  const PRESET_STRIP_IMAGES: { id: string; src: string; label: string }[] = [
    { id: "burger", src: "/strip-images/burger.webp", label: t("burger") },
    { id: "caffe-beans", src: "/strip-images/caffe-beans.webp", label: t("coffeeBeans") },
    { id: "pizza", src: "/strip-images/pizza.webp", label: t("pizza") },
    { id: "club", src: "/strip-images/club.webp", label: t("club") },
    { id: "gym", src: "/strip-images/gym.jpg", label: t("gym") },
  ]

  const PATTERN_OPTIONS: { id: PatternStyle; label: string }[] = [
    { id: "NONE", label: t("none") },
    { id: "DOTS", label: t("dots") },
    { id: "WAVES", label: t("waves") },
    { id: "GEOMETRIC", label: t("geometric") },
    { id: "CHEVRON", label: t("chevron") },
    { id: "CROSSHATCH", label: t("crosshatch") },
    { id: "DIAMONDS", label: t("diamonds") },
    { id: "CONFETTI", label: t("confetti") },
  ]
  const showStrip = useStore(store, (s) => s.wallet.showStrip)
  const stripImageUrl = useStore(store, (s) => s.wallet.stripImageUrl)
  const stripOpacity = useStore(store, (s) => s.wallet.stripOpacity)
  const stripGrayscale = useStore(store, (s) => s.wallet.stripGrayscale)
  const patternStyle = useStore(store, (s) => s.wallet.patternStyle)
  const useStampGrid = useStore(store, (s) => s.wallet.useStampGrid)
  const primaryColor = useStore(store, (s) => s.wallet.primaryColor)
  const secondaryColor = useStore(store, (s) => s.wallet.secondaryColor)
  const stripColor1 = useStore(store, (s) => s.wallet.stripColor1)
  const stripColor2 = useStore(store, (s) => s.wallet.stripColor2)
  const stripFill = useStore(store, (s) => s.wallet.stripFill)
  const patternColor = useStore(store, (s) => s.wallet.patternColor)
  const stripImagePosition = useStore(store, (s) => s.wallet.stripImagePosition)
  const stripImageZoom = useStore(store, (s) => s.wallet.stripImageZoom)
  // Effective strip colors: dedicated strip color or fallback to card colors
  const effectiveStripColor1 = stripColor1 ?? primaryColor
  const effectiveStripColor2 = stripColor2 ?? secondaryColor
  const effectivePatternColor = patternColor ?? effectiveStripColor2
  const isFlat = stripFill === "flat"
  const [isUploadingStrip, setIsUploadingStrip] = useState(false)
  const stripFileInputRef = useRef<HTMLInputElement>(null)

  const isStampGrid = useStampGrid

  const hasCustomCrop = stripImagePosition.x !== 0.5 || stripImagePosition.y !== 0.5 || stripImageZoom !== 1

  return (
    <div>
      {/* Show Strip toggle — hidden when strip is mandatory */}
      {forceStrip ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            backgroundColor: "var(--muted)",
            marginBottom: 12,
            fontSize: 11,
            color: "var(--muted-foreground)",
          }}
        >
          {t("alwaysOn")}
        </div>
      ) : (
        <>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderRadius: 14,
              border: `1.5px solid ${showStrip ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: showStrip ? "var(--accent)" : "transparent",
              cursor: "pointer",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{t("showStrip")}</span>
            <input
              type="checkbox"
              checked={showStrip}
              onChange={(e) => store.getState().setWalletField("showStrip", e.target.checked)}
              style={{ accentColor: "var(--primary)", width: 16, height: 16 }}
            />
          </label>

          {!showStrip && (
            <div
              style={{
                padding: "12px",
                borderRadius: 14,
                backgroundColor: "var(--muted)",
                textAlign: "center",
                fontSize: 11,
                color: "var(--muted-foreground)",
              }}
            >
              {t("enablePrompt")}
            </div>
          )}
        </>
      )}

      {(showStrip || forceStrip) && (
        <>
      {/* Interactive crop preview */}
      {stripImageUrl ? (
        <StripCropWidget
          imageUrl={stripImageUrl}
          position={stripImagePosition}
          zoom={stripImageZoom}
          opacity={stripOpacity}
          grayscale={stripGrayscale}
          onPositionChange={(pos) => store.getState().setWalletField("stripImagePosition", pos)}
          onZoomChange={(z) => store.getState().setWalletField("stripImageZoom", z)}
        />
      ) : (
        <div
          style={{
            aspectRatio: "1125 / 432",
            borderRadius: 14,
            border: "1px solid var(--border)",
            backgroundColor: "var(--muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted-foreground)",
            fontSize: 12,
            marginBottom: 4,
          }}
        >
          {t("noStripImage")}
        </div>
      )}

      {/* Zoom slider — only when image is present */}
      {stripImageUrl && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--foreground)" }}>{t("zoom")}</span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
              {stripImageZoom.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={300}
            step={1}
            value={Math.round(stripImageZoom * 100)}
            onChange={(e) => store.getState().setWalletField("stripImageZoom", Number(e.target.value) / 100)}
            style={{
              width: "100%",
              accentColor: "var(--primary)",
              height: 4,
              cursor: "pointer",
            }}
          />
          {hasCustomCrop && (
            <button
              onClick={() => {
                store.getState().setWalletField("stripImagePosition", { x: 0.5, y: 0.5 })
                store.getState().setWalletField("stripImageZoom", 1)
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 9999,
                border: "1px solid var(--border)",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: 11,
                color: "var(--muted-foreground)",
                marginTop: 6,
              }}
            >
              {t("resetPositionZoom")}
            </button>
          )}
        </div>
      )}

      {/* Strip image upload */}
      <SectionHeader>{t("imageSection")}</SectionHeader>
      <input
        ref={stripFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          setIsUploadingStrip(true)
          try {
            const formData = new FormData()
            formData.set("templateId", programId)
            formData.set("file", file)
            const result = await (onUploadStrip ?? uploadStripImage)(formData)
            if (result.success && result.originalUrl) {
              store.getState().setWalletField("stripImageUrl", result.originalUrl)
              if (result.appleUrl) store.getState().setWalletField("stripImageApple", result.appleUrl)
              if (result.googleUrl) store.getState().setWalletField("stripImageGoogle", result.googleUrl)
            }
          } finally {
            setIsUploadingStrip(false)
            if (stripFileInputRef.current) stripFileInputRef.current.value = ""
          }
        }}
      />
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => stripFileInputRef.current?.click()}
          disabled={isUploadingStrip}
          style={{
            flex: 1,
            padding: "8px 14px",
            borderRadius: 9999,
            border: "1px solid var(--border)",
            backgroundColor: "var(--muted)",
            cursor: isUploadingStrip ? "wait" : "pointer",
            fontSize: 12,
            color: "var(--foreground)",
          }}
        >
          {isUploadingStrip ? t("uploading") : stripImageUrl ? t("replaceImage") : t("uploadImage")}
        </button>
        {stripImageUrl && (
          <button
            onClick={async () => {
              await (onDeleteStrip ?? deleteStripImage)(programId)
              store.getState().setWalletField("stripImageUrl", null)
              store.getState().setWalletField("stripImageApple", null)
              store.getState().setWalletField("stripImageGoogle", null)
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 9999,
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: 11,
              color: "var(--destructive)",
            }}
          >
            {t("removeImage")}
          </button>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4, marginBottom: 2 }}>
        {t("imageHint")}
      </div>

      {/* Preset strip images */}
      <SectionHeader>{t("presetsSection")}</SectionHeader>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
          marginBottom: 8,
        }}
      >
        {PRESET_STRIP_IMAGES.map((preset) => {
          const isActive = stripImageUrl?.includes(preset.id) ?? false
          return (
            <button
              key={preset.id}
              disabled={isUploadingStrip}
              onClick={async () => {
                setIsUploadingStrip(true)
                try {
                  // Fetch the preset image and upload to R2
                  const res = await fetch(preset.src)
                  const blob = await res.blob()
                  const ext = preset.src.endsWith(".jpg") ? "jpg" : "webp"
                  const file = new File([blob], `${preset.id}.${ext}`, { type: blob.type })
                  const formData = new FormData()
                  formData.set("templateId", programId)
                  formData.set("file", file)
                  const result = await (onUploadStrip ?? uploadStripImage)(formData)
                  if (result.success && result.originalUrl) {
                    store.getState().setWalletField("stripImageUrl", result.originalUrl)
                    if (result.appleUrl) store.getState().setWalletField("stripImageApple", result.appleUrl)
                    if (result.googleUrl) store.getState().setWalletField("stripImageGoogle", result.googleUrl)
                    store.getState().setWalletField("stripImagePosition", { x: 0.5, y: 0.5 })
                    store.getState().setWalletField("stripImageZoom", 1)
                  }
                } finally {
                  setIsUploadingStrip(false)
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: 0,
                borderRadius: 10,
                border: `2px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                backgroundColor: "transparent",
                cursor: isUploadingStrip ? "wait" : "pointer",
                overflow: "hidden",
                opacity: isUploadingStrip ? 0.6 : 1,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preset.src}
                alt={preset.label}
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 400,
                  color: "var(--foreground)",
                  padding: "0 4px 4px",
                  textAlign: "center",
                  width: "100%",
                }}
              >
                {preset.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Uploaded strip images from other programs */}
      {organizationId && (
        <MediaGallery
          organizationId={organizationId}
          type="strip"
          currentUrl={stripImageUrl}
          onSelect={(url) => {
            store.getState().setWalletField("stripImageUrl", url)
            store.getState().setWalletField("stripImagePosition", { x: 0.5, y: 0.5 })
            store.getState().setWalletField("stripImageZoom", 1)
          }}
        />
      )}

      {/* Image filters — always available when a strip image is uploaded */}
      {stripImageUrl && (
        <>
          <SectionHeader>{t("filtersSection")}</SectionHeader>

          {/* Opacity slider */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--foreground)" }}>{t("opacity")}</span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                {Math.round(stripOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(stripOpacity * 100)}
              onChange={(e) => store.getState().setWalletField("stripOpacity", Number(e.target.value) / 100)}
              style={{
                width: "100%",
                accentColor: "var(--primary)",
                height: 4,
                cursor: "pointer",
              }}
            />
          </div>

          {/* Grayscale toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              padding: "8px 10px",
              borderRadius: 12,
              border: `1.5px solid ${stripGrayscale ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: stripGrayscale ? "var(--accent)" : "transparent",
            }}
          >
            <input
              type="checkbox"
              checked={stripGrayscale}
              onChange={(e) => store.getState().setWalletField("stripGrayscale", e.target.checked)}
              style={{ accentColor: "var(--primary)", width: 14, height: 14 }}
            />
            <span style={{ fontSize: 12, color: "var(--foreground)" }}>{t("blackAndWhite")}</span>
          </label>
        </>
      )}

      {/* Fill mode — flat or gradient */}
      <SectionHeader>{t("fillSection")}</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, marginBottom: 8 }}>
        {(["flat", "gradient"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => store.getState().setWalletField("stripFill", mode)}
            aria-pressed={stripFill === mode}
            style={{
              padding: "8px 10px",
              borderRadius: 9999,
              border: `2px solid ${stripFill === mode ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: stripFill === mode ? "var(--accent)" : "transparent",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: stripFill === mode ? 600 : 400,
              color: "var(--foreground)",
              textAlign: "center",
            }}
          >
            {mode === "flat" ? t("flat") : t("gradient")}
          </button>
        ))}
      </div>

      {/* Strip colors */}
      <SectionHeader>{t("colorsSection")}</SectionHeader>
      <ColorRow
        label={isFlat ? t("colorFlat") : t("colorStart")}
        value={effectiveStripColor1}
        onChange={(v) => store.getState().setWalletField("stripColor1", v)}
      />
      {!isFlat && (
        <ColorRow
          label={t("colorEnd")}
          value={effectiveStripColor2}
          onChange={(v) => store.getState().setWalletField("stripColor2", v)}
        />
      )}
      {(stripColor1 || stripColor2) && (
        <button
          onClick={() => {
            store.getState().setWalletField("stripColor1", null)
            store.getState().setWalletField("stripColor2", null)
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 9999,
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            cursor: "pointer",
            fontSize: 11,
            color: "var(--muted-foreground)",
            marginTop: 4,
          }}
        >
          {t("resetToCardColors")}
        </button>
      )}

      {/* Pattern style — only show when NOT stamp grid */}
      {!isStampGrid && (
        <>
          <SectionHeader>{t("patternSection")}</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
            {PATTERN_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => store.getState().setWalletField("patternStyle", opt.id)}
                aria-pressed={patternStyle === opt.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: `2px solid ${patternStyle === opt.id ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: patternStyle === opt.id ? "var(--accent)" : "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: patternStyle === opt.id ? 600 : 400,
                  color: "var(--foreground)",
                  textAlign: "center",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Pattern color — only when a pattern is selected */}
          {patternStyle !== "NONE" && (
            <>
              <SectionHeader>{t("patternColorSection")}</SectionHeader>
              <ColorRow
                label={t("shapesColor")}
                value={effectivePatternColor}
                onChange={(v) => store.getState().setWalletField("patternColor", v)}
              />
              {patternColor && (
                <button
                  onClick={() => store.getState().setWalletField("patternColor", null)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 9999,
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    marginTop: 4,
                  }}
                >
                  {t("resetToStripColor")}
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* Info when stamp grid is active */}
      {isStampGrid && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            backgroundColor: "var(--muted)",
            marginTop: 16,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {t("stampGridInfo", { surface: stripImageUrl ? t("stampGridSurfaceImage") : isFlat ? t("stampGridSurfaceFlat") : t("stampGridSurfaceGradient") })}
          </div>
        </div>
      )}
        </>
      )}

    </div>
  )
}

// ─── Interactive Strip Crop Widget ──────────────────────────

function StripCropWidget({
  imageUrl,
  position,
  zoom,
  opacity,
  grayscale,
  onPositionChange,
  onZoomChange,
}: {
  imageUrl: string
  position: { x: number; y: number }
  zoom: number
  opacity: number
  grayscale: boolean
  onPositionChange: (pos: { x: number; y: number }) => void
  onZoomChange: (z: number) => void
}) {
  const t = useTranslations("studio.strip")
  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const isDragging = useRef(false)
  const startPos = useRef({ clientX: 0, clientY: 0 })
  const startAnchor = useRef({ x: 0.5, y: 0.5 })

  const anchor = `${position.x * 100}% ${position.y * 100}%`

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      isDragging.current = true
      startPos.current = { clientX: e.clientX, clientY: e.clientY }
      startAnchor.current = { ...position }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [position]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || !frameRef.current) return
      const rect = frameRef.current.getBoundingClientRect()
      const dx = e.clientX - startPos.current.clientX
      const dy = e.clientY - startPos.current.clientY

      // Invert direction: drag right = shift anchor left
      const newX = Math.max(0, Math.min(1, startAnchor.current.x - dx / rect.width))
      const newY = Math.max(0, Math.min(1, startAnchor.current.y - dy / rect.height))

      // Update CSS directly for smooth dragging (no React re-render)
      if (imgRef.current) {
        const a = `${newX * 100}% ${newY * 100}%`
        imgRef.current.style.objectPosition = a
        imgRef.current.style.transformOrigin = a
      }
    },
    []
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || !frameRef.current) return
      isDragging.current = false
      const rect = frameRef.current.getBoundingClientRect()
      const dx = e.clientX - startPos.current.clientX
      const dy = e.clientY - startPos.current.clientY

      const newX = Math.max(0, Math.min(1, startAnchor.current.x - dx / rect.width))
      const newY = Math.max(0, Math.min(1, startAnchor.current.y - dy / rect.height))
      onPositionChange({ x: newX, y: newY })
    },
    [onPositionChange]
  )

  return (
    <div
      ref={frameRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        aspectRatio: "1125 / 432",
        width: "100%",
        borderRadius: 14,
        border: "1px solid var(--border)",
        backgroundColor: "var(--muted)",
        overflow: "hidden",
        position: "relative",
        cursor: "grab",
        touchAction: "none",
        userSelect: "none",
        marginBottom: 4,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Strip crop preview"
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: anchor,
          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
          transformOrigin: anchor,
          opacity,
          filter: grayscale ? "grayscale(1)" : undefined,
          pointerEvents: "none",
        }}
      />
      {/* Drag hint */}
      <div
        style={{
          position: "absolute",
          bottom: 4,
          right: 6,
          fontSize: 9,
          color: "rgba(255,255,255,0.7)",
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          pointerEvents: "none",
          fontWeight: 500,
        }}
      >
        {t("dragToReposition")}
      </div>
    </div>
  )
}

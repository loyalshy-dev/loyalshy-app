"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import type { ColorZone, StudioTool } from "@/types/editor"
import type { CardType } from "@/lib/wallet/card-design"
import { Wand2, Loader2, SlidersHorizontal, Palette, BarChart3, ImagePlus, Image, Bell, FileText, Gift } from "lucide-react"
import { toast } from "sonner"
import { computeTextColor, getFieldConfig, type ProgressStyle, type StampGridConfig } from "@/lib/wallet/card-design"
import { STAMP_ICONS, REWARD_ICONS } from "@/lib/wallet/stamp-icons"
import { blendColors } from "@/lib/wallet/apple/colors"
import {
  uploadOrganizationLogo,
  uploadPlatformLogo,
  deletePlatformLogo,
  extractPaletteFromLogoUrl,
  uploadStripImage,
  deleteStripImage,
} from "@/server/org-settings-actions"
import type { ExtractedPalette } from "@/lib/color-extraction"
import { ProgramPanel } from "../panels/program-panel"
import { ColorsPanel } from "../panels/colors-panel"
import { ProgressPanel } from "../panels/progress-panel"
import { StripPanel } from "../panels/strip-panel"
import { LogoPanel } from "../panels/logo-panel"
import { DetailsPanel } from "../panels/details-panel"
import { NotificationsPanel } from "../panels/notifications-panel"
import { PrizeRevealPanel } from "../panels/prize-reveal-panel"

// ─── Resolved zone: merge labels + text into "fields" ───────

type NotchZone = "background" | "strip" | "fields" | "logo" | "progress"

function toNotchZone(zone: ColorZone): NotchZone {
  if (zone === "labels" || zone === "text") return "fields"
  if (zone === "logo") return "logo"
  if (zone === "progress") return "progress"
  return zone
}

const ZONE_LABELS: Record<NotchZone, string> = {
  background: "Background",
  strip: "Strip",
  fields: "Fields",
  logo: "Logo",
  progress: "Progress",
}

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

function wcagBadge(ratio: number): { label: string; color: string } {
  if (ratio >= 7) return { label: "AAA", color: "#22c55e" }
  if (ratio >= 4.5) return { label: "AA", color: "#84cc16" }
  if (ratio >= 3) return { label: "AA Lg", color: "#f59e0b" }
  return { label: "Fail", color: "#ef4444" }
}

// ─── Strip image presets ─────────────────────────────────────

const STRIP_PRESETS: { id: string; src: string; label: string }[] = [
  { id: "burger", src: "/strip-images/burger.webp", label: "Burger" },
  { id: "caffe-beans", src: "/strip-images/caffe-beans.webp", label: "Coffee" },
  { id: "pizza", src: "/strip-images/pizza.webp", label: "Pizza" },
  { id: "club", src: "/strip-images/club.webp", label: "Club" },
  { id: "gym", src: "/strip-images/gym.jpg", label: "Gym" },
]

// ─── Component ──────────────────────────────────────────────

type Props = {
  store: CardDesignStoreApi
  passType: string
  organizationId: string
  organizationName: string
  organizationLogo: string | null
  templateId: string
  cardType?: CardType
}

export function ContextNotch({ store, passType, organizationId, organizationName, organizationLogo, templateId }: Props) {
  const selectedZone = useStore(store, (s) => s.ui.selectedColorZone)
  const previewFormat = useStore(store, (s) => s.ui.previewFormat)
  const primaryColor = useStore(store, (s) => s.wallet.primaryColor)
  const secondaryColor = useStore(store, (s) => s.wallet.secondaryColor)
  const textColor = useStore(store, (s) => s.wallet.textColor)
  const labelColor = useStore(store, (s) => s.wallet.labelColor)
  const autoTextColor = useStore(store, (s) => s.wallet.autoTextColor)
  const showStrip = useStore(store, (s) => s.wallet.showStrip)
  const stripOpacity = useStore(store, (s) => s.wallet.stripOpacity)
  const stripGrayscale = useStore(store, (s) => s.wallet.stripGrayscale)
  const stripFill = useStore(store, (s) => s.wallet.stripFill)
  const stripColor1 = useStore(store, (s) => s.wallet.stripColor1)
  const stripColor2 = useStore(store, (s) => s.wallet.stripColor2)
  const stripImageUrl = useStore(store, (s) => s.wallet.stripImageUrl)
  const stripImageZoom = useStore(store, (s) => s.wallet.stripImageZoom)
  const logoAppleUrl = useStore(store, (s) => s.wallet.logoAppleUrl)
  const logoGoogleUrl = useStore(store, (s) => s.wallet.logoGoogleUrl)
  const logoAppleZoom = useStore(store, (s) => s.wallet.logoAppleZoom)
  const progressStyle = useStore(store, (s) => s.wallet.progressStyle)
  const useStampGrid = useStore(store, (s) => s.wallet.useStampGrid)
  const customProgressLabel = useStore(store, (s) => s.wallet.customProgressLabel)
  const stampGridConfig = useStore(store, (s) => s.wallet.stampGridConfig)

  const isGoogle = previewFormat === "google"
  const isStampType = passType === "STAMP_CARD" || passType === "POINTS"
  const hasLogo = !!(logoAppleUrl || logoGoogleUrl)
  const notchZone: NotchZone | null = selectedZone ? toNotchZone(selectedZone) : null

  function dismiss() {
    store.getState().setSelectedColorZone(null)
  }

  const isExpanded = !!notchZone
  const label = notchZone ? ZONE_LABELS[notchZone] : null

  // For header: show the primary color of the zone (null for logo — no color swatch)
  // For header: show the primary color of the zone (null for logo/strip — no header swatch)
  const headerColor =
    notchZone === "background" ? primaryColor
    : notchZone === "fields" ? textColor
    : null

  // Measure expanded content height for smooth animation
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)
  const [displayNotchZone, setDisplayNotchZone] = useState<NotchZone | null>(null)

  useEffect(() => {
    if (notchZone) {
      setDisplayNotchZone(notchZone)
    }
  }, [notchZone])

  // Measure content when anything that changes height updates
  useEffect(() => {
    if (contentRef.current && displayNotchZone) {
      // Use requestAnimationFrame to measure after render
      requestAnimationFrame(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.scrollHeight)
        }
      })
    }
  }, [displayNotchZone, showStrip, stripFill, labelColor, isGoogle, hasLogo, stripImageUrl, logoAppleUrl, logoGoogleUrl, useStampGrid, progressStyle, stampGridConfig])

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    // Only respond to our own transitions, not children
    if (e.target !== e.currentTarget) return
    if (!notchZone) {
      setDisplayNotchZone(null)
      setContentHeight(0)
    }
  }, [notchZone])

  return (
    <div
      onTransitionEnd={handleTransitionEnd}
      style={{
        padding: isExpanded ? "10px 14px" : "6px 16px",
        borderRadius: isExpanded ? 14 : 20,
        backgroundColor: "var(--background)",
        border: "1px solid var(--border)",
        boxShadow: isExpanded
          ? "0 4px 16px rgba(0,0,0,0.1)"
          : "0 2px 8px rgba(0,0,0,0.08)",
        minWidth: isExpanded ? 280 : 0,
        maxWidth: 360,
        overflow: "hidden",
        transition: "padding 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease, min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 24 }}>
        {!isExpanded && !displayNotchZone && (
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
            Click an element to edit
          </span>
        )}

        {displayNotchZone && (
          <>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--foreground)",
                flex: 1,
                whiteSpace: "nowrap",
                opacity: isExpanded ? 1 : 0,
                transition: "opacity 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {displayNotchZone === "logo" && <PlatformIcon isGoogle={isGoogle} />}
              {ZONE_LABELS[displayNotchZone]}
            </span>

            {/* Color swatches (not for logo zone) */}
            {headerColor && (
              <>
                <ColorSwatch
                  color={headerColor}
                  onChange={(v) => {
                    const state = store.getState()
                    if (displayNotchZone === "background") {
                      state.setWalletField("primaryColor", v)
                      if (autoTextColor) state.setWalletField("textColor", computeTextColor(v))
                    } else if (displayNotchZone === "strip") {
                      state.setWalletField("secondaryColor", v)
                    } else {
                      state.setWalletField("textColor", v)
                      state.setWalletField("autoTextColor", false)
                    }
                  }}
                  label={`${ZONE_LABELS[displayNotchZone]} color`}
                  enabled={isExpanded}
                />

                {displayNotchZone === "fields" && !isGoogle && (
                  <ColorSwatch
                    color={labelColor ?? blendColors(textColor, primaryColor, 0.3)}
                    onChange={(v) => store.getState().setWalletField("labelColor", v)}
                    label="Label color"
                    enabled={isExpanded}
                    small
                  />
                )}

                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "var(--muted-foreground)",
                    opacity: isExpanded ? 1 : 0,
                    transition: "opacity 0.2s ease",
                  }}
                >
                  {headerColor.toUpperCase()}
                </span>
              </>
            )}

            <button
              onClick={dismiss}
              aria-label="Close"
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "none",
                backgroundColor: "var(--muted)",
                color: "var(--muted-foreground)",
                cursor: "pointer",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                opacity: isExpanded ? 1 : 0,
                transform: isExpanded ? "scale(1)" : "scale(0.5)",
                transition: "opacity 0.15s ease, transform 0.15s ease",
                pointerEvents: isExpanded ? "auto" : "none",
              }}
            >
              ✕
            </button>
          </>
        )}
      </div>

      {/* Expandable content */}
      <div
        style={{
          height: isExpanded ? contentHeight : 0,
          opacity: isExpanded ? 1 : 0,
          overflow: "hidden",
          transition: "height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
        }}
      >
        <div ref={contentRef} style={{ paddingTop: 10 }}>
          {displayNotchZone === "strip" && (
            <StripControls
              stripFill={stripFill}
              stripColor1={stripColor1 ?? primaryColor}
              stripColor2={stripColor2 ?? secondaryColor}
              stripOpacity={stripOpacity}
              stripGrayscale={stripGrayscale}
              stripImageUrl={stripImageUrl}
              stripImageZoom={stripImageZoom}
              templateId={templateId}
              store={store}
            />
          )}

          {displayNotchZone === "fields" && (
            <FieldsControls
              store={store}
              passType={passType}
              autoTextColor={autoTextColor}
              textColor={textColor}
              primaryColor={primaryColor}
              labelColor={labelColor}
              isGoogle={isGoogle}
            />
          )}

          {displayNotchZone === "logo" && (
            <LogoControls
              store={store}
              organizationId={organizationId}
              organizationName={organizationName}
              organizationLogo={organizationLogo}
              hasLogo={hasLogo}
              logoAppleUrl={logoAppleUrl}
              logoGoogleUrl={logoGoogleUrl}
              logoAppleZoom={logoAppleZoom}
              isGoogle={isGoogle}
            />
          )}

          {displayNotchZone === "progress" && isStampType && (
            <ProgressControls
              store={store}
              progressStyle={progressStyle}
              useStampGrid={useStampGrid}
              customProgressLabel={customProgressLabel}
            />
          )}

          {/* Background: no extra controls — color swatch is enough */}
        </div>
      </div>
    </div>
  )
}

// ─── Floating Tool Menu (replaces sidebar) ──────────────────

type ToolMenuItem = {
  id: StudioTool
  label: string
  icon: React.ReactNode
}

const TOOL_MENU_ITEMS: ToolMenuItem[] = [
  { id: "program", label: "Program", icon: <SlidersHorizontal size={18} /> },
  { id: "colors", label: "Colors", icon: <Palette size={18} /> },
  { id: "progress", label: "Progress", icon: <BarChart3 size={18} /> },
  { id: "strip", label: "Strip", icon: <ImagePlus size={18} /> },
  { id: "logo", label: "Logo", icon: <Image size={18} /> },
  { id: "prize", label: "Prize", icon: <Gift size={18} /> },
  { id: "notifications", label: "Alerts", icon: <Bell size={18} /> },
  { id: "details", label: "Back", icon: <FileText size={18} /> },
]

export function FloatingToolMenu({ store, cardType }: { store: CardDesignStoreApi; cardType?: CardType }) {
  const activeTool = useStore(store, (s) => s.ui.activeTool)
  const selectedZone = useStore(store, (s) => s.ui.selectedColorZone)

  const hasProgress = cardType === "STAMP" || cardType === "POINTS"
  const hasPrize = cardType === "STAMP" || cardType === "COUPON"
  const items = TOOL_MENU_ITEMS.filter((t) => {
    if (t.id === "progress" && !hasProgress) return false
    if (t.id === "prize" && !hasPrize) return false
    return true
  })

  function handleClick(id: StudioTool) {
    const state = store.getState()
    if (activeTool === id) {
      // Toggle off
      state.setActiveTool(null)
    } else {
      // Clear zone selection, open this tool
      if (selectedZone) state.setSelectedColorZone(null)
      state.setActiveTool(id)
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 6,
        borderRadius: 20,
        backgroundColor: "var(--background)",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {items.map((item) => {
        const isActive = activeTool === item.id
        return (
          <button
            key={item.id}
            onClick={() => handleClick(item.id)}
            aria-label={item.label}
            aria-pressed={isActive}
            title={item.label}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              border: "none",
              backgroundColor: isActive ? "var(--primary)" : "transparent",
              color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            {item.icon}
          </button>
        )
      })}
    </div>
  )
}

// ─── Context Panel (floating card) ──────────────────────────

const TOOL_LABELS: Record<StudioTool, string> = {
  program: "Program",
  colors: "Colors",
  progress: "Progress",
  strip: "Strip Image",
  logo: "Logo",
  prize: "Prize Reveal",
  notifications: "Notifications",
  details: "Back of Pass",
}

export function ContextPanel({ store, passType, organizationId, organizationName, organizationLogo, templateId, cardType }: Props) {
  const selectedZone = useStore(store, (s) => s.ui.selectedColorZone)
  const activeTool = useStore(store, (s) => s.ui.activeTool)
  const previewFormat = useStore(store, (s) => s.ui.previewFormat)
  const primaryColor = useStore(store, (s) => s.wallet.primaryColor)
  const secondaryColor = useStore(store, (s) => s.wallet.secondaryColor)
  const textColor = useStore(store, (s) => s.wallet.textColor)
  const labelColor = useStore(store, (s) => s.wallet.labelColor)
  const autoTextColor = useStore(store, (s) => s.wallet.autoTextColor)
  const stripOpacity = useStore(store, (s) => s.wallet.stripOpacity)
  const stripGrayscale = useStore(store, (s) => s.wallet.stripGrayscale)
  const stripFill = useStore(store, (s) => s.wallet.stripFill)
  const stripColor1 = useStore(store, (s) => s.wallet.stripColor1)
  const stripColor2 = useStore(store, (s) => s.wallet.stripColor2)
  const stripImageUrl = useStore(store, (s) => s.wallet.stripImageUrl)
  const stripImageZoom = useStore(store, (s) => s.wallet.stripImageZoom)
  const logoAppleUrl = useStore(store, (s) => s.wallet.logoAppleUrl)
  const logoGoogleUrl = useStore(store, (s) => s.wallet.logoGoogleUrl)
  const logoAppleZoom = useStore(store, (s) => s.wallet.logoAppleZoom)
  const progressStyle = useStore(store, (s) => s.wallet.progressStyle)
  const useStampGrid = useStore(store, (s) => s.wallet.useStampGrid)
  const customProgressLabel = useStore(store, (s) => s.wallet.customProgressLabel)
  const stampsRequired = useStore(store, (s) => s.programConfig.stampsRequired)

  const isGoogle = previewFormat === "google"
  const isStampType = passType === "STAMP_CARD" || passType === "POINTS"
  const hasLogo = !!(logoAppleUrl || logoGoogleUrl)
  const notchZone: NotchZone | null = selectedZone ? toNotchZone(selectedZone) : null
  const hasProgress = cardType === "STAMP" || cardType === "POINTS"

  // activeTool (menu click) takes priority over zone (card click)
  const mode: "tool" | "zone" | null = activeTool ? "tool" : notchZone ? "zone" : null
  const isOpen = mode !== null

  // Track what triggered the panel so we can animate on switch
  const [panelKey, setPanelKey] = useState(0)
  const prevModeRef = useRef<string | null>(null)
  const currentId = mode === "tool" ? activeTool : notchZone
  useEffect(() => {
    const id = currentId ?? ""
    if (id !== prevModeRef.current && id) {
      setPanelKey((k) => k + 1)
    }
    prevModeRef.current = id
  }, [currentId])

  function dismiss() {
    if (mode === "tool") {
      store.getState().setActiveTool(null)
    } else {
      store.getState().setSelectedColorZone(null)
    }
  }

  // Zone-specific header color swatch
  const headerColor =
    mode === "zone" && notchZone === "background" ? primaryColor
    : mode === "zone" && notchZone === "fields" ? textColor
    : null

  // Panel title
  const title = mode === "tool" && activeTool
    ? TOOL_LABELS[activeTool]
    : notchZone
      ? ZONE_LABELS[notchZone]
      : ""

  if (!isOpen) return null

  // Offset left to not overlap the floating tool menu (52px menu + 12px gap)
  return (
    <div
      key={panelKey}
      style={{
        position: "absolute",
        top: 12,
        left: 80,
        bottom: 12,
        width: 360,
        zIndex: 15,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--background)",
        borderRadius: 24,
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        overflow: "hidden",
        animation: "contextPanelIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "16px 20px 14px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--foreground)",
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {mode === "zone" && notchZone === "logo" && <PlatformIcon isGoogle={isGoogle} />}
          {title}
        </span>

        {/* Zone-specific color swatches */}
        {headerColor && (
          <>
            <ColorSwatch
              color={headerColor}
              onChange={(v) => {
                const state = store.getState()
                if (notchZone === "background") {
                  state.setWalletField("primaryColor", v)
                  if (autoTextColor) state.setWalletField("textColor", computeTextColor(v))
                } else {
                  state.setWalletField("textColor", v)
                  state.setWalletField("autoTextColor", false)
                }
              }}
              label={`${title} color`}
              enabled
            />

            {notchZone === "fields" && !isGoogle && (
              <ColorSwatch
                color={labelColor ?? blendColors(textColor, primaryColor, 0.3)}
                onChange={(v) => store.getState().setWalletField("labelColor", v)}
                label="Label color"
                enabled
                small
              />
            )}

            <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)" }}>
              {headerColor.toUpperCase()}
            </span>
          </>
        )}

        <button
          onClick={dismiss}
          aria-label="Close panel"
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            border: "none",
            backgroundColor: "var(--muted)",
            color: "var(--muted-foreground)",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px 24px",
        }}
      >
        {/* ── Tool panels (from menu icons) ── */}
        {mode === "tool" && activeTool === "program" && (
          <ProgramPanel store={store} passType={passType} />
        )}
        {mode === "tool" && activeTool === "colors" && (
          <ColorsPanel store={store} />
        )}
        {mode === "tool" && activeTool === "progress" && hasProgress && (
          <ProgressPanel store={store} programId={templateId} visitsRequired={stampsRequired} />
        )}
        {mode === "tool" && activeTool === "strip" && (
          <StripPanel store={store} programId={templateId} forceStrip={hasProgress} />
        )}
        {mode === "tool" && activeTool === "logo" && (
          <LogoPanel store={store} organizationId={organizationId} organizationName={organizationName} organizationLogo={organizationLogo} />
        )}
        {mode === "tool" && activeTool === "prize" && (
          <PrizeRevealPanel store={store} />
        )}
        {mode === "tool" && activeTool === "notifications" && (
          <NotificationsPanel store={store} organizationName={organizationName} organizationLogo={organizationLogo} />
        )}
        {mode === "tool" && activeTool === "details" && (
          <DetailsPanel store={store} />
        )}

        {/* ── Zone panels (from card clicks) ── */}
        {mode === "zone" && notchZone === "strip" && (
          <StripControls
            stripFill={stripFill}
            stripColor1={stripColor1 ?? primaryColor}
            stripColor2={stripColor2 ?? secondaryColor}
            stripOpacity={stripOpacity}
            stripGrayscale={stripGrayscale}
            stripImageUrl={stripImageUrl}
            stripImageZoom={stripImageZoom}
            templateId={templateId}
            store={store}
          />
        )}

        {mode === "zone" && notchZone === "fields" && (
          <FieldsControls
            store={store}
            passType={passType}
            autoTextColor={autoTextColor}
            textColor={textColor}
            primaryColor={primaryColor}
            labelColor={labelColor}
            isGoogle={isGoogle}
          />
        )}

        {mode === "zone" && notchZone === "logo" && (
          <LogoControls
            store={store}
            organizationId={organizationId}
            organizationName={organizationName}
            organizationLogo={organizationLogo}
            hasLogo={hasLogo}
            logoAppleUrl={logoAppleUrl}
            logoGoogleUrl={logoGoogleUrl}
            logoAppleZoom={logoAppleZoom}
            isGoogle={isGoogle}
          />
        )}

        {mode === "zone" && notchZone === "progress" && isStampType && (
          <ProgressControls
            store={store}
            progressStyle={progressStyle}
            useStampGrid={useStampGrid}
            customProgressLabel={customProgressLabel}
          />
        )}

        {mode === "zone" && notchZone === "background" && (
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
            Use the color swatch above to change the card background, or pick a preset from the Colors tool.
          </div>
        )}
      </div>

      {/* CSS keyframe for entrance animation */}
      <style>{`
        @keyframes contextPanelIn {
          from { opacity: 0; transform: translateX(-8px) scale(0.98); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

// ─── Color swatch with inline picker ────────────────────────

function ColorSwatch({
  color,
  onChange,
  label,
  enabled,
  small,
}: {
  color: string
  onChange: (v: string) => void
  label: string
  enabled: boolean
  small?: boolean
}) {
  const size = small ? 18 : 24
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: small ? 4 : 6,
          backgroundColor: color,
          border: "1px solid var(--border)",
          transition: "background-color 0.15s ease",
        }}
      />
      {enabled && (
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
          aria-label={label}
        />
      )}
    </div>
  )
}

// ─── Fields controls (merged labels + values) ───────────────

function FieldsControls({
  store,
  passType,
  autoTextColor,
  textColor,
  primaryColor,
  labelColor,
  isGoogle,
}: {
  store: CardDesignStoreApi
  passType: string
  autoTextColor: boolean
  textColor: string
  primaryColor: string
  labelColor: string | null
  isGoogle: boolean
}) {
  const rawFields = useStore(store, (s) => s.wallet.fields)
  const rawFieldLabels = useStore(store, (s) => s.wallet.fieldLabels)
  const rawHeader = useStore(store, (s) => s.wallet.headerFields)
  const rawSecondary = useStore(store, (s) => s.wallet.secondaryFields)

  const fieldConfig = getFieldConfig(passType)
  const fields = rawFields
    ?? (rawHeader || rawSecondary
      ? [...(rawHeader ?? fieldConfig.defaultHeader), ...(rawSecondary ?? fieldConfig.defaultSecondary)]
      : null)
    ?? [...fieldConfig.defaultFields]
  const fieldLabels = rawFieldLabels ?? {}

  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  const ratio = contrastRatio(primaryColor, textColor)
  const badge = wcagBadge(ratio)

  function handleFieldsChange(updated: string[]) {
    const state = store.getState()
    state.setWalletField("fields", updated)
    state.setWalletField("headerFields", null)
    state.setWalletField("secondaryFields", null)
  }

  function handleLabelChange(fieldId: string, newLabel: string) {
    const updated = { ...fieldLabels }
    if (!newLabel) {
      delete updated[fieldId]
    } else {
      updated[fieldId] = newLabel
    }
    store.getState().setWalletField("fieldLabels", Object.keys(updated).length > 0 ? updated : null)
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Color controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={controlLabelStyle}>Auto</span>
        <MiniToggle
          checked={autoTextColor}
          onChange={(v) => {
            const state = store.getState()
            state.setWalletField("autoTextColor", v)
            if (v) state.setWalletField("textColor", computeTextColor(primaryColor))
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: badge.color,
            padding: "1px 5px",
            borderRadius: 3,
            border: `1px solid ${badge.color}`,
            marginLeft: 4,
          }}
        >
          {badge.label} {ratio.toFixed(1)}:1
        </span>

        {/* Label color mode (Apple only) */}
        {!isGoogle && (
          <button
            onClick={() => {
              if (labelColor) {
                store.getState().setWalletField("labelColor", null)
              } else {
                store.getState().setWalletField("labelColor", blendColors(textColor, primaryColor, 0.3))
              }
            }}
            style={{
              marginLeft: "auto",
              padding: "2px 6px",
              borderRadius: 3,
              border: "1px solid var(--border)",
              backgroundColor: labelColor ? "var(--accent)" : "transparent",
              color: "var(--muted-foreground)",
              cursor: "pointer",
              fontSize: 11,
            }}
            title={labelColor ? "Label color: custom" : "Label color: auto"}
          >
            Labels: {labelColor ? "Custom" : "Auto"}
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "var(--border)" }} />

      {/* Card Fields header */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
          Card Fields
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4, marginBottom: 10 }}>
          Click a label to rename. Apple: first → header, rest → details. Google: auto rows.
        </div>
      </div>

      {/* Field list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {fields.map((id, i) => (
          <div
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 10px",
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
                title="Click to rename"
                onClick={() => startEdit(id)}
              >
                {getDisplayLabel(id)}
                {fieldLabels[id] && (
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 3 }}>✎</span>
                )}
              </span>
            )}

            {/* Move buttons */}
            <button
              onClick={() => moveField(i, -1)}
              disabled={i === 0}
              style={moveButtonStyle(i === 0)}
              aria-label={`Move ${getDisplayLabel(id)} up`}
            >
              ↑
            </button>
            <button
              onClick={() => moveField(i, 1)}
              disabled={i === fields.length - 1}
              style={moveButtonStyle(i === fields.length - 1)}
              aria-label={`Move ${getDisplayLabel(id)} down`}
            >
              ↓
            </button>
            <button
              onClick={() => removeField(id)}
              style={{ padding: "0 3px", border: "none", background: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 12, lineHeight: 1 }}
              aria-label={`Remove ${getDisplayLabel(id)}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add field */}
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
          }}
        >
          <option value="">+ Add field...</option>
          {available.map((f) => (
            <option key={f.id} value={f.id}>{fieldLabels[f.id] ?? f.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// ─── Strip controls ─────────────────────────────────────────

function StripControls({
  stripFill,
  stripColor1,
  stripColor2,
  stripOpacity,
  stripGrayscale,
  stripImageUrl,
  stripImageZoom,
  templateId,
  store,
}: {
  stripFill: "flat" | "gradient"
  stripColor1: string
  stripColor2: string
  stripOpacity: number
  stripGrayscale: boolean
  stripImageUrl: string | null
  stripImageZoom: number
  templateId: string
  store: CardDesignStoreApi
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("templateId", templateId)
      formData.set("file", file)
      const result = await uploadStripImage(formData)
      if ("originalUrl" in result && result.originalUrl) {
        store.getState().setWalletField("stripImageUrl", result.originalUrl)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    await deleteStripImage(templateId)
    const s = store.getState()
    s.setWalletField("stripImageUrl", null)
    s.setWalletField("stripImageApple", null)
    s.setWalletField("stripImageGoogle", null)
  }

  async function handlePresetSelect(preset: { id: string; src: string }) {
    setUploading(true)
    try {
      const res = await fetch(preset.src)
      const blob = await res.blob()
      const ext = preset.src.endsWith(".jpg") ? "jpg" : "webp"
      const file = new File([blob], `${preset.id}.${ext}`, { type: blob.type })
      const formData = new FormData()
      formData.set("templateId", templateId)
      formData.set("file", file)
      const result = await uploadStripImage(formData)
      if ("originalUrl" in result && result.originalUrl) {
        const s = store.getState()
        s.setWalletField("stripImageUrl", result.originalUrl)
        if ("appleUrl" in result && result.appleUrl) s.setWalletField("stripImageApple", result.appleUrl)
        if ("googleUrl" in result && result.googleUrl) s.setWalletField("stripImageGoogle", result.googleUrl)
        s.setWalletField("stripImagePosition", { x: 0.5, y: 0.5 })
        s.setWalletField("stripImageZoom", 1)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Image upload */}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              await handleUpload(file)
              if (fileRef.current) fileRef.current.value = ""
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={controlLabelStyle}>Image</span>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                padding: "5px 10px",
                borderRadius: 9999,
                border: "1px solid var(--border)",
                backgroundColor: "var(--muted)",
                cursor: uploading ? "wait" : "pointer",
                fontSize: 11,
                color: "var(--foreground)",
              }}
            >
              {uploading ? "..." : stripImageUrl ? "Replace" : "Upload"}
            </button>
            {stripImageUrl && (
              <button
                onClick={handleRemove}
                style={{
                  padding: "5px 8px",
                  borderRadius: 9999,
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--destructive)",
                }}
              >
                Remove
              </button>
            )}
          </div>

          {/* Image zoom */}
          {stripImageUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={controlLabelStyle}>Zoom</span>
              <input
                type="range"
                min={100}
                max={300}
                step={1}
                value={Math.round(stripImageZoom * 100)}
                onChange={(e) => store.getState().setWalletField("stripImageZoom", Number(e.target.value) / 100)}
                style={{ flex: 1, height: 4, accentColor: "var(--primary)" }}
                aria-label="Strip image zoom"
              />
              <span style={valueStyle}>{stripImageZoom.toFixed(1)}x</span>
            </div>
          )}

          {/* Preset strip images */}
          <div style={{ height: 1, backgroundColor: "var(--border)" }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>Presets</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {STRIP_PRESETS.map((preset) => {
              const isActive = stripImageUrl?.includes(preset.id) ?? false
              return (
                <button
                  key={preset.id}
                  disabled={uploading}
                  onClick={() => handlePresetSelect(preset)}
                  style={{
                    padding: 0,
                    borderRadius: 10,
                    border: `1.5px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                    backgroundColor: "transparent",
                    cursor: uploading ? "wait" : "pointer",
                    overflow: "hidden",
                    opacity: uploading ? 0.6 : 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preset.src}
                    alt={preset.label}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                  />
                  <span style={{ fontSize: 7, color: "var(--muted-foreground)", padding: "2px 1px", textAlign: "center", width: "100%", lineHeight: 1.2 }}>
                    {preset.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ height: 1, backgroundColor: "var(--border)" }} />

          {/* Fill mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={controlLabelStyle}>Fill</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["flat", "gradient"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => store.getState().setWalletField("stripFill", mode)}
                  aria-pressed={stripFill === mode}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 9999,
                    border: "1px solid var(--border)",
                    backgroundColor: stripFill === mode ? "var(--primary)" : "transparent",
                    color: stripFill === mode ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: stripFill === mode ? 600 : 400,
                    textTransform: "capitalize",
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={controlLabelStyle}>{stripFill === "gradient" ? "Start" : "Color"}</span>
            <InlineColorPicker
              value={stripColor1}
              onChange={(v) => store.getState().setWalletField("stripColor1", v)}
              label="Strip color 1"
            />
            {stripFill === "gradient" && (
              <>
                <span style={controlLabelStyle}>End</span>
                <InlineColorPicker
                  value={stripColor2}
                  onChange={(v) => store.getState().setWalletField("stripColor2", v)}
                  label="Strip color 2"
                />
              </>
            )}
          </div>

          {/* Opacity */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={controlLabelStyle}>Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(stripOpacity * 100)}
              onChange={(e) => store.getState().setWalletField("stripOpacity", Number(e.target.value) / 100)}
              style={{ flex: 1, height: 4, accentColor: "var(--primary)" }}
              aria-label="Strip opacity"
            />
            <span style={valueStyle}>{Math.round(stripOpacity * 100)}%</span>
          </div>

          {/* B&W */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={controlLabelStyle}>B&W</span>
            <MiniToggle
              checked={stripGrayscale}
              onChange={(v) => store.getState().setWalletField("stripGrayscale", v)}
            />
          </div>
    </div>
  )
}

// ─── Progress controls ───────────────────────────────────────

type ProgressOption = {
  id: "STAMP_GRID" | ProgressStyle
  label: string
  example: string
}

const PROGRESS_OPTIONS: ProgressOption[] = [
  { id: "STAMP_GRID", label: "Grid", example: "◆◆◆◇" },
  { id: "NUMBERS", label: "Nums", example: "4/10" },
  { id: "CIRCLES", label: "Circles", example: "●●○○" },
  { id: "SQUARES", label: "Squares", example: "■■□□" },
  { id: "STARS", label: "Stars", example: "★★☆☆" },
  { id: "STAMPS", label: "Stamps", example: "◉◉◎◎" },
  { id: "PERCENTAGE", label: "Pct", example: "40%" },
  { id: "REMAINING", label: "Left", example: "6 left" },
]

function ProgressControls({
  store,
  progressStyle,
  useStampGrid,
  customProgressLabel,
}: {
  store: CardDesignStoreApi
  progressStyle: ProgressStyle
  useStampGrid: boolean
  customProgressLabel: string
}) {
  const stampGridConfig = useStore(store, (s) => s.wallet.stampGridConfig)
  const stampFilledColor = useStore(store, (s) => s.wallet.stampFilledColor)
  const secondaryColor = useStore(store, (s) => s.wallet.secondaryColor)
  const stripColor2 = useStore(store, (s) => s.wallet.stripColor2)
  const walletTextColor = useStore(store, (s) => s.wallet.textColor)
  const walletPrimaryColor = useStore(store, (s) => s.wallet.primaryColor)

  const activeId: "STAMP_GRID" | ProgressStyle = useStampGrid ? "STAMP_GRID" : progressStyle
  const effectiveStampColor = stampFilledColor ?? stripColor2 ?? secondaryColor

  const [openSection, setOpenSection] = useState<string | null>(null)

  function handleSelect(id: "STAMP_GRID" | ProgressStyle) {
    const s = store.getState()
    if (id === "STAMP_GRID") {
      s.setWalletField("useStampGrid", true)
      if (!s.wallet.showStrip) s.setWalletField("showStrip", true)
    } else {
      s.setWalletField("useStampGrid", false)
      s.setWalletField("progressStyle", id)
    }
  }

  function updateGrid(patch: Partial<StampGridConfig>) {
    store.getState().setWalletField("stampGridConfig", { ...stampGridConfig, ...patch })
  }

  function toggleSection(id: string) {
    setOpenSection(openSection === id ? null : id)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Style grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
        {PROGRESS_OPTIONS.map((opt) => {
          const isActive = activeId === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              aria-pressed={isActive}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "8px 4px",
                borderRadius: 12,
                border: `1.5px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                backgroundColor: isActive ? "var(--accent)" : "transparent",
                cursor: "pointer",
                minHeight: 48,
              }}
            >
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted-foreground)", lineHeight: 1, letterSpacing: "0.02em" }}>
                {opt.example}
              </span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: "var(--foreground)", lineHeight: 1 }}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Custom label (text styles only) */}
      {!useStampGrid && (
        <>
          <div style={{ height: 1, backgroundColor: "var(--border)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={controlLabelStyle}>Label</span>
            <input
              type="text"
              value={customProgressLabel}
              onChange={(e) => store.getState().setWalletField("customProgressLabel", e.target.value)}
              placeholder="Progress"
              maxLength={30}
              style={{
                flex: 1,
                padding: "5px 10px",
                borderRadius: 9999,
                border: "1px solid var(--border)",
                backgroundColor: "var(--background)",
                fontSize: 12,
                color: "var(--foreground)",
                outline: "none",
                minWidth: 0,
              }}
            />
          </div>
        </>
      )}

      {/* Stamp Grid Configuration */}
      {useStampGrid && (
        <>
          <div style={{ height: 1, backgroundColor: "var(--border)" }} />

          {/* ── Shape & Size ── */}
          <NotchAccordion label="Shape & Size" isOpen={openSection === "shape"} onToggle={() => toggleSection("shape")}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={controlLabelStyle}>Shape</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["circle", "rounded-square", "square"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateGrid({ stampShape: s })}
                    aria-pressed={stampGridConfig.stampShape === s}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 9999,
                      border: `1.5px solid ${stampGridConfig.stampShape === s ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor: stampGridConfig.stampShape === s ? "var(--accent)" : "transparent",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: stampGridConfig.stampShape === s ? 600 : 400,
                      color: "var(--foreground)",
                    }}
                  >
                    {s === "circle" ? "Circle" : s === "rounded-square" ? "Rounded" : "Square"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={controlLabelStyle}>Size</span>
              <input
                type="range"
                min={40}
                max={90}
                step={5}
                value={Math.round((stampGridConfig.stampIconScale ?? 0.6) * 100)}
                onChange={(e) => updateGrid({ stampIconScale: Number(e.target.value) / 100 })}
                style={{ flex: 1, height: 4, accentColor: "var(--primary)" }}
                aria-label="Icon scale"
              />
              <span style={valueStyle}>{Math.round((stampGridConfig.stampIconScale ?? 0.6) * 100)}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: "var(--foreground)" }}>
                <input
                  type="checkbox"
                  checked={stampGridConfig.useUniformIcon}
                  onChange={(e) => updateGrid({ useUniformIcon: e.target.checked })}
                  style={{ accentColor: "var(--primary)", width: 12, height: 12 }}
                />
                Same icon for all slots
              </label>
            </div>
          </NotchAccordion>

          {/* ── Filled Stamps ── */}
          <NotchAccordion label="Filled Stamps" isOpen={openSection === "filled"} onToggle={() => toggleSection("filled")}>
            {/* Icon presets */}
            {!stampGridConfig.customStampIconUrl && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2, marginBottom: 10 }}>
                {STAMP_ICONS.map((icon) => (
                  <button
                    key={icon.id}
                    onClick={() => updateGrid({ stampIcon: icon.id, customStampIconUrl: null })}
                    aria-pressed={stampGridConfig.stampIcon === icon.id}
                    style={{
                      padding: 4,
                      borderRadius: 8,
                      border: `1.5px solid ${stampGridConfig.stampIcon === icon.id ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor: stampGridConfig.stampIcon === icon.id ? "var(--accent)" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={icon.label}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icon.paths }} />
                  </button>
                ))}
              </div>
            )}

            {/* Filled style */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={controlLabelStyle}>Style</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["icon", "icon-with-border", "solid"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateGrid({ filledStyle: s })}
                    aria-pressed={stampGridConfig.filledStyle === s}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 9999,
                      border: `1.5px solid ${stampGridConfig.filledStyle === s ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor: stampGridConfig.filledStyle === s ? "var(--accent)" : "transparent",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: stampGridConfig.filledStyle === s ? 600 : 400,
                      color: "var(--foreground)",
                    }}
                  >
                    {s === "icon" ? "Icon" : s === "icon-with-border" ? "Border" : "Solid"}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={controlLabelStyle}>Color</span>
              <InlineColorPicker
                value={effectiveStampColor}
                onChange={(v) => store.getState().setWalletField("stampFilledColor", v)}
                label="Stamp filled color"
              />
              {stampFilledColor && (
                <button
                  onClick={() => store.getState().setWalletField("stampFilledColor", null)}
                  style={{ fontSize: 10, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Reset
                </button>
              )}
            </div>
          </NotchAccordion>

          {/* ── Empty Slots ── */}
          <NotchAccordion label="Empty Slots" isOpen={openSection === "empty"} onToggle={() => toggleSection("empty")}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={controlLabelStyle}>Opacity</span>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round((stampGridConfig.emptySlotOpacity ?? 0.35) * 100)}
                onChange={(e) => updateGrid({ emptySlotOpacity: Number(e.target.value) / 100 })}
                style={{ flex: 1, height: 4, accentColor: "var(--primary)" }}
                aria-label="Empty slot opacity"
              />
              <span style={valueStyle}>{Math.round((stampGridConfig.emptySlotOpacity ?? 0.35) * 100)}%</span>
            </div>

            {/* Colors */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={controlLabelStyle}>Stroke</span>
              <InlineColorPicker
                value={stampGridConfig.emptySlotColor ?? walletTextColor}
                onChange={(v) => updateGrid({ emptySlotColor: v })}
                label="Empty slot stroke"
              />
              {stampGridConfig.emptySlotColor && (
                <button onClick={() => updateGrid({ emptySlotColor: null })} style={{ fontSize: 10, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Reset
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={controlLabelStyle}>Fill</span>
              {stampGridConfig.emptySlotBg === "transparent" ? (
                <>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Transparent</span>
                  <button onClick={() => updateGrid({ emptySlotBg: null })} style={{ fontSize: 10, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    Reset
                  </button>
                </>
              ) : (
                <>
                  <InlineColorPicker
                    value={stampGridConfig.emptySlotBg ?? walletPrimaryColor}
                    onChange={(v) => updateGrid({ emptySlotBg: v })}
                    label="Empty slot background"
                  />
                  <button
                    onClick={() => updateGrid({ emptySlotBg: "transparent" })}
                    style={{ fontSize: 10, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </NotchAccordion>

          {/* ── Reward Slot ── */}
          <NotchAccordion label="Reward Slot" isOpen={openSection === "reward"} onToggle={() => toggleSection("reward")}>
            {/* Icon presets (only when not uniform) */}
            {!stampGridConfig.useUniformIcon && !stampGridConfig.customRewardIconUrl && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2, marginBottom: 10 }}>
                {REWARD_ICONS.map((icon) => (
                  <button
                    key={icon.id}
                    onClick={() => updateGrid({ rewardIcon: icon.id, customRewardIconUrl: null })}
                    aria-pressed={stampGridConfig.rewardIcon === icon.id}
                    style={{
                      padding: 4,
                      borderRadius: 8,
                      border: `1.5px solid ${stampGridConfig.rewardIcon === icon.id ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor: stampGridConfig.rewardIcon === icon.id ? "var(--accent)" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={icon.label}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icon.paths }} />
                  </button>
                ))}
              </div>
            )}

            {/* Filled style */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={controlLabelStyle}>Style</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["icon", "icon-with-border", "solid"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateGrid({ rewardFilledStyle: s })}
                    aria-pressed={(stampGridConfig.rewardFilledStyle ?? stampGridConfig.filledStyle) === s}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 9999,
                      border: `1.5px solid ${(stampGridConfig.rewardFilledStyle ?? stampGridConfig.filledStyle) === s ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor: (stampGridConfig.rewardFilledStyle ?? stampGridConfig.filledStyle) === s ? "var(--accent)" : "transparent",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: (stampGridConfig.rewardFilledStyle ?? stampGridConfig.filledStyle) === s ? 600 : 400,
                      color: "var(--foreground)",
                    }}
                  >
                    {s === "icon" ? "Icon" : s === "icon-with-border" ? "Border" : "Solid"}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={controlLabelStyle}>Stroke</span>
              <InlineColorPicker
                value={stampGridConfig.rewardSlotColor ?? walletPrimaryColor}
                onChange={(v) => updateGrid({ rewardSlotColor: v })}
                label="Reward slot stroke"
              />
              {stampGridConfig.rewardSlotColor && (
                <button onClick={() => updateGrid({ rewardSlotColor: null })} style={{ fontSize: 10, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Reset
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={controlLabelStyle}>Fill</span>
              {stampGridConfig.rewardSlotBg === "transparent" ? (
                <>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Transparent</span>
                  <button onClick={() => updateGrid({ rewardSlotBg: null })} style={{ fontSize: 10, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    Reset
                  </button>
                </>
              ) : (
                <>
                  <InlineColorPicker
                    value={stampGridConfig.rewardSlotBg ?? effectiveStampColor}
                    onChange={(v) => updateGrid({ rewardSlotBg: v })}
                    label="Reward slot background"
                  />
                  <button
                    onClick={() => updateGrid({ rewardSlotBg: "transparent" })}
                    style={{ fontSize: 10, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </NotchAccordion>
        </>
      )}
    </div>
  )
}

// ─── Notch accordion (compact collapsible section) ───────────

function NotchAccordion({
  label,
  isOpen,
  onToggle,
  children,
}: {
  label: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
      <button
        onClick={onToggle}
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
        }}
      >
        {label}
        <span style={{ fontSize: 10, color: "var(--muted-foreground)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div style={{ padding: "10px 12px 12px" }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Logo controls ──────────────────────────────────────────

function LogoControls({
  store,
  organizationId,
  organizationName,
  organizationLogo,
  hasLogo,
  logoAppleUrl,
  logoGoogleUrl,
  logoAppleZoom,
  isGoogle,
}: {
  store: CardDesignStoreApi
  organizationId: string
  organizationName: string
  organizationLogo: string | null
  hasLogo: boolean
  logoAppleUrl: string | null
  logoGoogleUrl: string | null
  logoAppleZoom: number
  isGoogle: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  const [matchPalette, setMatchPalette] = useState<ExtractedPalette | null>(null)
  const paletteCacheRef = useRef<{ url: string; palette: ExtractedPalette } | null>(null)

  const platform = isGoogle ? "google" as const : "apple" as const
  const activeLogoUrl = isGoogle ? logoGoogleUrl : logoAppleUrl
  const storeField = isGoogle ? "logoGoogleUrl" as const : "logoAppleUrl" as const

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("organizationId", organizationId)
      formData.set("file", file)

      if (!hasLogo) {
        // First upload — auto-generate both platforms
        const result = await uploadOrganizationLogo(formData)
        if ("appleUrl" in result && result.appleUrl && "googleUrl" in result && result.googleUrl) {
          store.getState().setWalletField("logoAppleUrl", result.appleUrl)
          store.getState().setWalletField("logoGoogleUrl", result.googleUrl)
        }
      } else {
        // Replace — only update the current platform
        formData.set("platform", platform)
        const result = await uploadPlatformLogo(formData)
        if ("url" in result && result.url) {
          store.getState().setWalletField(storeField, result.url)
        }
      }
      setMatchPalette(null)
      paletteCacheRef.current = null
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    await deletePlatformLogo(organizationId, platform)
    store.getState().setWalletField(storeField, null)
    setMatchPalette(null)
    paletteCacheRef.current = null
  }

  async function handleBrandMatch() {
    if (!organizationLogo) return
    setIsMatching(true)
    try {
      let palette: ExtractedPalette | null = null
      if (paletteCacheRef.current?.url === organizationLogo) {
        palette = paletteCacheRef.current.palette
      } else {
        const result = await extractPaletteFromLogoUrl(organizationId)
        if ("palette" in result && result.palette) {
          palette = result.palette
          paletteCacheRef.current = { url: organizationLogo, palette }
        }
      }
      if (palette) {
        setMatchPalette(palette)
        const s = store.getState()
        s.setWalletField("primaryColor", palette.primarySuggestion)
        s.setWalletField("secondaryColor", palette.secondarySuggestion)
        s.setWalletField("textColor", palette.textColor)
        toast.success("Colors matched to your brand!")
      } else {
        toast.error("Could not extract colors from logo.")
      }
    } catch {
      toast.error("Failed to extract brand colors.")
    } finally {
      setIsMatching(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          await handleUpload(file)
          if (fileRef.current) fileRef.current.value = ""
        }}
      />

      {/* Format-aware logo preview */}
      {hasLogo && activeLogoUrl && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
            borderRadius: 6,
            backgroundColor: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          {isGoogle ? (
            /* Google: circular crop, 1:1 */
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                overflow: "hidden",
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <img
                src={activeLogoUrl}
                alt={organizationName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            /* Apple: wide rectangle, 3.2:1 */
            <div
              style={{
                width: 160,
                height: 50,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src={activeLogoUrl}
                alt={organizationName}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transform: `scale(${logoAppleZoom})`,
                  transformOrigin: "center",
                }}
              />
            </div>
          )}
          <div style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>
              {isGoogle ? "Google" : "Apple"}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
              {isGoogle ? "660 × 660 · circle crop" : "320 × 100 · transparent"}
            </div>
          </div>
        </div>
      )}

      {/* Upload / Replace / Remove */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={controlLabelStyle}>Image</span>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "5px 10px",
            borderRadius: 9999,
            border: "1px solid var(--border)",
            backgroundColor: "var(--muted)",
            cursor: uploading ? "wait" : "pointer",
            fontSize: 11,
            color: "var(--foreground)",
          }}
        >
          {uploading ? "..." : hasLogo ? "Replace" : "Upload"}
        </button>
        {hasLogo && (
          <button
            onClick={handleDelete}
            style={{
              padding: "5px 8px",
              borderRadius: 9999,
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: 11,
              color: "var(--destructive)",
            }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Apple zoom */}
      {hasLogo && !isGoogle && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={controlLabelStyle}>Zoom</span>
          <input
            type="range"
            min={50}
            max={300}
            step={5}
            value={Math.round(logoAppleZoom * 100)}
            onChange={(e) => store.getState().setWalletField("logoAppleZoom", Number(e.target.value) / 100)}
            style={{ flex: 1, height: 4, accentColor: "var(--primary)" }}
            aria-label="Apple logo zoom"
          />
          <span style={valueStyle}>{logoAppleZoom.toFixed(1)}x</span>
        </div>
      )}

      {/* Brand Match */}
      {hasLogo && (
        <>
          <div style={{ height: 1, backgroundColor: "var(--border)" }} />
          <button
            onClick={handleBrandMatch}
            disabled={isMatching || !organizationLogo}
            style={{
              width: "100%",
              padding: "5px 10px",
              borderRadius: 9999,
              border: "none",
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
              cursor: isMatching ? "not-allowed" : "pointer",
              fontSize: 10,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              opacity: isMatching ? 0.5 : 1,
            }}
          >
            {isMatching ? (
              <>
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                Extracting...
              </>
            ) : (
              <>
                <Wand2 size={11} />
                Match to my brand
              </>
            )}
          </button>

          {matchPalette && matchPalette.colors.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {matchPalette.colors.slice(0, 5).map((c, i) => (
                <div
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: c.hex,
                    border: "1px solid var(--border)",
                  }}
                  title={`${c.hex} (${c.percentage}%)`}
                />
              ))}
              <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 2 }}>
                {matchPalette.isMonochrome ? "Mono" : `${matchPalette.colors.length} colors`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Platform icon (Apple / Google) ──────────────────────────

function PlatformIcon({ isGoogle }: { isGoogle: boolean }) {
  if (isGoogle) {
    // Google "G" mark
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    )
  }
  // Apple logo
  return (
    <svg width="12" height="13" viewBox="0 0 14 17" fill="currentColor">
      <path d="M13.34 12.04c-.32.74-.47 1.07-.88 1.72-.57.91-1.37 2.04-2.37 2.05-.89.01-1.12-.58-2.33-.57-1.2.01-1.46.58-2.35.57-1-.01-1.76-1.04-2.33-1.95C1.54 11.37 1.38 8.57 2.38 7.08c.71-1.06 1.83-1.68 2.89-1.68.97 0 1.58.59 2.38.59.77 0 1.24-.59 2.35-.59.94 0 1.94.51 2.64 1.4-2.32 1.27-1.94 4.58.7 5.24zM9.5 3.83c.44-.57.78-1.37.66-2.18-.72.05-1.57.51-2.06 1.11-.45.54-.82 1.35-.68 2.14.79.02 1.6-.44 2.08-1.07z" />
    </svg>
  )
}

// ─── Shared mini components ─────────────────────────────────

function InlineColorPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          backgroundColor: value,
          border: "1px solid var(--border)",
        }}
      />
      <input
        type="color"
        value={value}
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
        aria-label={label}
      />
    </div>
  )
}

function MiniToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        width: 34,
        height: 20,
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        backgroundColor: checked ? "var(--primary)" : "var(--muted-foreground)",
        position: "relative",
        transition: "background-color 0.15s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: "#fff",
          transition: "left 0.15s",
        }}
      />
    </button>
  )
}

// ─── Styles ─────────────────────────────────────────────────

const controlLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted-foreground)",
  width: 54,
  flexShrink: 0,
}

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: "monospace",
  color: "var(--muted-foreground)",
  width: 38,
  textAlign: "right",
  flexShrink: 0,
}

function moveButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "0 3px",
    border: "none",
    background: "none",
    color: disabled ? "var(--muted)" : "var(--muted-foreground)",
    cursor: disabled ? "default" : "pointer",
    fontSize: 11,
    lineHeight: 1,
  }
}

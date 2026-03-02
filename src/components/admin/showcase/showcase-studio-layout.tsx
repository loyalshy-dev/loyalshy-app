"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { toast } from "sonner"
import { createCardDesignStore } from "@/lib/stores/card-design-store"
import type { CardDesignStoreApi, WalletState } from "@/lib/stores/card-design-store"
import { useStore } from "zustand"
import { useStoreWithEqualityFn } from "zustand/traditional"
import { ShowcaseToolbar } from "./showcase-toolbar"
import { ToolSelector } from "@/components/studio/tools/tool-selector"
import { CanvasPanel } from "@/components/studio/canvas/canvas-panel"
import { PanelShell } from "@/components/studio/panels/panel-shell"
import { ColorsPanel } from "@/components/studio/panels/colors-panel"
import { ShapePanel } from "@/components/studio/panels/shape-panel"
import { ProgressPanel } from "@/components/studio/panels/progress-panel"
import { StripPanel } from "@/components/studio/panels/strip-panel"
import { LabelsPanel } from "@/components/studio/panels/labels-panel"
import { TemplatePanel } from "@/components/studio/panels/template-panel"
import {
  saveShowcaseCardDesign,
  uploadShowcaseStripImage,
  deleteShowcaseStripImage,
  uploadShowcaseStampIcon,
  deleteShowcaseStampIcon,
} from "@/server/showcase-actions"
import type { StudioTool } from "@/types/editor"
import type { CardType } from "@/lib/wallet/card-design"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"

type ShowcaseStudioLayoutProps = {
  showcaseCardId: string
  restaurantName: string
  visitsRequired: number
  rewardDescription: string
  walletData: Record<string, unknown> | null
}

export function ShowcaseStudioLayout({
  showcaseCardId,
  restaurantName,
  visitsRequired,
  rewardDescription,
  walletData,
}: ShowcaseStudioLayoutProps) {
  const cardType: CardType = (walletData?.cardType as CardType) ?? "STAMP"

  // Create store once
  const storeRef = useRef<CardDesignStoreApi | null>(null)
  if (!storeRef.current) {
    storeRef.current = createCardDesignStore()
  }
  const store = storeRef.current

  // Hydrate from server data on mount only — never re-hydrate after
  // revalidatePath (e.g. from strip upload) to avoid overwriting unsaved changes
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    if (walletData) {
      store.getState().hydrate(walletData as Partial<WalletState>)
    }
    store.getState().markClean()
  }, [walletData, store])

  // ─── Selectors ────────────────────────────────────────

  const wallet = useStore(store, (s) => s.wallet)
  const ui = useStore(store, (s) => s.ui)

  const design: WalletPassDesign = {
    cardType,
    shape: wallet.shape,
    primaryColor: wallet.primaryColor,
    secondaryColor: wallet.secondaryColor,
    textColor: wallet.textColor,
    progressStyle: wallet.progressStyle,
    labelFormat: wallet.labelFormat,
    customProgressLabel: wallet.customProgressLabel || null,
    stripImageUrl: wallet.stripImageUrl,
    stripOpacity: wallet.stripOpacity,
    stripGrayscale: wallet.stripGrayscale,
    stripColor1: wallet.stripColor1,
    stripColor2: wallet.stripColor2,
    stripFill: wallet.stripFill,
    patternColor: wallet.patternColor,
    patternStyle: wallet.patternStyle,
    useStampGrid: wallet.useStampGrid,
    stampGridConfig: wallet.stampGridConfig,
    stripImagePosition: wallet.stripImagePosition,
    stripImageZoom: wallet.stripImageZoom,
  }

  // Temporal (undo/redo)
  const temporalStore = store.temporal
  const canUndo = useStoreWithEqualityFn(temporalStore, (s) => s.pastStates.length > 0)
  const canRedo = useStoreWithEqualityFn(temporalStore, (s) => s.futureStates.length > 0)

  // ─── Save handler ─────────────────────────────────────

  const handleSave = useCallback(async () => {
    const state = store.getState()
    if (!state.ui.isDirty || state.ui.isSaving) return

    const walletAtSaveStart = state.wallet

    state.setSaving(true)
    state.setSaveError(null)

    try {
      const result = await saveShowcaseCardDesign({
        id: showcaseCardId,
        cardType: state.wallet.cardType as "STAMP" | "POINTS" | "TIER" | "COUPON",
        shape: state.wallet.shape,
        primaryColor: state.wallet.primaryColor,
        secondaryColor: state.wallet.secondaryColor,
        textColor: state.wallet.textColor,
        autoTextColor: state.wallet.autoTextColor,
        patternStyle: state.wallet.patternStyle,
        progressStyle: state.wallet.progressStyle,
        fontFamily: state.wallet.fontFamily,
        labelFormat: state.wallet.labelFormat,
        customProgressLabel: state.wallet.customProgressLabel,
        palettePreset: state.wallet.palettePreset,
        templateId: state.wallet.templateId,
        stripOpacity: state.wallet.stripOpacity,
        stripGrayscale: state.wallet.stripGrayscale,
        stripColor1: state.wallet.stripColor1,
        stripColor2: state.wallet.stripColor2,
        stripFill: state.wallet.stripFill,
        patternColor: state.wallet.patternColor,
        useStampGrid: state.wallet.useStampGrid,
        stampGridConfig: state.wallet.useStampGrid
          ? state.wallet.stampGridConfig
          : undefined,
        stripImagePosition: (state.wallet.stripImagePosition.x !== 0.5 || state.wallet.stripImagePosition.y !== 0.5)
          ? state.wallet.stripImagePosition
          : undefined,
        stripImageZoom: state.wallet.stripImageZoom !== 1
          ? state.wallet.stripImageZoom
          : undefined,
      })

      if ("error" in result) {
        store.getState().setSaveError(String(result.error))
        toast.error(String(result.error))
      } else {
        const current = store.getState()
        if (current.wallet === walletAtSaveStart) {
          current.markClean()
        }
        toast.success("Design saved!")
      }
    } catch {
      toast.error("Failed to save design")
    } finally {
      store.getState().setSaving(false)
    }
  }, [showcaseCardId, store])

  // ─── Keyboard shortcuts ───────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        temporalStore.getState().undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault()
        temporalStore.getState().redo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave, temporalStore])

  // ─── Strip/stamp upload wrappers ──────────────────────

  const handleUploadStrip = useCallback(async (formData: FormData) => {
    // Remap field name for showcase action
    const file = formData.get("file") as File
    const newFormData = new FormData()
    newFormData.set("showcaseCardId", showcaseCardId)
    newFormData.set("file", file)
    return uploadShowcaseStripImage(newFormData)
  }, [showcaseCardId])

  const handleDeleteStrip = useCallback(async () => {
    return deleteShowcaseStripImage(showcaseCardId)
  }, [showcaseCardId])

  const handleUploadStampIcon = useCallback(async (formData: FormData) => {
    const file = formData.get("file") as File
    const newFormData = new FormData()
    newFormData.set("showcaseCardId", showcaseCardId)
    newFormData.set("file", file)
    return uploadShowcaseStampIcon(newFormData)
  }, [showcaseCardId])

  const handleDeleteStampIcon = useCallback(async () => {
    return deleteShowcaseStampIcon(showcaseCardId)
  }, [showcaseCardId])

  // ─── Filtered tools (no logo, no details for showcase) ─

  const SHOWCASE_TOOLS: StudioTool[] = [
    "templates", "colors", "shape", "progress", "strip", "labels",
  ]

  // ─── Panel routing ────────────────────────────────────

  function renderPanel() {
    if (!ui.activeTool) return null

    switch (ui.activeTool) {
      case "templates":
        return <TemplatePanel store={store} restaurantId="" restaurantLogo={null} cardType={cardType} />
      case "colors":
        return <ColorsPanel store={store} />
      case "shape":
        return <ShapePanel store={store} />
      case "progress":
        return (
          <ProgressPanel
            store={store}
            programId={showcaseCardId}
            visitsRequired={visitsRequired}
            onUploadStampIcon={handleUploadStampIcon}
            onDeleteStampIcon={handleDeleteStampIcon}
          />
        )
      case "strip":
        return (
          <StripPanel
            store={store}
            programId={showcaseCardId}
            onUploadStrip={handleUploadStrip}
            onDeleteStrip={handleDeleteStrip}
          />
        )
      case "labels":
        return <LabelsPanel store={store} />
      default:
        return null
    }
  }

  const isMobile = useIsMobile()

  // Filter active tool to valid showcase tools
  const activeTool = ui.activeTool && SHOWCASE_TOOLS.includes(ui.activeTool) ? ui.activeTool : null

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <ShowcaseToolbar
        isDirty={ui.isDirty}
        isSaving={ui.isSaving}
        canUndo={canUndo}
        canRedo={canRedo}
        previewFormat={ui.previewFormat}
        deviceFrame={ui.deviceFrame}
        onSave={handleSave}
        onUndo={() => temporalStore.getState().undo()}
        onRedo={() => temporalStore.getState().redo()}
        onPreviewFormatChange={(fmt) => store.getState().setPreviewFormat(fmt)}
        onDeviceFrameChange={(frame) => store.getState().setDeviceFrame(frame)}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {!isMobile && (
          <ToolSelector
            activeTool={activeTool}
            onToolSelect={(tool) => store.getState().setActiveTool(tool)}
            cardType={cardType}
          />
        )}

        <div style={{ flex: 1, position: "relative", display: "flex" }}>
          <CanvasPanel
            design={design}
            format={ui.previewFormat}
            deviceFrame={ui.deviceFrame}
            restaurantName={restaurantName}
            restaurantLogo={null}
            programName="Loyalty Card"
            programType="STAMP_CARD"
            programConfig={{}}
            visitsRequired={visitsRequired}
            rewardDescription={rewardDescription}
          />
        </div>

        {activeTool && !isMobile && (
          <PanelShell
            title=""
            activeTool={activeTool}
            onClose={() => store.getState().setActiveTool(null)}
          >
            {renderPanel()}
          </PanelShell>
        )}

        {activeTool && isMobile && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "60dvh",
              backgroundColor: "var(--background)",
              borderTop: "1px solid var(--border)",
              borderRadius: "12px 12px 0 0",
              overflow: "auto",
              zIndex: 20,
              boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
            }}
          >
            <PanelShell
              title=""
              activeTool={activeTool}
              onClose={() => store.getState().setActiveTool(null)}
            >
              {renderPanel()}
            </PanelShell>
          </div>
        )}
      </div>

      {isMobile && (
        <MobileToolBar
          activeTool={activeTool}
          onToolSelect={(tool) => store.getState().setActiveTool(tool)}
          cardType={cardType}
        />
      )}
    </div>
  )
}

// ─── useIsMobile hook ─────────────────────────────────────

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    setIsMobile(mql.matches)
    function handler(e: MediaQueryListEvent) { setIsMobile(e.matches) }
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [breakpoint])
  return isMobile
}

// ─── Mobile Tool Bar ──────────────────────────────────────

import {
  LayoutGrid,
  Palette,
  BarChart3,
  ImagePlus,
  MoreHorizontal,
} from "lucide-react"

const MOBILE_QUICK_TOOLS: { id: StudioTool; label: string; icon: React.ReactNode }[] = [
  { id: "templates", label: "Templates", icon: <LayoutGrid size={18} /> },
  { id: "colors", label: "Colors", icon: <Palette size={18} /> },
  { id: "progress", label: "Progress", icon: <BarChart3 size={18} /> },
  { id: "strip", label: "Strip", icon: <ImagePlus size={18} /> },
]

function MobileToolBar({
  activeTool,
  onToolSelect,
  cardType,
}: {
  activeTool: StudioTool | null
  onToolSelect: (tool: StudioTool | null) => void
  cardType?: CardType
}) {
  const [showMore, setShowMore] = useState(false)
  const filteredQuickTools = cardType && cardType !== "STAMP"
    ? MOBILE_QUICK_TOOLS.filter((t) => t.id !== "progress")
    : MOBILE_QUICK_TOOLS

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--background)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {filteredQuickTools.map((tool) => {
        const isActive = activeTool === tool.id
        return (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            aria-label={tool.label}
            aria-pressed={isActive}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "8px 4px",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: isActive ? "var(--primary)" : "var(--muted-foreground)",
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              minHeight: 48,
            }}
          >
            {tool.icon}
            <span>{tool.label}</span>
          </button>
        )
      })}
      <button
        onClick={() => setShowMore(!showMore)}
        aria-label="More tools"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "8px 4px",
          border: "none",
          background: "none",
          cursor: "pointer",
          color: showMore ? "var(--primary)" : "var(--muted-foreground)",
          fontSize: 10,
          fontWeight: showMore ? 600 : 400,
          minHeight: 48,
        }}
      >
        <MoreHorizontal size={18} />
        <span>More</span>
      </button>

      {showMore && (
        <>
          <div
            onClick={() => setShowMore(false)}
            style={{ position: "fixed", inset: 0, zIndex: 29 }}
          />
          <div
            style={{
              position: "fixed",
              bottom: "calc(48px + env(safe-area-inset-bottom, 0px))",
              right: 0,
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "12px 0 0 0",
              padding: "8px 0",
              zIndex: 30,
              boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
              maxHeight: "50dvh",
              overflow: "auto",
            }}
          >
            <ToolSelector
              activeTool={activeTool}
              onToolSelect={(tool) => {
                onToolSelect(tool)
                setShowMore(false)
              }}
              cardType={cardType}
            />
          </div>
        </>
      )}
    </div>
  )
}

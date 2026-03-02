"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { toast } from "sonner"
import { createCardDesignStore } from "@/lib/stores/card-design-store"
import type { CardDesignStoreApi, WalletState } from "@/lib/stores/card-design-store"
import { useStore } from "zustand"
import { useStoreWithEqualityFn } from "zustand/traditional"
import { StudioToolbar } from "./studio-toolbar"
import { ToolSelector } from "./tools/tool-selector"
import { CanvasPanel } from "./canvas/canvas-panel"
import { PanelShell } from "./panels/panel-shell"
import { ColorsPanel } from "./panels/colors-panel"
import { ProgressPanel } from "./panels/progress-panel"
import { StripPanel } from "./panels/strip-panel"
import { LabelsPanel } from "./panels/labels-panel"
import { DetailsPanel } from "./panels/details-panel"
import { TemplatePanel } from "./panels/template-panel"
import { LogoPanel } from "./panels/logo-panel"
import { saveCardDesign } from "@/server/settings-actions"
import type { StudioTool } from "@/types/editor"
import type { CardType } from "@/lib/wallet/card-design"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"
import type { ProgramType } from "@/types/program-types"

/** Map ProgramType → CardType for visual rendering */
function programTypeToCardType(programType: string): CardType {
  switch (programType) {
    case "COUPON": return "COUPON"
    case "MEMBERSHIP": return "TIER"
    default: return "STAMP"
  }
}

type StudioLayoutProps = {
  programId: string
  programName: string
  programType: string
  programConfig: unknown
  restaurantName: string
  restaurantLogo: string | null
  restaurantLogoApple: string | null
  restaurantLogoGoogle: string | null
  restaurantId: string
  visitsRequired: number
  rewardDescription: string
  walletData: Record<string, unknown> | null
  walletPassCount: number
}

export function StudioLayout({
  programId,
  programName,
  programType,
  programConfig,
  restaurantName,
  restaurantLogo,
  restaurantLogoApple,
  restaurantLogoGoogle,
  restaurantId,
  visitsRequired,
  rewardDescription,
  walletData,
  walletPassCount,
}: StudioLayoutProps) {
  const cardType = programTypeToCardType(programType)
  // Create store once per mount
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
    store.getState().setWalletField("logoAppleUrl", restaurantLogoApple ?? restaurantLogo)
    store.getState().setWalletField("logoGoogleUrl", restaurantLogoGoogle ?? restaurantLogo)
    // Mark clean after setting logos since it's not a design change
    store.getState().markClean()
  }, [walletData, restaurantLogo, restaurantLogoApple, restaurantLogoGoogle, store])

  // ─── Selectors ────────────────────────────────────────

  const wallet = useStore(store, (s) => s.wallet)
  const ui = useStore(store, (s) => s.ui)

  // Build WalletPassDesign from store state
  const design: WalletPassDesign = {
    cardType,
    showStrip: wallet.showStrip,
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
  const canUndo = useStoreWithEqualityFn(
    temporalStore,
    (s) => s.pastStates.length > 0
  )
  const canRedo = useStoreWithEqualityFn(
    temporalStore,
    (s) => s.futureStates.length > 0
  )

  // ─── Save handler ─────────────────────────────────────

  const handleSave = useCallback(async () => {
    const state = store.getState()
    if (!state.ui.isDirty || state.ui.isSaving) return

    const walletAtSaveStart = state.wallet

    state.setSaving(true)
    state.setSaveError(null)

    try {
      const result = await saveCardDesign({
        programId,
        cardType: state.wallet.cardType as "STAMP" | "POINTS" | "TIER" | "COUPON",
        showStrip: state.wallet.showStrip,
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
        businessHours: state.wallet.businessHours,
        mapAddress: state.wallet.mapAddress,
        socialLinks: {
          instagram: state.wallet.socialLinks.instagram ?? "",
          facebook: state.wallet.socialLinks.facebook ?? "",
          tiktok: state.wallet.socialLinks.tiktok ?? "",
          x: state.wallet.socialLinks.x ?? "",
        },
        customMessage: state.wallet.customMessage,
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
        toast.success(
          result.hashChanged && walletPassCount > 0
            ? `Design saved! Updating ${walletPassCount} wallet pass${walletPassCount !== 1 ? "es" : ""}...`
            : "Design saved!"
        )
      }
    } catch {
      toast.error("Failed to save design")
    } finally {
      store.getState().setSaving(false)
    }
  }, [programId, walletPassCount, store])

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

  // ─── Panel routing ────────────────────────────────────

  function renderPanel() {
    if (!ui.activeTool) return null

    switch (ui.activeTool) {
      case "templates":
        return <TemplatePanel store={store} restaurantId={restaurantId} restaurantLogo={restaurantLogo} cardType={cardType} />
      case "colors":
        return <ColorsPanel store={store} />
      case "progress":
        return (
          <ProgressPanel
            store={store}
            programId={programId}
            visitsRequired={visitsRequired}
          />
        )
      case "strip":
        return <StripPanel store={store} programId={programId} />
      case "logo":
        return <LogoPanel store={store} restaurantId={restaurantId} restaurantName={restaurantName} />
      case "labels":
        return <LabelsPanel store={store} />
      case "details":
        return <DetailsPanel store={store} />
      default:
        return null
    }
  }

  const isMobile = useIsMobile()

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* Top toolbar */}
      <StudioToolbar
        programName={programName}
        programId={programId}
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

      {/* 3-panel layout (desktop) / stacked layout (mobile) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Left: Tool selector */}
        {!isMobile && (
          <ToolSelector
            activeTool={ui.activeTool}
            onToolSelect={(tool) => store.getState().setActiveTool(tool)}
            cardType={cardType}
          />
        )}

        {/* Center: Canvas + floating Brand Match prompt */}
        <div style={{ flex: 1, position: "relative", display: "flex" }}>
          <CanvasPanel
            design={design}
            format={ui.previewFormat}
            deviceFrame={ui.deviceFrame}
            restaurantName={restaurantName}
            restaurantLogo={ui.previewFormat === "apple" ? wallet.logoAppleUrl : wallet.logoGoogleUrl}
            programName={programName}
            programType={programType}
            programConfig={programConfig}
            visitsRequired={visitsRequired}
            rewardDescription={rewardDescription}
          />
          <BrandMatchPrompt
            visible={ui.activeTool !== "templates"}
            onOpen={() => store.getState().setActiveTool("templates")}
          />
        </div>

        {/* Right: Property panel */}
        {ui.activeTool && !isMobile && (
          <PanelShell
            title=""
            activeTool={ui.activeTool}
            onClose={() => store.getState().setActiveTool(null)}
          >
            {renderPanel()}
          </PanelShell>
        )}

        {/* Mobile: panel overlay (bottom sheet style) */}
        {ui.activeTool && isMobile && (
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
              activeTool={ui.activeTool}
              onClose={() => store.getState().setActiveTool(null)}
            >
              {renderPanel()}
            </PanelShell>
          </div>
        )}
      </div>

      {/* Mobile: Bottom tool bar */}
      {isMobile && (
        <MobileToolBar
          activeTool={ui.activeTool}
          onToolSelect={(tool) => store.getState().setActiveTool(tool)}
          cardType={cardType}
        />
      )}
    </div>
  )
}

// ─── Brand Match Floating Prompt ─────────────────────────────

import { Wand2, X as XIcon } from "lucide-react"

function BrandMatchPrompt({
  visible,
  onOpen,
}: {
  visible: boolean
  onOpen: () => void
}) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || !visible) return null

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen() } }}
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 15,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px 8px 12px",
        borderRadius: 10,
        backgroundColor: "var(--primary)",
        color: "var(--primary-foreground)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        animation: "brandMatchIn 0.4s ease-out",
      }}
      onClick={onOpen}
    >
      <Wand2 size={15} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>Match card to your brand</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setDismissed(true)
        }}
        aria-label="Dismiss"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "none",
          backgroundColor: "rgba(255,255,255,0.2)",
          color: "inherit",
          cursor: "pointer",
          marginLeft: 2,
          padding: 0,
        }}
      >
        <XIcon size={10} />
      </button>
      <style>{`
        @keyframes brandMatchIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
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

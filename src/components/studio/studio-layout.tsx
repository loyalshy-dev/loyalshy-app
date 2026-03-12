"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { toast } from "sonner"
import { createCardDesignStore } from "@/lib/stores/card-design-store"
import type { CardDesignStoreApi, WalletState } from "@/lib/stores/card-design-store"
import { useStore } from "zustand"
import { useStoreWithEqualityFn } from "zustand/traditional"
import { StudioToolbar } from "./studio-toolbar"
import { CanvasPanel } from "./canvas/canvas-panel"
import { ContextPanel, FloatingToolMenu } from "./canvas/context-notch"
import { PanelShell } from "./panels/panel-shell"
import { ProgramPanel } from "./panels/program-panel"
import { ColorsPanel } from "./panels/colors-panel"
import { ProgressPanel } from "./panels/progress-panel"
import { StripPanel } from "./panels/strip-panel"
import { DetailsPanel } from "./panels/details-panel"
import { NotificationsPanel } from "./panels/notifications-panel"

import { LogoPanel } from "./panels/logo-panel"
import { ScratchCard, SlotMachine, WheelOfFortune } from "@/components/minigames"
import { savePassDesign as saveCardDesign, updatePassTemplate, updateMinigameConfig } from "@/server/org-settings-actions"
import type { StudioTool, PreviewFormat } from "@/types/editor"
import type { CardType } from "@/lib/wallet/card-design"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"
import type { ProgramConfigState } from "@/lib/stores/card-design-store"
import { Save, Smartphone, Tablet, Palette, BarChart3, ImagePlus, MoreHorizontal, SlidersHorizontal, Undo2, Redo2 } from "lucide-react"

/** Map PassType → CardType for visual rendering */
function passTypeToCardType(passType: string): CardType {
  switch (passType) {
    case "COUPON": return "COUPON"
    case "MEMBERSHIP": return "TIER"
    case "POINTS": return "POINTS"
    case "PREPAID": return "PREPAID"
    case "GIFT_CARD": return "GIFT_CARD"
    case "TICKET": return "TICKET"
    case "ACCESS": return "ACCESS"
    case "TRANSIT": return "TRANSIT"
    case "BUSINESS_ID": return "BUSINESS_ID"
    default: return "STAMP"
  }
}

/** Build the type-specific config JSON from store state */
function buildConfigPayload(passType: string, pc: ProgramConfigState): Record<string, unknown> {
  switch (passType) {
    case "STAMP_CARD":
      return {
        stampsRequired: pc.stampsRequired,
        rewardDescription: pc.rewardDescription,
        rewardExpiryDays: pc.rewardExpiryDays,
      }
    case "COUPON":
      return {
        discountType: pc.discountType,
        discountValue: pc.discountValue,
        couponCode: pc.couponCode || undefined,
        couponDescription: pc.couponDescription || undefined,
        validUntil: pc.validUntil || undefined,
        redemptionLimit: pc.redemptionLimit,
        terms: pc.terms || undefined,
      }
    case "MEMBERSHIP":
      return {
        membershipTier: pc.membershipTier,
        benefits: pc.benefits,
        validDuration: pc.validDuration,
        customDurationDays: pc.validDuration === "custom" ? pc.customDurationDays : undefined,
        autoRenew: pc.autoRenew,
        showHolderPhoto: pc.showHolderPhoto,
        holderPhotoPosition: pc.holderPhotoPosition,
        terms: pc.terms || undefined,
      }
    case "POINTS":
      return {
        pointsPerVisit: pc.pointsPerVisit,
        pointsLabel: pc.pointsLabel,
      }
    case "PREPAID":
      return {
        totalUses: pc.totalUses,
        useLabel: pc.useLabel,
        rechargeable: pc.rechargeable,
        rechargeAmount: pc.rechargeable ? pc.rechargeAmount : undefined,
        terms: pc.terms || undefined,
      }
    case "GIFT_CARD":
      return {
        currency: pc.currency,
        initialBalanceCents: pc.initialBalanceCents,
        partialRedemption: pc.partialRedemption,
        expiryMonths: pc.expiryMonths || undefined,
      }
    case "TICKET":
      return {
        eventName: pc.eventName,
        eventDate: pc.eventDate || undefined,
        eventVenue: pc.eventVenue,
        barcodeType: pc.barcodeType,
        maxScans: pc.maxScans,
      }
    case "ACCESS":
      return {
        accessLabel: pc.accessLabel,
        validDays: pc.validDays.length > 0 ? pc.validDays : undefined,
        validTimeStart: pc.validTimeStart || undefined,
        validTimeEnd: pc.validTimeEnd || undefined,
        validDuration: pc.validDuration,
        customDurationDays: pc.validDuration === "custom" ? pc.customDurationDays : undefined,
        maxDailyUses: pc.maxDailyUses || undefined,
        showHolderPhoto: pc.showHolderPhoto,
        holderPhotoPosition: pc.holderPhotoPosition,
      }
    case "TRANSIT":
      return {
        transitType: pc.transitType,
        originName: pc.originName || undefined,
        destinationName: pc.destinationName || undefined,
        departureDateTime: pc.departureDateTime || undefined,
        barcodeType: pc.barcodeType,
      }
    case "BUSINESS_ID":
      return {
        idLabel: pc.idLabel,
        showHolderPhoto: pc.showHolderPhoto,
        holderPhotoPosition: pc.holderPhotoPosition,
        validDuration: pc.validDuration,
        customDurationDays: pc.validDuration === "custom" ? pc.customDurationDays : undefined,
      }
    default:
      return {}
  }
}

type StudioLayoutProps = {
  templateId: string
  templateName: string
  passType: string
  templateConfig: unknown
  templateStartsAt?: string
  templateEndsAt?: string
  organizationName: string
  organizationLogo: string | null
  organizationLogoApple: string | null
  organizationLogoGoogle: string | null
  organizationId: string
  visitsRequired: number
  rewardDescription: string
  walletData: Record<string, unknown> | null
  walletPassCount: number
  /** When true, studio is embedded in the dashboard tab (no 100dvh, no back button) */
  embedded?: boolean
}

export function StudioLayout({
  templateId,
  templateName,
  passType,
  templateConfig,
  templateStartsAt = "",
  templateEndsAt = "",
  organizationName,
  organizationLogo,
  organizationLogoApple,
  organizationLogoGoogle,
  organizationId,
  visitsRequired,
  rewardDescription,
  walletData,
  walletPassCount,
  embedded = false,
}: StudioLayoutProps) {
  const cardType = passTypeToCardType(passType)
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
    // Strip is mandatory for stamp/points cards (progress baked into strip image)
    if (cardType === "STAMP" || cardType === "POINTS") {
      store.getState().setWalletField("showStrip", true)
    }
    store.getState().setWalletField("logoAppleUrl", organizationLogoApple ?? organizationLogo)
    store.getState().setWalletField("logoGoogleUrl", organizationLogoGoogle ?? organizationLogo)
    // Hydrate program config from templateConfig
    const cfg = (templateConfig ?? {}) as Record<string, unknown>
    const minigame = (cfg.minigame as Record<string, unknown>) ?? {}
    const minigamePrizes = (minigame.prizes as { name: string; weight: number }[]) ?? []
    // Convert ISO dates to YYYY-MM-DD for date inputs
    const toDateStr = (iso: string) => iso ? iso.slice(0, 10) : ""
    store.getState().hydrateConfig({
      name: (templateName ?? "") as string,
      stampsRequired: (cfg.stampsRequired as number) ?? 10,
      rewardDescription: (cfg.rewardDescription as string) ?? "",
      rewardExpiryDays: (cfg.rewardExpiryDays as number) ?? 0,
      discountType: (cfg.discountType as string) ?? "percentage",
      discountValue: (cfg.discountValue as number) ?? 10,
      couponCode: (cfg.couponCode as string) ?? "",
      couponDescription: (cfg.couponDescription as string) ?? "",
      validUntil: (cfg.validUntil as string) ?? "",
      redemptionLimit: (cfg.redemptionLimit as string) ?? "single",
      membershipTier: (cfg.membershipTier as string) ?? "Member",
      benefits: (cfg.benefits as string) ?? "",
      validDuration: (cfg.validDuration as string) ?? "1_year",
      customDurationDays: (cfg.customDurationDays as number) ?? 365,
      autoRenew: (cfg.autoRenew as boolean) ?? false,
      pointsPerVisit: (cfg.pointsPerVisit as number) ?? 1,
      pointsLabel: (cfg.pointsLabel as string) ?? "pts",
      totalUses: (cfg.totalUses as number) ?? 10,
      useLabel: (cfg.useLabel as string) ?? "use",
      rechargeable: (cfg.rechargeable as boolean) ?? false,
      rechargeAmount: (cfg.rechargeAmount as number) ?? 0,
      startsAt: toDateStr(templateStartsAt),
      endsAt: toDateStr(templateEndsAt),
      minigameEnabled: (minigame.enabled as boolean) ?? false,
      minigameType: ((minigame.gameType as string) ?? "scratch") as "scratch" | "slots" | "wheel",
      minigamePrizes,
      minigamePrimaryColor: (minigame.primaryColor as string) ?? "",
      minigameAccentColor: (minigame.accentColor as string) ?? "",
      terms: (cfg.terms as string) ?? "",
      // Gift card
      currency: (cfg.currency as string) ?? "USD",
      initialBalanceCents: (cfg.initialBalanceCents as number) ?? 2500,
      partialRedemption: (cfg.partialRedemption as boolean) ?? true,
      expiryMonths: (cfg.expiryMonths as number) ?? 12,
      // Ticket
      eventName: (cfg.eventName as string) ?? "",
      eventDate: (cfg.eventDate as string) ?? "",
      eventVenue: (cfg.eventVenue as string) ?? "",
      barcodeType: (cfg.barcodeType as string) ?? "qr",
      maxScans: (cfg.maxScans as number) ?? 1,
      // Access
      accessLabel: (cfg.accessLabel as string) ?? "Access Pass",
      validDays: (cfg.validDays as string[]) ?? [],
      validTimeStart: (cfg.validTimeStart as string) ?? "",
      validTimeEnd: (cfg.validTimeEnd as string) ?? "",
      maxDailyUses: (cfg.maxDailyUses as number) ?? 0,
      // Transit
      transitType: (cfg.transitType as string) ?? "bus",
      originName: (cfg.originName as string) ?? "",
      destinationName: (cfg.destinationName as string) ?? "",
      departureDateTime: (cfg.departureDateTime as string) ?? "",
      // Business ID
      idLabel: (cfg.idLabel as string) ?? "Employee ID",
      showHolderPhoto: (cfg.showHolderPhoto as boolean) ?? true,
      holderPhotoPosition: (cfg.holderPhotoPosition as "left" | "center" | "right") ?? "center",
    })
    // Mark clean after setting logos and config since it's not a user change
    store.getState().markClean()
  }, [walletData, organizationLogo, organizationLogoApple, organizationLogoGoogle, store, templateConfig, templateName, templateStartsAt, templateEndsAt])

  // ─── Selectors ────────────────────────────────────────

  const wallet = useStore(store, (s) => s.wallet)
  const programConfig = useStore(store, (s) => s.programConfig)
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
    stampFilledColor: wallet.stampFilledColor,
    stripImagePosition: wallet.stripImagePosition,
    stripImageZoom: wallet.stripImageZoom,
    labelColor: wallet.labelColor,
    logoAppleZoom: wallet.logoAppleZoom,
    logoGoogleZoom: wallet.logoGoogleZoom,
    headerFields: wallet.headerFields,
    secondaryFields: wallet.secondaryFields,
    fields: wallet.fields,
    fieldLabels: wallet.fieldLabels,
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
    const hasDesignChanges = state.ui.isDirty
    const hasConfigChanges = state.ui.isConfigDirty
    if ((!hasDesignChanges && !hasConfigChanges) || state.ui.isSaving) return

    const walletAtSaveStart = state.wallet

    state.setSaving(true)
    state.setSaveError(null)

    try {
      const promises: Promise<unknown>[] = []

      // Save card design if dirty
      if (hasDesignChanges) {
        promises.push(
          saveCardDesign({
            templateId,
            cardType: state.wallet.cardType as CardType,
            showStrip: state.wallet.showStrip,
            primaryColor: state.wallet.primaryColor,
            secondaryColor: state.wallet.secondaryColor,
            textColor: state.wallet.textColor,
            autoTextColor: state.wallet.autoTextColor,
            patternStyle: state.wallet.patternStyle,
            progressStyle: state.wallet.progressStyle,
            labelFormat: state.wallet.labelFormat,
            customProgressLabel: state.wallet.customProgressLabel,
            palettePreset: state.wallet.palettePreset,
            templateId2: state.wallet.templateId ?? "",
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
            stampFilledColor: state.wallet.stampFilledColor,
            stripImagePosition: (state.wallet.stripImagePosition.x !== 0.5 || state.wallet.stripImagePosition.y !== 0.5)
              ? state.wallet.stripImagePosition
              : undefined,
            stripImageZoom: state.wallet.stripImageZoom !== 1
              ? state.wallet.stripImageZoom
              : undefined,
            labelColor: state.wallet.labelColor,
            logoAppleZoom: state.wallet.logoAppleZoom !== 1 ? state.wallet.logoAppleZoom : undefined,
            logoGoogleZoom: state.wallet.logoGoogleZoom !== 1 ? state.wallet.logoGoogleZoom : undefined,
            headerFields: state.wallet.headerFields,
            secondaryFields: state.wallet.secondaryFields,
            fields: state.wallet.fields,
            fieldLabels: state.wallet.fieldLabels,
            locationMessage: state.wallet.locationMessage || "",
          })
        )
      }

      // Save program config if dirty
      if (hasConfigChanges) {
        const pc = state.programConfig
        const configPayload = buildConfigPayload(passType, pc)
        promises.push(
          updatePassTemplate({
            organizationId,
            templateId,
            name: pc.name,
            termsAndConditions: pc.terms || "",
            config: configPayload,
            ...(pc.startsAt ? { startsAt: new Date(pc.startsAt) } : {}),
            endsAt: pc.endsAt ? new Date(pc.endsAt) : null,
          })
        )

        // Save minigame config separately (it merges into config.minigame)
        if (passType === "STAMP_CARD" || passType === "COUPON") {
          const filteredPrizes = pc.minigamePrizes
            .filter((p) => p.name.trim())
            .map((p) => ({ name: p.name.trim(), weight: p.weight }))
          promises.push(
            updateMinigameConfig({
              organizationId,
              templateId,
              enabled: pc.minigameEnabled,
              gameType: pc.minigameType,
              ...(filteredPrizes.length > 0 ? { prizes: filteredPrizes } : {}),
              primaryColor: state.wallet.primaryColor,
              accentColor: state.wallet.secondaryColor,
            })
          )
        }
      }

      const results = await Promise.all(promises)

      // Check for errors
      const errors = results.filter((r): r is { error: string } =>
        r != null && typeof r === "object" && "error" in r
      )

      if (errors.length > 0) {
        const msg = errors.map((e) => e.error).join("; ")
        store.getState().setSaveError(msg)
        toast.error(msg)
      } else {
        const current = store.getState()
        if (hasDesignChanges && current.wallet === walletAtSaveStart) {
          current.markClean()
        }
        if (hasConfigChanges) {
          current.markConfigClean()
        }
        const designResult = hasDesignChanges ? results[0] as { hashChanged?: boolean } : null
        toast.success(
          designResult?.hashChanged && walletPassCount > 0
            ? `Saved! Updating ${walletPassCount} wallet pass${walletPassCount !== 1 ? "es" : ""}...`
            : "Saved!"
        )
      }
    } catch {
      toast.error("Failed to save")
    } finally {
      store.getState().setSaving(false)
    }
  }, [templateId, organizationId, passType, walletPassCount, store])

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
      if (e.key === "Escape") {
        const s = store.getState()
        if (s.ui.selectedColorZone) s.setSelectedColorZone(null)
        else if (s.ui.activeTool) s.setActiveTool(null)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave, temporalStore, store])

  // ─── Mobile panel routing ──────────────────────────────

  function renderMobilePanel() {
    if (!ui.activeTool) return null
    switch (ui.activeTool) {
      case "program":
        return <ProgramPanel store={store} passType={passType} />
      case "colors":
        return <ColorsPanel store={store} />
      case "progress":
        return <ProgressPanel store={store} programId={templateId} visitsRequired={programConfig.stampsRequired} />
      case "strip":
        return <StripPanel store={store} programId={templateId} forceStrip={cardType === "STAMP" || cardType === "POINTS"} />
      case "logo":
        return <LogoPanel store={store} organizationId={organizationId} organizationName={organizationName} organizationLogo={organizationLogo} />
      case "notifications":
        return <NotificationsPanel store={store} organizationName={organizationName} organizationLogo={organizationLogo} />
      case "details":
        return <DetailsPanel store={store} />
      default:
        return null
    }
  }

  const isMobile = useIsMobile()

  // In embedded mode, use a placeholder to measure the top offset,
  // then render the studio as position:fixed to avoid all parent scrolling issues.
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [topOffset, setTopOffset] = useState(0)
  const [leftOffset, setLeftOffset] = useState(0)
  useEffect(() => {
    if (!embedded) return
    function measure() {
      const el = placeholderRef.current
      if (!el) return
      setTopOffset(Math.round(el.getBoundingClientRect().top))
      setLeftOffset(Math.round(el.getBoundingClientRect().left))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [embedded])

  const isDirty = ui.isDirty || ui.isConfigDirty

  if (embedded) {
    return (
      <>
        {/* Invisible placeholder to measure where the studio should start */}
        <div ref={placeholderRef} style={{ height: 1, marginBottom: -1 }} />
        <div
          style={{
            position: "fixed",
            top: topOffset,
            left: leftOffset,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 1,
            backgroundColor: "var(--background)",
          }}
        >
          {renderStudioContent()}
        </div>
      </>
    )
  }

  function renderStudioContent() {
    return (
      <>
        {/* 2-panel layout (desktop) / stacked layout (mobile) */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
          {/* Full-width canvas with floating UI */}
          <div style={{ flex: 1, position: "relative", display: "flex" }}>
            {/* Floating tool menu (left icon bar) */}
            {!isMobile && (
              <FloatingToolMenu store={store} cardType={cardType} />
            )}

            {/* Floating context panel card */}
            {!isMobile && (
              <ContextPanel
                store={store}
                passType={passType}
                organizationId={organizationId}
                organizationName={organizationName}
                organizationLogo={organizationLogo}
                templateId={templateId}
                cardType={cardType}
              />
            )}

            <CanvasPanel
              design={design}
              format={ui.previewFormat}
              deviceFrame="minimal"
              organizationName={organizationName}
              organizationLogo={ui.previewFormat === "apple" ? wallet.logoAppleUrl : wallet.logoGoogleUrl}
              organizationId={organizationId}
              templateId={templateId}
              templateName={programConfig.name || templateName}
              passType={passType}
              templateConfig={buildConfigPayload(passType, programConfig)}
              visitsRequired={programConfig.stampsRequired}
              rewardDescription={
                programConfig.minigameEnabled && programConfig.minigamePrizes.filter((p) => p.name.trim()).length >= 2
                  ? programConfig.minigamePrizes.filter((p) => p.name.trim()).map((p) => p.name).join(", ")
                  : programConfig.rewardDescription
              }
              businessHours={wallet.businessHours || undefined}
              socialLinks={wallet.socialLinks}
              customMessage={wallet.customMessage || undefined}
              holderPhotoUrl={wallet.holderPhotoUrl}
              store={store}
            />

            {/* Floating minigame preview — right side of canvas */}
            {!isMobile && ui.activeTool === "prize" && programConfig.minigameEnabled && (
              <MinigamePreview
                gameType={programConfig.minigameType}
                prizes={programConfig.minigamePrizes}
                rewardDescription={programConfig.rewardDescription}
                primaryColor={wallet.primaryColor}
                accentColor={wallet.secondaryColor}
                templateId={templateId}
              />
            )}

            {/* Floating controls — bottom right of canvas (embedded mode) */}
            {embedded && !isMobile && (
              <CanvasControls
                previewFormat={ui.previewFormat}
                onPreviewFormatChange={(fmt) => store.getState().setPreviewFormat(fmt)}
                isDirty={isDirty}
                isSaving={ui.isSaving}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={() => temporalStore.getState().undo()}
                onRedo={() => temporalStore.getState().redo()}
                onSave={handleSave}
              />
            )}
          </div>

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
                {renderMobilePanel()}
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
      </>
    )
  }

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <StudioToolbar
        programName={templateName}
        programId={templateId}
        embedded={false}
        isDirty={isDirty}
        isSaving={ui.isSaving}
        canUndo={canUndo}
        canRedo={canRedo}
        previewFormat={ui.previewFormat}
        onSave={handleSave}
        onUndo={() => temporalStore.getState().undo()}
        onRedo={() => temporalStore.getState().redo()}
        onPreviewFormatChange={(fmt) => store.getState().setPreviewFormat(fmt)}
      />
      {renderStudioContent()}
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

// ─── Floating Canvas Controls (embedded mode) ───────────────

function CanvasControls({
  previewFormat,
  onPreviewFormatChange,
  isDirty,
  isSaving,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
}: {
  previewFormat: PreviewFormat
  onPreviewFormatChange: (fmt: PreviewFormat) => void
  isDirty: boolean
  isSaving: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {/* Undo / Redo */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: 2,
          borderRadius: 9999,
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            padding: "5px 8px",
            borderRadius: 9999,
            border: "none",
            background: "none",
            color: canUndo ? "var(--foreground)" : "var(--muted-foreground)",
            cursor: canUndo ? "pointer" : "default",
            opacity: canUndo ? 1 : 0.4,
            display: "flex",
            alignItems: "center",
          }}
          aria-label="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          style={{
            padding: "5px 8px",
            borderRadius: 9999,
            border: "none",
            background: "none",
            color: canRedo ? "var(--foreground)" : "var(--muted-foreground)",
            cursor: canRedo ? "pointer" : "default",
            opacity: canRedo ? 1 : 0.4,
            display: "flex",
            alignItems: "center",
          }}
          aria-label="Redo"
        >
          <Redo2 size={14} />
        </button>
      </div>

      {/* Apple / Google toggle */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: 2,
          borderRadius: 9999,
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        {(["apple", "google"] as PreviewFormat[]).map((fmt) => (
          <button
            key={fmt}
            onClick={() => onPreviewFormatChange(fmt)}
            style={{
              padding: "5px 10px",
              borderRadius: 9999,
              border: "none",
              background: previewFormat === fmt ? "var(--accent)" : "none",
              color: previewFormat === fmt ? "var(--foreground)" : "var(--muted-foreground)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: previewFormat === fmt ? 600 : 400,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {fmt === "apple" && <Smartphone size={13} />}
            {fmt === "google" && <Tablet size={13} />}
            {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
          </button>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={isSaving || !isDirty}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          borderRadius: 9999,
          border: isDirty ? "none" : "1px solid var(--border)",
          backgroundColor: isDirty ? "var(--primary)" : "var(--background)",
          color: isDirty ? "var(--primary-foreground)" : "var(--muted-foreground)",
          cursor: isDirty && !isSaving ? "pointer" : "default",
          fontSize: 12,
          fontWeight: 500,
          opacity: isSaving ? 0.7 : 1,
          boxShadow: isDirty ? "0 2px 8px rgba(0,0,0,0.15)" : "0 2px 8px rgba(0,0,0,0.08)",
        }}
        aria-label="Save design"
      >
        <Save size={13} />
        {isSaving ? "Saving..." : isDirty ? "Save" : "Saved"}
      </button>
    </div>
  )
}

// ─── Mobile Tool Bar ──────────────────────────────────────

import { ToolSelector } from "./tools/tool-selector"

const MOBILE_QUICK_TOOLS: { id: StudioTool; label: string; icon: React.ReactNode }[] = [
  { id: "program", label: "Program", icon: <SlidersHorizontal size={18} /> },
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

// ─── Floating Minigame Preview ──────────────────────────────

function MinigamePreview({
  gameType,
  prizes,
  rewardDescription,
  primaryColor,
  accentColor,
  templateId,
}: {
  gameType: "scratch" | "slots" | "wheel"
  prizes: { name: string; weight: number }[]
  rewardDescription: string
  primaryColor: string
  accentColor: string
  templateId: string
}) {
  const [previewKey, setPreviewKey] = useState(0)
  const filledPrizes = prizes.filter((p) => p.name.trim())
  const rewardText = filledPrizes.length > 0 ? filledPrizes[0].name : (rewardDescription || "Free reward!")
  const prizeNames = filledPrizes.length > 0 ? filledPrizes.map((p) => p.name) : undefined

  const gameLabel =
    gameType === "scratch" ? "Scratch Card"
    : gameType === "slots" ? "Slot Machine"
    : "Wheel of Fortune"

  return (
    <div
      key={previewKey}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        bottom: 12,
        width: 320,
        zIndex: 15,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--background)",
        borderRadius: 24,
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        overflow: "hidden",
        animation: "minigamePreviewIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
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
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", flex: 1 }}>
          {gameLabel} Preview
        </span>
        <button
          onClick={() => setPreviewKey((k) => k + 1)}
          aria-label="Replay animation"
          style={{
            padding: "4px 12px",
            borderRadius: 9999,
            border: "1px solid var(--border)",
            backgroundColor: "var(--background)",
            color: "var(--muted-foreground)",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          Replay
        </button>
      </div>

      {/* Game preview */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          overflow: "auto",
        }}
      >
        {gameType === "scratch" && (
          <ScratchCard
            rewardText={rewardText}
            onReveal={() => {}}
            primaryColor={primaryColor}
            accentColor={accentColor}
          />
        )}
        {gameType === "slots" && (
          <SlotMachine
            rewardText={rewardText}
            passInstanceId={`preview-${templateId}-${previewKey}`}
            onReveal={() => {}}
            autoStart
            primaryColor={primaryColor}
          />
        )}
        {gameType === "wheel" && (
          <WheelOfFortune
            rewardText={rewardText}
            passInstanceId={`preview-${templateId}-${previewKey}`}
            onReveal={() => {}}
            prizes={prizeNames}
            primaryColor={primaryColor}
            accentColor={accentColor}
          />
        )}
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--muted-foreground)",
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        {filledPrizes.length >= 2
          ? `${filledPrizes.length} prizes · Showing "${rewardText}"`
          : "Add at least 2 prizes to see the full experience"}
      </div>

      <style>{`
        @keyframes minigamePreviewIn {
          from { opacity: 0; transform: translateX(8px) scale(0.98); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

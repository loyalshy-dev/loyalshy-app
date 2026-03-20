"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { toast } from "sonner"
import { createCardDesignStore } from "@/lib/stores/card-design-store"
import type { CardDesignStoreApi, WalletState } from "@/lib/stores/card-design-store"
import { useStore } from "zustand"
import { useStoreWithEqualityFn } from "zustand/traditional"
import { StudioToolbar } from "./studio-toolbar"
import { CanvasPanel, type CanvasPanelHandle } from "./canvas/canvas-panel"
import { ContextPanel, FloatingToolMenu } from "./canvas/context-notch"
import { ProgramPanel } from "./panels/program-panel"
import { ColorsPanel } from "./panels/colors-panel"
import { FieldsPanel } from "./panels/fields-panel"
import { ProgressPanel } from "./panels/progress-panel"
import { StripPanel } from "./panels/strip-panel"
import { DetailsPanel } from "./panels/details-panel"
import { NotificationsPanel } from "./panels/notifications-panel"
import { LogoPanel } from "./panels/logo-panel"
import { PrizeRevealPanel } from "./panels/prize-reveal-panel"
import { AvatarPanel } from "./panels/avatar-panel"
import { ScratchCard, SlotMachine, WheelOfFortune } from "@/components/minigames"
import { savePassDesign as saveCardDesign, updatePassTemplate, updateMinigameConfig } from "@/server/org-settings-actions"
import type { StudioTool, PreviewFormat } from "@/types/editor"
import type { CardType } from "@/lib/wallet/card-design"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"
import type { ProgramConfigState } from "@/lib/stores/card-design-store"
import { Save, Download, Smartphone, Tablet, Palette, BarChart3, ImagePlus, SlidersHorizontal, Undo2, Redo2, TextCursorInput, CircleUserRound, FileText, Bell, Gift, Camera } from "lucide-react"
import { useTranslations } from "next-intl"

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
        rewardDescription: pc.rewardDescription || undefined,
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
  const tStudio = useTranslations("dashboard.studio")
  // Store translation fn in a ref so it's accessible inside useCallback without
  // adding it to the dependency array (translation fn identity is stable).
  const tStudioRef = useRef(tStudio)
  useEffect(() => { tStudioRef.current = tStudio }, [tStudio])

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
    // Prefer program-level logos, fall back to organization logos
    const wd = walletData as Record<string, unknown> | null
    const progApple = wd?.programLogoAppleUrl as string | null
    const progGoogle = wd?.programLogoGoogleUrl as string | null
    store.getState().setWalletField("logoAppleUrl", progApple ?? organizationLogoApple ?? organizationLogo)
    store.getState().setWalletField("logoGoogleUrl", progGoogle ?? organizationLogoGoogle ?? organizationLogo)
    store.getState().setWalletField("programLogoUrl", (wd?.programLogoUrl as string | null) ?? null)
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
    showPrimaryField: wallet.showPrimaryField,
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
            mapLatitude: state.wallet.mapLatitude,
            mapLongitude: state.wallet.mapLongitude,
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
            showPrimaryField: state.wallet.showPrimaryField,
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
        // Note: toast messages here use inline strings because this callback is
        // defined outside component render — translations are accessed via the
        // tStudio ref set during render.
        toast.success(
          designResult?.hashChanged && walletPassCount > 0
            ? tStudioRef.current?.("saveSuccessWithUpdate", {
                count: walletPassCount,
                passLabel: walletPassCount !== 1
                  ? tStudioRef.current?.("walletPasses")
                  : tStudioRef.current?.("walletPass"),
              }) ?? "Saved!"
            : tStudioRef.current?.("saveSuccess") ?? "Saved!"
        )
      }
    } catch {
      toast.error(tStudioRef.current?.("saveFailed") ?? "Failed to save")
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

  // ─── Canvas ref + download handler ──────────────────────

  const canvasRef = useRef<CanvasPanelHandle>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = useCallback(async () => {
    const el = canvasRef.current?.getCardElement()
    if (!el) return

    setIsDownloading(true)

    // Clear interactive overlay styles before capture so indigo highlights
    // (zone-active outlines / backgrounds) don't bleed into the PNG export
    const prevZone = store.getState().ui.selectedColorZone
    const prevTool = store.getState().ui.activeTool
    store.getState().setSelectedColorZone(null)
    store.getState().setActiveTool(null)
    // Allow React to flush the zone-active class removal
    await new Promise((r) => requestAnimationFrame(r))

    // Swap cross-origin image srcs to same-origin proxy to avoid CORS errors
    const images = el.querySelectorAll("img")
    const originals = new Map<HTMLImageElement, string>()
    for (const img of images) {
      const src = img.src
      if (src && !src.startsWith(window.location.origin) && !src.startsWith("data:")) {
        originals.set(img, src)
        img.src = `/api/image-proxy?url=${encodeURIComponent(src)}`
      }
    }
    // Wait for proxied images to load
    await Promise.all(
      [...originals.keys()].map(
        (img) => img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = img.onerror = () => r() })
      )
    )

    try {
      const { toPng } = await import("html-to-image")
      const dataUrl = await toPng(el, {
        pixelRatio: 3,
        backgroundColor: undefined, // transparent
      })

      const link = document.createElement("a")
      link.download = `card-design-${store.getState().ui.previewFormat}.png`
      link.href = dataUrl
      link.click()

      toast.success(tStudioRef.current?.("downloadSuccess") ?? "Downloaded!")
    } catch {
      toast.error(tStudioRef.current?.("downloadFailed") ?? "Failed to download")
    } finally {
      // Restore original image sources
      for (const [img, src] of originals) {
        img.src = src
      }
      // Restore interactive overlay state
      if (prevZone) store.getState().setSelectedColorZone(prevZone)
      if (prevTool) store.getState().setActiveTool(prevTool)
      setIsDownloading(false)
    }
  }, [store])

  // ─── Mobile panel routing ──────────────────────────────

  function renderMobilePanel() {
    if (!ui.activeTool) return null
    switch (ui.activeTool) {
      case "program":
        return <ProgramPanel store={store} passType={passType} />
      case "colors":
        return <ColorsPanel store={store} />
      case "fields":
        return <FieldsPanel store={store} passType={passType} />
      case "progress":
        return <ProgressPanel store={store} programId={templateId} visitsRequired={programConfig.stampsRequired} />
      case "strip":
        return <StripPanel store={store} programId={templateId} forceStrip={cardType === "STAMP" || cardType === "POINTS"} organizationId={organizationId} />
      case "logo":
        return <LogoPanel store={store} organizationId={organizationId} organizationName={organizationName} organizationLogo={organizationLogo} organizationLogoApple={organizationLogoApple} organizationLogoGoogle={organizationLogoGoogle} templateId={templateId} />
      case "notifications":
        return <NotificationsPanel store={store} organizationName={organizationName} organizationLogo={organizationLogo} />
      case "details":
        return <DetailsPanel store={store} />
      case "prize":
        return <PrizeRevealPanel store={store} />
      case "avatar":
        return <AvatarPanel store={store} programId={templateId} />
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
                organizationLogoApple={organizationLogoApple}
                organizationLogoGoogle={organizationLogoGoogle}
                templateId={templateId}
                cardType={cardType}
              />
            )}

            <CanvasPanel
              ref={canvasRef}
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
                isDownloading={isDownloading}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={() => temporalStore.getState().undo()}
                onRedo={() => temporalStore.getState().redo()}
                onSave={handleSave}
                onDownload={handleDownload}
              />
            )}
          </div>

          {/* Mobile: bottom sheet panel */}
          {isMobile && (
            <MobileBottomSheet
              isOpen={!!ui.activeTool}
              activeTool={ui.activeTool}
              onClose={() => store.getState().setActiveTool(null)}
            >
              {renderMobilePanel()}
            </MobileBottomSheet>
          )}
        </div>

        {/* Mobile: Bottom tool bar + controls */}
        {isMobile && (
          <MobileToolBar
            activeTool={ui.activeTool}
            onToolSelect={(tool) => store.getState().setActiveTool(tool)}
            cardType={cardType}
            passType={passType}
            isDirty={isDirty}
            isSaving={ui.isSaving}
            isDownloading={isDownloading}
            canUndo={canUndo}
            canRedo={canRedo}
            previewFormat={ui.previewFormat}
            onUndo={() => temporalStore.getState().undo()}
            onRedo={() => temporalStore.getState().redo()}
            onSave={handleSave}
            onDownload={handleDownload}
            onPreviewFormatChange={(fmt) => store.getState().setPreviewFormat(fmt)}
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
        isDownloading={isDownloading}
        canUndo={canUndo}
        canRedo={canRedo}
        previewFormat={ui.previewFormat}
        onSave={handleSave}
        onDownload={handleDownload}
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
  isDownloading,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onDownload,
}: {
  previewFormat: PreviewFormat
  onPreviewFormatChange: (fmt: PreviewFormat) => void
  isDirty: boolean
  isSaving: boolean
  isDownloading: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onDownload: () => void
}) {
  const t = useTranslations("dashboard.studio")
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
          aria-label={t("undo")}
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
          aria-label={t("redo")}
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

      {/* Download PNG button */}
      <button
        onClick={onDownload}
        disabled={isDownloading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 9999,
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          color: "var(--muted-foreground)",
          cursor: isDownloading ? "default" : "pointer",
          opacity: isDownloading ? 0.5 : 1,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
        aria-label={t("downloadPng")}
      >
        <Download size={14} />
      </button>

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
        aria-label={t("saveDesign")}
      >
        <Save size={13} />
        {isSaving ? t("saving") : isDirty ? t("save") : t("saved")}
      </button>
    </div>
  )
}

// ─── Mobile Bottom Sheet ──────────────────────────────────

function MobileBottomSheet({
  isOpen,
  activeTool,
  onClose,
  children,
}: {
  isOpen: boolean
  activeTool: StudioTool | null
  onClose: () => void
  children: React.ReactNode
}) {
  const t = useTranslations("studio.panels")
  const [translateY, setTranslateY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startY = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  const PANEL_TITLES: Record<StudioTool, string> = {
    program: t("programSettings"),
    colors: t("colors"),
    fields: t("fields"),
    progress: t("progressStyle"),
    strip: t("stripImage"),
    logo: t("logo"),
    prize: t("prizeReveal"),
    avatar: t("holderPhoto"),
    notifications: t("notifications"),
    details: t("backOfPass"),
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) {
      setTranslateY(delta)
    }
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    if (translateY > 80) {
      onClose()
    }
    setTranslateY(0)
  }, [translateY, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.25)",
          zIndex: 19,
          animation: "sheetBackdropIn 0.2s ease",
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "55dvh",
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.2, 0, 0, 1)",
          backgroundColor: "var(--background)",
          borderRadius: "16px 16px 0 0",
          zIndex: 20,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: isDragging ? "none" : "sheetSlideIn 0.3s cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        {/* Drag handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 4px",
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: "var(--muted-foreground)",
              opacity: 0.3,
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            padding: "4px 16px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {activeTool ? PANEL_TITLES[activeTool] : ""}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9999,
              border: "none",
              backgroundColor: "var(--muted)",
              color: "var(--muted-foreground)",
              cursor: "pointer",
            }}
            aria-label={t("closePanel")}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "var(--border)", flexShrink: 0 }} />

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes sheetSlideIn {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes sheetBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ─── Mobile Tool Bar (Canva-style) ──────────────────────────

function MobileToolBar({
  activeTool,
  onToolSelect,
  cardType,
  passType,
  isDirty,
  isSaving,
  isDownloading,
  canUndo,
  canRedo,
  previewFormat,
  onUndo,
  onRedo,
  onSave,
  onDownload,
  onPreviewFormatChange,
}: {
  activeTool: StudioTool | null
  onToolSelect: (tool: StudioTool | null) => void
  cardType?: CardType
  passType: string
  isDirty: boolean
  isSaving: boolean
  isDownloading: boolean
  canUndo: boolean
  canRedo: boolean
  previewFormat: PreviewFormat
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onDownload: () => void
  onPreviewFormatChange: (fmt: PreviewFormat) => void
}) {
  const t = useTranslations("dashboard.studio")

  const ALL_TOOLS: { id: StudioTool; label: string; icon: React.ReactNode; condition?: boolean }[] = [
    { id: "program", label: t("program"), icon: <SlidersHorizontal size={20} /> },
    { id: "colors", label: t("colors"), icon: <Palette size={20} /> },
    { id: "fields", label: t("fields"), icon: <TextCursorInput size={20} /> },
    { id: "progress", label: t("progress"), icon: <BarChart3 size={20} />, condition: cardType === "STAMP" },
    { id: "strip", label: t("strip"), icon: <ImagePlus size={20} /> },
    { id: "logo", label: t("logo"), icon: <CircleUserRound size={20} /> },
    { id: "details", label: t("details"), icon: <FileText size={20} /> },
    { id: "notifications", label: t("notifications"), icon: <Bell size={20} /> },
    { id: "prize", label: t("prize"), icon: <Gift size={20} />, condition: passType === "STAMP_CARD" || passType === "COUPON" },
    { id: "avatar", label: t("avatar"), icon: <Camera size={20} />, condition: passType === "MEMBERSHIP" || passType === "ACCESS" || passType === "BUSINESS_ID" },
  ]

  const visibleTools = ALL_TOOLS.filter((tool) => tool.condition === undefined || tool.condition)

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--background)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        flexShrink: 0,
      }}
    >
      {/* Action row: undo/redo + format toggle + save */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Undo / Redo */}
        <div style={{ display: "flex", gap: 2 }}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            aria-label={t("undo")}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "none",
              background: "none",
              color: canUndo ? "var(--foreground)" : "var(--muted-foreground)",
              cursor: canUndo ? "pointer" : "default",
              opacity: canUndo ? 1 : 0.35,
            }}
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            aria-label={t("redo")}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "none",
              background: "none",
              color: canRedo ? "var(--foreground)" : "var(--muted-foreground)",
              cursor: canRedo ? "pointer" : "default",
              opacity: canRedo ? 1 : 0.35,
            }}
          >
            <Redo2 size={16} />
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Format toggle */}
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: 2,
            borderRadius: 9999,
            backgroundColor: "var(--muted)",
          }}
        >
          {(["apple", "google"] as PreviewFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => onPreviewFormatChange(fmt)}
              style={{
                padding: "4px 10px",
                borderRadius: 9999,
                border: "none",
                background: previewFormat === fmt ? "var(--background)" : "none",
                color: previewFormat === fmt ? "var(--foreground)" : "var(--muted-foreground)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: previewFormat === fmt ? 600 : 400,
                boxShadow: previewFormat === fmt ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              {fmt === "apple" && <Smartphone size={12} />}
              {fmt === "google" && <Tablet size={12} />}
              {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
            </button>
          ))}
        </div>

        {/* Download PNG button */}
        <button
          onClick={onDownload}
          disabled={isDownloading}
          aria-label={t("downloadPng")}
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            border: "none",
            background: "none",
            color: "var(--muted-foreground)",
            cursor: isDownloading ? "default" : "pointer",
            opacity: isDownloading ? 0.35 : 1,
          }}
        >
          <Download size={16} />
        </button>

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={isSaving || !isDirty}
          aria-label={t("saveDesign")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 14px",
            borderRadius: 9999,
            border: "none",
            backgroundColor: isDirty ? "var(--primary)" : "var(--muted)",
            color: isDirty ? "var(--primary-foreground)" : "var(--muted-foreground)",
            cursor: isDirty && !isSaving ? "pointer" : "default",
            fontSize: 12,
            fontWeight: 500,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          <Save size={13} />
          {isSaving ? t("saving") : isDirty ? t("save") : t("saved")}
        </button>
      </div>

      {/* Tool row: horizontally scrollable Canva-style */}
      <div
        data-studio-tools
        style={{
          display: "flex",
          overflowX: "auto",
          gap: 2,
          padding: "6px 8px",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {visibleTools.map((tool) => {
          const isActive = activeTool === tool.id
          return (
            <button
              key={tool.id}
              onClick={() => onToolSelect(isActive ? null : tool.id)}
              aria-label={tool.label}
              aria-pressed={isActive}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "8px 12px",
                minWidth: 56,
                border: "none",
                borderRadius: 12,
                background: isActive ? "var(--primary)" : "none",
                color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
                cursor: "pointer",
                flexShrink: 0,
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              {tool.icon}
              <span style={{ fontSize: 10, fontWeight: 500, whiteSpace: "nowrap" }}>
                {tool.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Hide scrollbar on tool row */}
      <style>{`
        [data-studio-tools]::-webkit-scrollbar { display: none; }
      `}</style>
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
  const t = useTranslations("dashboard.studio")
  const [previewKey, setPreviewKey] = useState(0)
  const filledPrizes = prizes.filter((p) => p.name.trim())
  const rewardText = filledPrizes.length > 0 ? filledPrizes[0].name : (rewardDescription || "Free reward!")
  const prizeNames = filledPrizes.length > 0 ? filledPrizes.map((p) => p.name) : undefined

  const gameLabel =
    gameType === "scratch" ? t("scratchCard")
    : gameType === "slots" ? t("slotMachine")
    : t("wheelOfFortune")

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
          {gameLabel}
        </span>
        <button
          onClick={() => setPreviewKey((k) => k + 1)}
          aria-label={t("replayAnimation")}
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
          {t("replay")}
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
          ? t("prizeCountHint", { count: filledPrizes.length, name: rewardText })
          : t("addPrizesHint")}
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

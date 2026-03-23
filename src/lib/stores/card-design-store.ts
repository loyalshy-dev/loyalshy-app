"use client"

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { temporal } from "zundo"
import type {
  StudioTool,
  PreviewFormat,
  DeviceFrame,
  ColorZone,
} from "@/types/editor"
import type {
  PatternStyle,
  ProgressStyle,

  LabelFormat,
  SocialLinks,
  StampGridConfig,
} from "@/lib/wallet/card-design"
import { DEFAULT_STAMP_GRID_CONFIG } from "@/lib/wallet/card-design"

// ─── Wallet Slice (typed DB columns) ──────────────────────

export type WalletState = {
  cardType: string
  showStrip: boolean
  primaryColor: string
  secondaryColor: string
  textColor: string
  labelColor: string | null  // label color override (null = auto-dim from textColor)
  autoTextColor: boolean
  patternStyle: PatternStyle
  progressStyle: ProgressStyle
  labelFormat: LabelFormat
  customProgressLabel: string
  palettePreset: string | null
  templateId: string | null
  stripImageUrl: string | null
  stripImageApple: string | null
  stripImageGoogle: string | null
  stripOpacity: number       // 0–1, default 1 (fully opaque)
  stripGrayscale: boolean    // convert strip image to black & white
  stripColor1: string | null // strip gradient start (null = use primaryColor)
  stripColor2: string | null // strip gradient end (null = use secondaryColor)
  stripFill: "flat" | "gradient" // flat = solid color, gradient = two-color gradient
  patternColor: string | null   // pattern accent color (null = use stripColor2)
  generatedStripApple: string | null
  generatedStripGoogle: string | null
  businessHours: string
  mapAddress: string
  mapLatitude: number | null
  mapLongitude: number | null
  locationMessage: string
  socialLinks: SocialLinks
  customMessage: string
  useStampGrid: boolean
  stampGridConfig: StampGridConfig
  stampFilledColor: string | null // stamp icon fill color (null = use stripColor2 ?? secondaryColor)
  stripImagePosition: { x: number; y: number }
  stripImageZoom: number
  logoAppleUrl: string | null
  logoGoogleUrl: string | null
  logoAppleZoom: number  // 1 = 100%, range 1–3
  logoGoogleZoom: number
  headerFields: string[] | null   // legacy — kept for backward compat
  secondaryFields: string[] | null // legacy — kept for backward compat
  programLogoUrl: string | null // program-level source logo (null = using org logo)
  holderPhotoUrl: string | null // uploaded holder avatar image URL
  fields: string[] | null  // unified ordered field list (null = default)
  fieldLabels: Record<string, string> | null // custom label overrides per field ID (null = use defaults)
  showPrimaryField: boolean // show primary field on Apple Wallet strip (default true)
}

// ─── Program Config Slice (PassTemplate.config JSON) ──────

export type ProgramConfigState = {
  name: string
  // STAMP_CARD
  stampsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
  // COUPON
  discountType: string
  discountValue: number
  couponCode: string
  couponDescription: string
  validUntil: string
  redemptionLimit: string
  // MEMBERSHIP
  membershipTier: string
  benefits: string
  validDuration: string
  customDurationDays: number
  autoRenew: boolean
  showHolderPhoto: boolean
  holderPhotoPosition: "left" | "center" | "right"
  // POINTS
  pointsPerVisit: number
  pointsLabel: string
  // GIFT_CARD
  currency: string
  initialBalanceCents: number
  partialRedemption: boolean
  expiryMonths: number
  // TICKET
  eventName: string
  eventDate: string
  eventVenue: string
  barcodeType: string
  maxScans: number
  // BUSINESS_CARD
  contactName: string
  jobTitle: string
  bcPhone: string
  bcEmail: string
  bcWebsite: string
  linkedinUrl: string
  twitterUrl: string
  instagramUrl: string
  // Schedule
  startsAt: string // ISO date string
  endsAt: string   // ISO date string (empty = no end)
  // Minigame (STAMP_CARD / COUPON only)
  minigameEnabled: boolean
  minigameType: "scratch" | "slots" | "wheel"
  minigamePrizes: { name: string; weight: number }[]
  minigamePrimaryColor: string
  minigameAccentColor: string
  // Shared
  terms: string
}

// ─── UI Slice ─────────────────────────────────────────────

type UIState = {
  activeTool: StudioTool | null
  previewFormat: PreviewFormat
  deviceFrame: DeviceFrame
  selectedColorZone: ColorZone | null
  isDirty: boolean
  isConfigDirty: boolean
  isSaving: boolean
  saveError: string | null
}

// ─── Combined Store ───────────────────────────────────────

type CardDesignStore = {
  wallet: WalletState
  programConfig: ProgramConfigState
  ui: UIState

  // Wallet actions
  setWalletField: <K extends keyof WalletState>(key: K, value: WalletState[K]) => void
  patchStampGridConfig: (patch: Partial<StampGridConfig>) => void
  patchSocialLinks: (patch: Partial<SocialLinks>) => void
  patchFieldLabels: (fieldId: string, newLabel: string | null) => void

  // Program config actions
  setConfigField: <K extends keyof ProgramConfigState>(key: K, value: ProgramConfigState[K]) => void

  // Template actions
  applyTemplate: (template: { wallet: Partial<WalletState> }) => void

  // UI actions
  setActiveTool: (tool: StudioTool | null) => void
  setPreviewFormat: (format: PreviewFormat) => void
  setDeviceFrame: (frame: DeviceFrame) => void
  setSelectedColorZone: (zone: ColorZone | null) => void
  setSaving: (saving: boolean) => void
  setSaveError: (error: string | null) => void
  markClean: () => void
  markConfigClean: () => void

  // Hydration
  hydrate: (wallet: Partial<WalletState>) => void
  hydrateConfig: (config: Partial<ProgramConfigState>) => void
}

// ─── Default config state ────────────────────────────────

const DEFAULT_CONFIG: ProgramConfigState = {
  name: "",
  stampsRequired: 10,
  rewardDescription: "",
  rewardExpiryDays: 0,
  discountType: "percentage",
  discountValue: 10,
  couponCode: "",
  couponDescription: "",
  validUntil: "",
  redemptionLimit: "single",
  membershipTier: "Member",
  benefits: "",
  validDuration: "yearly",
  customDurationDays: 365,
  autoRenew: false,
  showHolderPhoto: false,
  holderPhotoPosition: "right",
  pointsPerVisit: 1,
  pointsLabel: "pts",
  currency: "USD",
  initialBalanceCents: 2500,
  partialRedemption: true,
  expiryMonths: 12,
  eventName: "",
  eventDate: "",
  eventVenue: "",
  barcodeType: "qr",
  maxScans: 1,
  contactName: "",
  jobTitle: "",
  bcPhone: "",
  bcEmail: "",
  bcWebsite: "",
  linkedinUrl: "",
  twitterUrl: "",
  instagramUrl: "",
  startsAt: "",
  endsAt: "",
  minigameEnabled: false,
  minigameType: "scratch",
  minigamePrizes: [],
  minigamePrimaryColor: "",
  minigameAccentColor: "",
  terms: "",
}

// ─── Store Factory ────────────────────────────────────────

export function createCardDesignStore() {
  return create<CardDesignStore>()(
    temporal(
      immer((set) => ({
        // ─── Initial State ──────────────────────────
        wallet: {
          cardType: "STAMP",
          showStrip: true,
          primaryColor: "#1a1a2e",
          secondaryColor: "#ffffff",
          textColor: "#ffffff",
          labelColor: null,
          autoTextColor: true,
          patternStyle: "NONE",
          progressStyle: "NUMBERS",
          labelFormat: "UPPERCASE",
          customProgressLabel: "",
          palettePreset: null,
          templateId: null,
          stripImageUrl: null,
          stripImageApple: null,
          stripImageGoogle: null,
          stripOpacity: 1,
          stripGrayscale: false,
          stripColor1: null,
          stripColor2: null,
          stripFill: "gradient",
          patternColor: null,
          generatedStripApple: null,
          generatedStripGoogle: null,
          businessHours: "",
          mapAddress: "",
          mapLatitude: null,
          mapLongitude: null,
          locationMessage: "",
          socialLinks: {},
          customMessage: "",
          useStampGrid: false,
          stampGridConfig: { ...DEFAULT_STAMP_GRID_CONFIG },
          stampFilledColor: null,
          stripImagePosition: { x: 0.5, y: 0.5 },
          stripImageZoom: 1,
          logoAppleUrl: null,
          logoGoogleUrl: null,
          logoAppleZoom: 1,
          logoGoogleZoom: 1,
          programLogoUrl: null,
          holderPhotoUrl: null,
          headerFields: null,
          secondaryFields: null,
          fields: null,
          fieldLabels: null,
          showPrimaryField: true,
        },
        programConfig: { ...DEFAULT_CONFIG },
        ui: {
          activeTool: null,
          previewFormat: "apple",
          deviceFrame: "minimal",
          selectedColorZone: null,
          isDirty: false,
          isConfigDirty: false,
          isSaving: false,
          saveError: null,
        },

        // ─── Wallet Actions ─────────────────────────

        setWalletField: (key, value) =>
          set((state) => {
            ;(state.wallet as Record<string, unknown>)[key] = value
            state.ui.isDirty = true
          }),

        patchStampGridConfig: (patch) =>
          set((state) => {
            Object.assign(state.wallet.stampGridConfig, patch)
            state.ui.isDirty = true
          }),

        patchSocialLinks: (patch) =>
          set((state) => {
            Object.assign(state.wallet.socialLinks, patch)
            state.ui.isDirty = true
          }),

        patchFieldLabels: (fieldId, newLabel) =>
          set((state) => {
            if (newLabel) {
              state.wallet.fieldLabels = { ...(state.wallet.fieldLabels ?? {}), [fieldId]: newLabel }
            } else {
              const updated = { ...(state.wallet.fieldLabels ?? {}) }
              delete updated[fieldId]
              state.wallet.fieldLabels = Object.keys(updated).length > 0 ? updated : null
            }
            state.ui.isDirty = true
          }),

        // ─── Program Config Actions ─────────────────

        setConfigField: (key, value) =>
          set((state) => {
            ;(state.programConfig as Record<string, unknown>)[key] = value
            state.ui.isConfigDirty = true
          }),

        // ─── Template Actions ───────────────────────

        applyTemplate: (template) =>
          set((state) => {
            if (template.wallet) {
              Object.assign(state.wallet, template.wallet)
            }
            state.ui.isDirty = true
          }),

        // ─── UI Actions ────────────────────────────

        setActiveTool: (tool) =>
          set((state) => {
            state.ui.activeTool = tool
          }),

        setPreviewFormat: (format) =>
          set((state) => {
            state.ui.previewFormat = format
          }),

        setDeviceFrame: (frame) =>
          set((state) => {
            state.ui.deviceFrame = frame
          }),

        setSelectedColorZone: (zone) =>
          set((state) => {
            state.ui.selectedColorZone = zone
          }),

        setSaving: (saving) =>
          set((state) => {
            state.ui.isSaving = saving
          }),

        setSaveError: (error) =>
          set((state) => {
            state.ui.saveError = error
          }),

        markClean: () =>
          set((state) => {
            state.ui.isDirty = false
          }),

        markConfigClean: () =>
          set((state) => {
            state.ui.isConfigDirty = false
          }),

        // ─── Hydration ─────────────────────────────

        hydrate: (wallet) =>
          set((state) => {
            Object.assign(state.wallet, wallet)
            state.ui.isDirty = false
          }),

        hydrateConfig: (config) =>
          set((state) => {
            Object.assign(state.programConfig, config)
            state.ui.isConfigDirty = false
          }),
      })),
      {
        limit: 50,
        equality: (pastState, currentState) =>
          pastState.wallet === currentState.wallet &&
          pastState.programConfig === currentState.programConfig,
      }
    )
  )
}

export type CardDesignStoreApi = ReturnType<typeof createCardDesignStore>

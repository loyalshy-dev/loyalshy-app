"use client"

import { useState, useTransition, useRef } from "react"
import { toast } from "sonner"
import { PALETTE_PRESETS, computeTextColor } from "@/lib/wallet/card-design"
import { CARD_TEMPLATES, templateStripToCss } from "@/lib/wallet/card-templates"
import type { CardShape, PatternStyle, ProgressStyle, FontFamily, LabelFormat, SocialLinks } from "@/lib/wallet/card-design"
import {
  saveCardDesign,
  uploadStripImage,
  deleteStripImage,
  uploadRestaurantLogo,
  deleteRestaurantLogo,
} from "@/server/settings-actions"

// ─── Types ──────────────────────────────────────────────────

type Restaurant = {
  id: string
  name: string
  slug: string
  logo: string | null
  brandColor: string | null
  secondaryColor: string | null
}

export type CardDesignInput = {
  shape: CardShape
  primaryColor: string | null
  secondaryColor: string | null
  textColor: string | null
  stripImageUrl: string | null
  stripImageApple: string | null
  stripImageGoogle: string | null
  patternStyle: PatternStyle
  progressStyle: ProgressStyle
  fontFamily: FontFamily
  labelFormat: LabelFormat
  customProgressLabel: string | null
  generatedStripApple: string | null
  generatedStripGoogle: string | null
  palettePreset: string | null
  templateId: string | null
  businessHours: string | null
  mapAddress: string | null
  socialLinks: SocialLinks
  customMessage: string | null
  designHash: string
} | null

// ─── Hook ───────────────────────────────────────────────────

export function useCardDesignState(restaurant: Restaurant, programId: string, cardDesign: CardDesignInput) {
  const [isPending, startTransition] = useTransition()
  const [isUploading, setIsUploading] = useState(false)
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoFileInputRef = useRef<HTMLInputElement>(null)

  // ─── State ──────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState<string | null>(restaurant.logo)
  const [shape, setShapeInternal] = useState<CardShape>(cardDesign?.shape ?? "CLEAN")
  const [primaryColor, setPrimaryColorInternal] = useState(
    cardDesign?.primaryColor ?? restaurant.brandColor ?? "#1a1a2e"
  )
  const [secondaryColor, setSecondaryColorInternal] = useState(
    cardDesign?.secondaryColor ?? restaurant.secondaryColor ?? "#ffffff"
  )
  const initPrimary = cardDesign?.primaryColor ?? restaurant.brandColor ?? "#1a1a2e"
  const [autoTextColor, setAutoTextColor] = useState(
    !cardDesign?.textColor || cardDesign.textColor === computeTextColor(initPrimary)
  )
  const [textColor, setTextColorInternal] = useState(
    cardDesign?.textColor ?? computeTextColor(initPrimary)
  )
  const [patternStyle, setPatternStyleInternal] = useState<PatternStyle>(
    cardDesign?.patternStyle ?? "NONE"
  )
  const [palettePreset, setPalettePresetInternal] = useState<string | null>(
    cardDesign?.palettePreset ?? null
  )
  const [stripImageUrl, setStripImageUrlInternal] = useState<string | null>(
    cardDesign?.stripImageUrl ?? null
  )
  const [businessHours, setBusinessHours] = useState(cardDesign?.businessHours ?? "")
  const [mapAddress, setMapAddress] = useState(cardDesign?.mapAddress ?? "")
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(cardDesign?.socialLinks ?? {})
  const [customMessage, setCustomMessage] = useState(cardDesign?.customMessage ?? "")
  const [progressStyle, setProgressStyleInternal] = useState<ProgressStyle>(
    cardDesign?.progressStyle ?? "NUMBERS"
  )
  const [fontFamily, setFontFamilyInternal] = useState<FontFamily>(
    cardDesign?.fontFamily ?? "SANS"
  )
  const [labelFormat, setLabelFormatInternal] = useState<LabelFormat>(
    cardDesign?.labelFormat ?? "UPPERCASE"
  )
  const [customProgressLabel, setCustomProgressLabel] = useState(
    cardDesign?.customProgressLabel ?? ""
  )
  const [templateId, setTemplateIdInternal] = useState<string | null>(
    cardDesign?.templateId ?? null
  )

  // CSS background for the strip area — computed from template stripDesign
  const initTemplate = cardDesign?.templateId ? CARD_TEMPLATES.find((t) => t.id === cardDesign.templateId) : null
  const [stripCss, setStripCss] = useState<string | null>(
    initTemplate ? templateStripToCss(initTemplate.stripDesign) : null
  )

  // ─── Template-clearing wrappers ─────────────────────────
  // Any manual edit clears the templateId (only applyTemplate sets it)

  function clearTemplate() {
    setTemplateIdInternal(null)
    setStripCss(null)
  }

  function setShape(v: CardShape) {
    setShapeInternal(v)
    clearTemplate()
  }

  function setPrimaryColor(color: string) {
    setPrimaryColorInternal(color)
    if (autoTextColor) {
      setTextColorInternal(computeTextColor(color))
    }
    setPalettePresetInternal(null)
    clearTemplate()
  }

  function setSecondaryColor(color: string) {
    setSecondaryColorInternal(color)
    setPalettePresetInternal(null)
    clearTemplate()
  }

  function setTextColor(color: string) {
    setTextColorInternal(color)
    setAutoTextColor(false)
    clearTemplate()
  }

  function setPatternStyle(v: PatternStyle) {
    setPatternStyleInternal(v)
    if (v !== "NONE") {
      setStripImageUrlInternal(null)
    }
    clearTemplate()
  }

  function setProgressStyle(v: ProgressStyle) {
    setProgressStyleInternal(v)
    clearTemplate()
  }

  function setFontFamily(v: FontFamily) {
    setFontFamilyInternal(v)
    clearTemplate()
  }

  function setLabelFormat(v: LabelFormat) {
    setLabelFormatInternal(v)
    clearTemplate()
  }

  function setStripImageUrl(url: string | null) {
    setStripImageUrlInternal(url)
    clearTemplate()
  }

  // ─── Preset selection ───────────────────────────────────

  function handlePresetSelect(presetId: string) {
    const preset = PALETTE_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setPalettePresetInternal(presetId)
    setPrimaryColorInternal(preset.primary)
    setSecondaryColorInternal(preset.secondary)
    if (autoTextColor) {
      setTextColorInternal(computeTextColor(preset.primary))
    } else {
      setTextColorInternal(preset.text)
    }
    clearTemplate()
  }

  // ─── Template application ──────────────────────────────

  function applyTemplate(id: string) {
    const template = CARD_TEMPLATES.find((t) => t.id === id)
    if (!template) return

    setShapeInternal(template.design.shape)
    setPrimaryColorInternal(template.design.primaryColor)
    setSecondaryColorInternal(template.design.secondaryColor)
    setTextColorInternal(template.design.textColor)
    setPatternStyleInternal(template.design.patternStyle)
    setProgressStyleInternal(template.design.progressStyle)
    setFontFamilyInternal(template.design.fontFamily)
    setLabelFormatInternal(template.design.labelFormat)
    setPalettePresetInternal(template.design.palettePreset)
    setAutoTextColor(false) // Templates set explicit text colors
    setStripImageUrlInternal(null) // Will be generated on save
    setStripCss(templateStripToCss(template.stripDesign))
    setTemplateIdInternal(id)
  }

  // ─── File uploads ──────────────────────────────────────

  async function handleStripUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.set("programId", programId)
    formData.set("file", file)

    const result = await uploadStripImage(formData)
    setIsUploading(false)

    if ("error" in result) {
      toast.error(String(result.error))
    } else {
      setStripImageUrlInternal(result.originalUrl ?? null)
      setPatternStyleInternal("NONE")
      clearTemplate()
      toast.success("Strip image uploaded")
    }

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleStripDelete() {
    setIsUploading(true)
    const result = await deleteStripImage(programId)
    setIsUploading(false)

    if ("error" in result) {
      toast.error(String(result.error))
    } else {
      setStripImageUrlInternal(null)
      toast.success("Strip image removed")
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLogoUploading(true)
    const formData = new FormData()
    formData.set("restaurantId", restaurant.id)
    formData.set("file", file)

    const result = await uploadRestaurantLogo(formData)
    setIsLogoUploading(false)

    if ("error" in result) {
      toast.error(String(result.error))
    } else {
      setLogoUrl(result.url ?? null)
      toast.success("Logo uploaded")
    }

    if (logoFileInputRef.current) logoFileInputRef.current.value = ""
  }

  async function handleLogoDelete() {
    setIsLogoUploading(true)
    const result = await deleteRestaurantLogo(restaurant.id)
    setIsLogoUploading(false)

    if ("error" in result) {
      toast.error(String(result.error))
    } else {
      setLogoUrl(null)
      toast.success("Logo removed")
    }
  }

  // ─── Save ──────────────────────────────────────────────

  function handleSave(walletPassCount: number) {
    startTransition(async () => {
      const result = await saveCardDesign({
        programId,
        shape,
        primaryColor,
        secondaryColor,
        textColor,
        autoTextColor,
        patternStyle,
        progressStyle,
        fontFamily,
        labelFormat,
        customProgressLabel,
        palettePreset,
        templateId,
        businessHours,
        mapAddress,
        socialLinks: {
          instagram: socialLinks.instagram ?? "",
          facebook: socialLinks.facebook ?? "",
          tiktok: socialLinks.tiktok ?? "",
          x: socialLinks.x ?? "",
        },
        customMessage,
      })

      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(
          result.hashChanged && walletPassCount > 0
            ? `Card design saved! Updating ${walletPassCount} wallet pass${walletPassCount !== 1 ? "es" : ""}...`
            : "Card design saved!"
        )
      }
    })
  }

  return {
    // State values
    state: {
      logoUrl,
      shape,
      primaryColor,
      secondaryColor,
      autoTextColor,
      textColor,
      patternStyle,
      palettePreset,
      stripImageUrl,
      businessHours,
      mapAddress,
      socialLinks,
      customMessage,
      progressStyle,
      fontFamily,
      labelFormat,
      customProgressLabel,
      templateId,
      stripCss,
    },

    // Setters
    setShape,
    setPrimaryColor,
    setSecondaryColor,
    setTextColor,
    setAutoTextColor: (v: boolean) => {
      setAutoTextColor(v)
      if (v) setTextColorInternal(computeTextColor(primaryColor))
    },
    setPatternStyle,
    setProgressStyle,
    setFontFamily,
    setLabelFormat,
    setCustomProgressLabel,
    setStripImageUrl,
    setBusinessHours,
    setMapAddress,
    setSocialLinks,
    setCustomMessage,

    // Actions
    handlePresetSelect,
    applyTemplate,
    handleStripUpload,
    handleStripDelete,
    handleLogoUpload,
    handleLogoDelete,
    handleSave,

    // Status
    isPending,
    isUploading,
    isLogoUploading,

    // Refs
    fileInputRef,
    logoFileInputRef,
  }
}

export type CardDesignState = ReturnType<typeof useCardDesignState>

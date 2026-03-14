"use client"

import React, { useState, useRef } from "react"
import { useStore } from "zustand"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  Coffee,
  UtensilsCrossed,
  Smile,
  Wine,
  CakeSlice,
  Sparkles,
  Wand2,
  Loader2,
} from "lucide-react"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { CARD_TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/wallet/card-templates"
import type { CardTemplate, BusinessCategory } from "@/lib/wallet/card-templates"
import { matchTemplates, applyPaletteToTemplate } from "@/lib/wallet/template-matcher"
import type { ExtractedPalette } from "@/lib/color-extraction"
import { extractPaletteFromLogoUrl } from "@/server/org-settings-actions"
import { getStampIconPaths, getRewardIconPaths } from "@/lib/wallet/stamp-icons"
import type { CardType, StampGridConfig } from "@/lib/wallet/card-design"

// ─── Vibe Options are defined inside the component to use translations ───────

// ─── Template Swatch Preview ─────────────────────────────────

function TemplateSwatchPreview({
  primaryColor,
  secondaryColor,
  textColor,
  useStampGrid,
  stampGridConfig,
  templateCardType,
  height = 48,
}: {
  primaryColor: string
  secondaryColor: string
  textColor: string
  useStampGrid?: boolean
  stampGridConfig?: StampGridConfig
  templateCardType?: CardType
  height?: number
}) {
  // Only show stamp grid swatch for STAMP templates
  if (useStampGrid && stampGridConfig && (!templateCardType || templateCardType === "STAMP")) {
    const stampPaths = getStampIconPaths(stampGridConfig.stampIcon)
    const rewardPaths = getRewardIconPaths(stampGridConfig.rewardIcon)
    const borderRadius = stampGridConfig.stampShape === "circle" ? "50%"
      : stampGridConfig.stampShape === "rounded-square" ? "20%" : "0"
    const slotSize = Math.min(Math.floor(height * 0.55), 20)
    const iconSize = slotSize * (stampGridConfig.stampIconScale ?? 0.6)

    return (
      <div
        style={{
          height,
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          padding: "0 8px",
        }}
      >
        {/* Render 3 filled stamps + 1 reward stamp */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: slotSize,
              height: slotSize,
              borderRadius,
              backgroundColor: `${textColor}18`,
              border: `1.5px solid ${textColor}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width={iconSize}
              height={iconSize}
              viewBox="0 0 24 24"
              fill="none"
              stroke={textColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.8 }}
              dangerouslySetInnerHTML={{ __html: stampPaths }}
            />
          </div>
        ))}
        {/* Reward slot */}
        <div
          style={{
            width: slotSize,
            height: slotSize,
            borderRadius,
            backgroundColor: `${textColor}10`,
            border: `1.5px dashed ${textColor}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke={textColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.45 }}
            dangerouslySetInnerHTML={{ __html: rewardPaths }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        height,
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: height < 44 ? 8 : 9, color: textColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.9 }}>
        Preview
      </span>
    </div>
  )
}

// ─── Props ──────────────────────────────────────────────────

type Props = {
  store: CardDesignStoreApi
  organizationId: string
  organizationLogo: string | null
  cardType?: CardType
}

// ─── Component ──────────────────────────────────────────────

export function TemplatePanel({ store, organizationId, organizationLogo, cardType }: Props) {
  const t = useTranslations("studio.template")
  const currentTemplateId = useStore(store, (s) => s.wallet.templateId)
  const [categoryFilter, setCategoryFilter] = useState<BusinessCategory | "all">("all")

  const VIBE_OPTIONS: { id: BusinessCategory; label: string; icon: typeof Coffee }[] = [
    { id: "cafe", label: t("cafe"), icon: Coffee },
    { id: "fine-dining", label: t("fineDining"), icon: UtensilsCrossed },
    { id: "casual", label: t("casual"), icon: Smile },
    { id: "bar", label: t("bar"), icon: Wine },
    { id: "bakery", label: t("bakery"), icon: CakeSlice },
    { id: "general", label: t("general"), icon: Sparkles },
  ]

  // Brand Match state
  const [brandCategory, setBrandCategory] = useState<BusinessCategory | null>(null)
  const [isMatching, setIsMatching] = useState(false)
  const [matchResults, setMatchResults] = useState<{ template: CardTemplate; palette: ExtractedPalette | null; matchedCategory: BusinessCategory | null }[] | null>(null)
  const [matchPalette, setMatchPalette] = useState<ExtractedPalette | null>(null)

  // Cache palette per logo URL to avoid redundant server calls
  const paletteCacheRef = useRef<{ url: string; palette: ExtractedPalette } | null>(null)

  // Filter templates by cardType and category
  const filtered = CARD_TEMPLATES.filter((t) => {
    // Filter by card type: match template's cardType (default "STAMP" for untagged)
    const templateCardType = t.design.cardType ?? "STAMP"
    if (cardType && templateCardType !== cardType) return false
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false
    return true
  })

  function applyTemplate(template: CardTemplate) {
    const s = store.getState()
    s.applyTemplate({
      wallet: {
        showStrip: template.design.showStrip,
        primaryColor: template.design.primaryColor,
        secondaryColor: template.design.secondaryColor,
        textColor: template.design.textColor,
        patternStyle: template.design.patternStyle,
        progressStyle: template.design.progressStyle,
        labelFormat: template.design.labelFormat,
        palettePreset: template.design.palettePreset,
        templateId: template.id,
        useStampGrid: template.design.useStampGrid ?? false,
        ...(template.design.stampGridConfig
          ? { stampGridConfig: template.design.stampGridConfig }
          : {}),
      },
    })
  }

  function applyMatchedTemplate(template: CardTemplate, palette: ExtractedPalette | null, category: BusinessCategory | null = brandCategory) {
    const design = applyPaletteToTemplate(template, palette, category)
    const s = store.getState()
    s.applyTemplate({
      wallet: {
        showStrip: design.showStrip,
        primaryColor: design.primaryColor,
        secondaryColor: design.secondaryColor,
        textColor: design.textColor,
        patternStyle: design.patternStyle,
        progressStyle: design.progressStyle,
        labelFormat: design.labelFormat,
        palettePreset: null,
        templateId: template.id,
        useStampGrid: design.useStampGrid ?? false,
        ...(design.stampGridConfig
          ? { stampGridConfig: design.stampGridConfig }
          : {}),
      },
    })
  }

  function startFromScratch() {
    const s = store.getState()
    s.applyTemplate({
      wallet: {
        showStrip: false,
        primaryColor: "#1a1a2e",
        secondaryColor: "#ffffff",
        textColor: "#ffffff",
        patternStyle: "NONE",
        progressStyle: "NUMBERS",
        labelFormat: "UPPERCASE",
        palettePreset: null,
        templateId: null,
      },
    })
  }

  async function handleBrandMatch() {
    setIsMatching(true)

    try {
      let palette: ExtractedPalette | null = null

      // Extract palette from organization logo if available (cached per URL)
      if (organizationLogo) {
        if (paletteCacheRef.current?.url === organizationLogo) {
          palette = paletteCacheRef.current.palette
        } else {
          const result = await extractPaletteFromLogoUrl(organizationId)
          if ("palette" in result && result.palette) {
            palette = result.palette
            paletteCacheRef.current = { url: organizationLogo, palette: palette! }
          }
        }
        if (palette) setMatchPalette(palette)
      }

      // Run template matching (filter by cardType)
      const allMatches = matchTemplates(palette, brandCategory, 20)
      const matches = cardType
        ? allMatches.filter((m) => (m.template.design.cardType ?? "STAMP") === cardType).slice(0, 4)
        : allMatches.slice(0, 4)

      setMatchResults(
        matches.map((m) => ({ template: m.template, palette, matchedCategory: brandCategory }))
      )

      // Auto-apply the top match
      if (matches.length > 0) {
        applyMatchedTemplate(matches[0].template, palette)
        toast.success("Template matched to your brand!")
      }
    } catch {
      toast.error("Failed to match templates. Please try again.")
    } finally {
      setIsMatching(false)
    }
  }

  return (
    <div>
      {/* ─── Brand Match Section ─────────────────────────── */}
      <div
        style={{
          padding: 10,
          borderRadius: 8,
          border: "1px solid var(--border)",
          backgroundColor: "var(--accent)",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <Wand2 size={14} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
            Brand Match
          </span>
        </div>

        {organizationLogo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              padding: "6px 8px",
              borderRadius: 6,
              backgroundColor: "var(--background)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={organizationLogo}
              alt=""
              style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }}
            />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Colors will be extracted from your logo
            </span>
          </div>
        )}

        {/* Extracted palette dots */}
        {matchPalette && matchPalette.colors.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 8,
              padding: "4px 8px",
              borderRadius: 6,
              backgroundColor: "var(--background)",
            }}
          >
            {matchPalette.colors.slice(0, 5).map((c, i) => (
              <div
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: c.hex,
                  border: "1px solid var(--border)",
                }}
                title={`${c.hex} (${c.percentage}%)`}
              />
            ))}
            <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 4 }}>
              {matchPalette.isMonochrome ? "Monochrome" : `${matchPalette.colors.length} colors`}
            </span>
          </div>
        )}

        {/* Vibe selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, marginBottom: 8 }}>
          {VIBE_OPTIONS.map((vibe) => {
            const Icon = vibe.icon
            const isSelected = brandCategory === vibe.id
            return (
              <button
                key={vibe.id}
                onClick={() => setBrandCategory(isSelected ? null : vibe.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  padding: "6px 4px",
                  borderRadius: 6,
                  border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: isSelected ? "var(--primary)" : "var(--background)",
                  color: isSelected ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  cursor: "pointer",
                  fontSize: 9,
                  fontWeight: isSelected ? 600 : 400,
                  transition: "all 100ms",
                }}
              >
                <Icon size={14} />
                {vibe.label}
              </button>
            )
          })}
        </div>

        <button
          onClick={handleBrandMatch}
          disabled={isMatching || (!organizationLogo && !brandCategory)}
          style={{
            width: "100%",
            padding: "7px 14px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
            cursor: isMatching || (!organizationLogo && !brandCategory) ? "not-allowed" : "pointer",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: isMatching || (!organizationLogo && !brandCategory) ? 0.5 : 1,
          }}
        >
          {isMatching ? (
            <>
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              Matching...
            </>
          ) : (
            <>
              <Wand2 size={13} />
              {matchResults ? "Re-match" : "Match to my brand"}
            </>
          )}
        </button>

        {!organizationLogo && !brandCategory && (
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4, textAlign: "center" }}>
            Upload a logo in the Logo panel or pick a vibe above
          </div>
        )}
      </div>

      {/* ─── Brand Match Results ─────────────────────────── */}
      {matchResults && matchResults.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", margin: "0 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Matched for you
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {matchResults.map(({ template, palette, matchedCategory }) => {
              const design = applyPaletteToTemplate(template, palette, matchedCategory)
              const isActive = currentTemplateId === template.id
              return (
                <button
                  key={template.id}
                  onClick={() => applyMatchedTemplate(template, palette, matchedCategory)}
                  style={{
                    borderRadius: 8,
                    border: `2px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                    backgroundColor: "var(--background)",
                    cursor: "pointer",
                    overflow: "hidden",
                    padding: 0,
                    textAlign: "left",
                  }}
                >
                  <TemplateSwatchPreview
                    primaryColor={design.primaryColor}
                    secondaryColor={design.secondaryColor}
                    textColor={design.textColor}

                    useStampGrid={design.useStampGrid}
                    stampGridConfig={design.stampGridConfig}
                    templateCardType={template.design.cardType}
                    height={40}
                  />
                  <div style={{ padding: "4px 6px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {template.name}
                    </div>
                    <div style={{ fontSize: 8, color: "var(--muted-foreground)", marginTop: 1 }}>
                      {template.category} — brand colors
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Category filter ─────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryFilter(c.id as BusinessCategory | "all")}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              border: "none",
              backgroundColor: categoryFilter === c.id ? "var(--accent)" : "transparent",
              color: categoryFilter === c.id ? "var(--accent-foreground)" : "var(--muted-foreground)",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: categoryFilter === c.id ? 600 : 400,
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Start from scratch */}
      <button
        onClick={startFromScratch}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px dashed var(--border)",
          backgroundColor: "transparent",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 18 }}>+</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>
            Blank Card
          </div>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
            Start with default settings
          </div>
        </div>
      </button>

      {/* Template grid */}
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", margin: "0 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {filtered.length} template{filtered.length !== 1 ? "s" : ""}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {filtered.map((t) => {
          const isActive = currentTemplateId === t.id
          return (
            <button
              key={t.id}
              onClick={() => applyTemplate(t)}
              style={{
                borderRadius: 8,
                border: `2px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                backgroundColor: "var(--background)",
                cursor: "pointer",
                overflow: "hidden",
                padding: 0,
                textAlign: "left",
              }}
            >
              {/* Color swatch preview */}
              <TemplateSwatchPreview
                primaryColor={t.design.primaryColor}
                secondaryColor={t.design.secondaryColor}
                textColor={t.design.textColor}

                useStampGrid={t.design.useStampGrid}
                stampGridConfig={t.design.stampGridConfig}
                templateCardType={t.design.cardType}
              />
              <div style={{ padding: "6px 8px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted-foreground)", marginTop: 1 }}>
                  {t.category}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

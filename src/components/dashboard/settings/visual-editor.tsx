"use client"

import { useState } from "react"
import {
  Palette,
  Image,
  Hash,
  Type,
  Upload,
  X,
  Sparkles,
  Check,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CardPreview } from "./card-preview"
import type { CardPreviewZone } from "./card-preview"
import { PALETTE_PRESETS } from "@/lib/wallet/card-design"
import type { CardShape, PatternStyle, ProgressStyle, FontFamily, LabelFormat } from "@/lib/wallet/card-design"
import type { CardDesignState } from "@/hooks/use-card-design-state"

// ─── Constants ──────────────────────────────────────────────

const SHAPES: { id: CardShape; name: string; description: string }[] = [
  { id: "CLEAN", name: "Clean", description: "Minimal, no strip" },
  { id: "SHOWCASE", name: "Showcase", description: "Hero image" },
  { id: "INFO_RICH", name: "Info Rich", description: "Maximum fields" },
]

const FILL_OPTIONS: { id: PatternStyle; name: string }[] = [
  { id: "NONE", name: "None" },
  { id: "SOLID_PRIMARY", name: "Primary" },
  { id: "SOLID_SECONDARY", name: "Secondary" },
]

const PATTERN_OPTIONS: { id: PatternStyle; name: string }[] = [
  { id: "DOTS", name: "Dots" },
  { id: "WAVES", name: "Waves" },
  { id: "GEOMETRIC", name: "Geometric" },
  { id: "CHEVRON", name: "Chevron" },
  { id: "CROSSHATCH", name: "Crosshatch" },
  { id: "DIAMONDS", name: "Diamonds" },
  { id: "CONFETTI", name: "Confetti" },
]

const PROGRESS_STYLES: { id: ProgressStyle; name: string; preview: string }[] = [
  { id: "NUMBERS", name: "Numbers", preview: "3 / 10" },
  { id: "CIRCLES", name: "Circles", preview: "●●●○○○" },
  { id: "SQUARES", name: "Squares", preview: "■■■□□□" },
  { id: "STARS", name: "Stars", preview: "★★★☆☆☆" },
  { id: "STAMPS", name: "Stamps", preview: "◉◉◉◎◎◎" },
  { id: "PERCENTAGE", name: "Percent", preview: "30%" },
  { id: "REMAINING", name: "Remaining", preview: "7 more" },
]

const FONT_FAMILIES: { id: FontFamily; name: string; css: string }[] = [
  { id: "SANS", name: "Sans", css: "inherit" },
  { id: "SERIF", name: "Serif", css: "Georgia, serif" },
  { id: "ROUNDED", name: "Rounded", css: "system-ui" },
  { id: "MONO", name: "Mono", css: "monospace" },
]

const LABEL_FORMATS: { id: LabelFormat; name: string; preview: string }[] = [
  { id: "UPPERCASE", name: "UPPER", preview: "PROGRESS" },
  { id: "TITLE_CASE", name: "Title", preview: "Progress" },
  { id: "LOWERCASE", name: "lower", preview: "progress" },
]

// ─── Zone editing panels ────────────────────────────────────

function ColorsPanel({ ds }: { ds: CardDesignState }) {
  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="grid grid-cols-5 gap-2">
        {PALETTE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => ds.handlePresetSelect(preset.id)}
            className={`relative h-9 w-full rounded-lg overflow-hidden border-2 transition-all ${
              ds.state.palettePreset === preset.id
                ? "border-foreground ring-1 ring-foreground/20 scale-110"
                : "border-transparent hover:border-foreground/20"
            }`}
            title={preset.name}
            aria-label={`${preset.name} palette`}
          >
            <div className="absolute inset-0" style={{ backgroundColor: preset.primary }} />
            <div className="absolute bottom-0 right-0 w-1/2 h-1/2 rounded-tl-md" style={{ backgroundColor: preset.secondary }} />
            {ds.state.palettePreset === preset.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Shape selector */}
      <div className="space-y-2">
        <Label className="text-xs">Card Shape</Label>
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => ds.setShape(s.id)}
              className={`rounded-lg border-2 p-2 text-left transition-all ${
                ds.state.shape === s.id
                  ? "border-foreground bg-foreground/[0.03]"
                  : "border-border hover:border-foreground/20"
              }`}
            >
              <div className="text-[11px] font-medium">{s.name}</div>
              <div className="text-[10px] text-muted-foreground">{s.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom colors */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Primary</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={ds.state.primaryColor}
              onChange={(e) => ds.setPrimaryColor(e.target.value)}
              className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-input p-0.5"
            />
            <Input value={ds.state.primaryColor} onChange={(e) => ds.setPrimaryColor(e.target.value)} className="font-mono text-xs h-8" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Secondary</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={ds.state.secondaryColor}
              onChange={(e) => ds.setSecondaryColor(e.target.value)}
              className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-input p-0.5"
            />
            <Input value={ds.state.secondaryColor} onChange={(e) => ds.setSecondaryColor(e.target.value)} className="font-mono text-xs h-8" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Text</Label>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={ds.state.autoTextColor}
                onChange={(e) => ds.setAutoTextColor(e.target.checked)}
                className="h-3 w-3 rounded border-border"
              />
              Auto
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={ds.state.textColor}
              onChange={(e) => ds.setTextColor(e.target.value)}
              disabled={ds.state.autoTextColor}
              className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-input p-0.5 disabled:opacity-50"
            />
            <Input
              value={ds.state.textColor}
              onChange={(e) => ds.setTextColor(e.target.value)}
              disabled={ds.state.autoTextColor}
              className="font-mono text-xs h-8"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StripPanel({ ds }: { ds: CardDesignState }) {
  const showStripSection = ds.state.shape === "SHOWCASE" || ds.state.shape === "INFO_RICH"

  if (!showStripSection) {
    return (
      <p className="text-xs text-muted-foreground">
        Strip images are only available with Showcase or Info Rich card shapes.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="flex items-center gap-3">
        {ds.state.stripImageUrl ? (
          <div className="relative h-14 w-32 rounded-lg overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ds.state.stripImageUrl} alt="Strip" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-14 w-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ds.isUploading}
              onClick={() => ds.fileInputRef.current?.click()}
              className="h-7 text-xs"
            >
              {ds.isUploading ? "Uploading..." : "Upload"}
            </Button>
            {ds.state.stripImageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={ds.isUploading}
                onClick={ds.handleStripDelete}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">PNG, JPEG, WebP. Max 5MB.</p>
        </div>
        <input
          ref={ds.fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={ds.handleStripUpload}
        />
      </div>

      {/* Fill */}
      <div className="space-y-1.5">
        <Label className="text-xs">Fill</Label>
        <div className="flex gap-1.5">
          {FILL_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                ds.setPatternStyle(p.id)
                if (p.id !== "NONE") ds.setStripImageUrl(null)
              }}
              disabled={!!ds.state.stripImageUrl && p.id !== "NONE"}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-40 ${
                ds.state.patternStyle === p.id && !ds.state.stripImageUrl
                  ? "border-foreground bg-foreground text-background"
                  : "border-input hover:border-foreground/30"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Pattern */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          Pattern
        </Label>
        <div className="grid grid-cols-4 gap-1.5">
          {PATTERN_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                ds.setPatternStyle(p.id)
                ds.setStripImageUrl(null)
              }}
              disabled={!!ds.state.stripImageUrl}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors disabled:opacity-40 ${
                ds.state.patternStyle === p.id && !ds.state.stripImageUrl
                  ? "border-foreground bg-foreground text-background"
                  : "border-input hover:border-foreground/30"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProgressPanel({ ds }: { ds: CardDesignState }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {PROGRESS_STYLES.map((ps) => (
          <button
            key={ps.id}
            type="button"
            onClick={() => ds.setProgressStyle(ps.id)}
            className={`rounded-lg border-2 p-2 text-left transition-all ${
              ds.state.progressStyle === ps.id
                ? "border-foreground bg-foreground/[0.03]"
                : "border-border hover:border-foreground/20"
            }`}
          >
            <div className="text-[11px] font-medium">{ps.name}</div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">{ps.preview}</div>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ve-progress-label" className="text-xs">Custom label</Label>
        <Input
          id="ve-progress-label"
          value={ds.state.customProgressLabel}
          onChange={(e) => ds.setCustomProgressLabel(e.target.value.slice(0, 30))}
          placeholder="PROGRESS"
          maxLength={30}
          className="text-xs h-8"
        />
      </div>
    </div>
  )
}

function TypographyPanel({ ds }: { ds: CardDesignState }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Font Family</Label>
        <div className="flex gap-1.5">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => ds.setFontFamily(f.id)}
              className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
                ds.state.fontFamily === f.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-input hover:border-foreground/30"
              }`}
              style={{ fontFamily: f.css }}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Label Format</Label>
        <div className="flex gap-1.5">
          {LABEL_FORMATS.map((lf) => (
            <button
              key={lf.id}
              type="button"
              onClick={() => ds.setLabelFormat(lf.id)}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                ds.state.labelFormat === lf.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-input hover:border-foreground/30"
              }`}
            >
              {lf.preview}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function LogoPanel({ ds }: { ds: CardDesignState }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {ds.state.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ds.state.logoUrl} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ds.isLogoUploading}
              onClick={() => ds.logoFileInputRef.current?.click()}
              className="h-7 text-xs"
            >
              {ds.isLogoUploading ? "Uploading..." : "Upload logo"}
            </Button>
            {ds.state.logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={ds.isLogoUploading}
                onClick={ds.handleLogoDelete}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">PNG, JPEG, WebP, SVG. Max 2MB.</p>
        </div>
        <input
          ref={ds.logoFileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={ds.handleLogoUpload}
        />
      </div>
    </div>
  )
}

// ─── Zone titles ────────────────────────────────────────────

const ZONE_CONFIG: Record<CardPreviewZone, { title: string; icon: typeof Palette }> = {
  colors: { title: "Colors & Shape", icon: Palette },
  strip: { title: "Strip / Background", icon: Image },
  progress: { title: "Progress Style", icon: Hash },
  typography: { title: "Typography", icon: Type },
  logo: { title: "Logo", icon: Upload },
}

// ─── Mobile action buttons ──────────────────────────────────

const MOBILE_ACTIONS: { zone: CardPreviewZone; label: string; icon: typeof Palette }[] = [
  { zone: "colors", label: "Colors", icon: Palette },
  { zone: "strip", label: "Background", icon: Image },
  { zone: "progress", label: "Stamps", icon: Hash },
  { zone: "typography", label: "Text", icon: Type },
  { zone: "logo", label: "Logo", icon: Upload },
]

// ─── Main Component ─────────────────────────────────────────

type VisualEditorProps = {
  ds: CardDesignState
  restaurantName: string
}

export function VisualEditor({ ds, restaurantName }: VisualEditorProps) {
  const [activeZone, setActiveZone] = useState<CardPreviewZone | null>(null)
  const [mobileSheet, setMobileSheet] = useState<CardPreviewZone | null>(null)

  function handleZoneClick(zone: CardPreviewZone) {
    setActiveZone(zone)
  }

  function renderPanel(zone: CardPreviewZone) {
    switch (zone) {
      case "colors":
        return <ColorsPanel ds={ds} />
      case "strip":
        return <StripPanel ds={ds} />
      case "progress":
        return <ProgressPanel ds={ds} />
      case "typography":
        return <TypographyPanel ds={ds} />
      case "logo":
        return <LogoPanel ds={ds} />
    }
  }

  return (
    <>
      {/* Desktop: Side-by-side layout */}
      <div className="hidden lg:grid lg:grid-cols-[1fr,280px] gap-4">
        {/* Interactive preview */}
        <div className="flex justify-center">
          <div className="w-full max-w-[320px]">
            <CardPreview
              restaurantName={restaurantName}
              logoUrl={ds.state.logoUrl}
              shape={ds.state.shape}
              primaryColor={ds.state.primaryColor}
              secondaryColor={ds.state.secondaryColor}
              textColor={ds.state.textColor}
              patternStyle={ds.state.patternStyle}
              progressStyle={ds.state.progressStyle}
              fontFamily={ds.state.fontFamily}
              labelFormat={ds.state.labelFormat}
              customProgressLabel={ds.state.customProgressLabel || null}
              stripImageUrl={ds.state.stripImageUrl}
              stripCss={ds.state.stripCss}
              customMessage={ds.state.customMessage}
              onZoneClick={handleZoneClick}
            />
          </div>
        </div>

        {/* Contextual panel */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {activeZone ? (
            <>
              <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => { const Icon = ZONE_CONFIG[activeZone].icon; return <Icon className="h-3.5 w-3.5 text-muted-foreground" /> })()}
                  <h3 className="text-xs font-semibold">{ZONE_CONFIG[activeZone].title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveZone(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close panel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-4 animate-in fade-in slide-in-from-right-2 duration-200">
                {renderPanel(activeZone)}
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <p className="font-medium mb-1">Click a zone on the preview</p>
              <p>Hover over the card to see editable areas</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Preview + button row + sheets */}
      <div className="lg:hidden space-y-4">
        {/* Static preview */}
        <div className="flex justify-center">
          <div className="w-full max-w-[300px]">
            <CardPreview
              restaurantName={restaurantName}
              logoUrl={ds.state.logoUrl}
              shape={ds.state.shape}
              primaryColor={ds.state.primaryColor}
              secondaryColor={ds.state.secondaryColor}
              textColor={ds.state.textColor}
              patternStyle={ds.state.patternStyle}
              progressStyle={ds.state.progressStyle}
              fontFamily={ds.state.fontFamily}
              labelFormat={ds.state.labelFormat}
              customProgressLabel={ds.state.customProgressLabel || null}
              stripImageUrl={ds.state.stripImageUrl}
              stripCss={ds.state.stripCss}
              customMessage={ds.state.customMessage}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MOBILE_ACTIONS.map(({ zone, label, icon: Icon }) => (
            <button
              key={zone}
              type="button"
              onClick={() => setMobileSheet(zone)}
              className="shrink-0 flex flex-col items-center gap-1 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Bottom sheets */}
        {MOBILE_ACTIONS.map(({ zone }) => (
          <Sheet key={zone} open={mobileSheet === zone} onOpenChange={(open) => !open && setMobileSheet(null)}>
            <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-sm">{ZONE_CONFIG[zone].title}</SheetTitle>
              </SheetHeader>
              <div className="py-4">
                {renderPanel(zone)}
              </div>
            </SheetContent>
          </Sheet>
        ))}
      </div>
    </>
  )
}

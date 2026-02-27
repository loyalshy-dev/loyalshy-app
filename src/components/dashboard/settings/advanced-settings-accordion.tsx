"use client"

import { useState } from "react"
import {
  Upload,
  X,
  Sparkles,
  Check,
  Palette,
  Image,
  Hash,
  Type,
  Layers,
  FileText,
  ArrowLeft,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PALETTE_PRESETS } from "@/lib/wallet/card-design"
import type { CardShape, PatternStyle, ProgressStyle, FontFamily, LabelFormat } from "@/lib/wallet/card-design"
import type { CardDesignState } from "@/hooks/use-card-design-state"

// ─── Constants ──────────────────────────────────────────────

const SHAPES: { id: CardShape; name: string; description: string }[] = [
  { id: "CLEAN", name: "Clean", description: "Minimal, no strip image. Focus on information." },
  { id: "SHOWCASE", name: "Showcase", description: "Hero image dominates. Brand-forward." },
  { id: "INFO_RICH", name: "Info Rich", description: "Maximum info with optional strip." },
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
  { id: "NUMBERS", name: "Numbers", preview: "3 / 10 Visits" },
  { id: "CIRCLES", name: "Circles", preview: "●●●○○○○○○○" },
  { id: "SQUARES", name: "Squares", preview: "■■■□□□□□□□" },
  { id: "STARS", name: "Stars", preview: "★★★☆☆☆☆☆☆☆" },
  { id: "STAMPS", name: "Stamps", preview: "◉◉◉◎◎◎◎◎◎◎" },
  { id: "PERCENTAGE", name: "Percent", preview: "30%" },
  { id: "REMAINING", name: "Remaining", preview: "7 more visits" },
]

const FONT_FAMILIES: { id: FontFamily; name: string; css: string }[] = [
  { id: "SANS", name: "Sans", css: "inherit" },
  { id: "SERIF", name: "Serif", css: "Georgia, Cambria, 'Times New Roman', serif" },
  { id: "ROUNDED", name: "Rounded", css: "'SF Pro Rounded', system-ui, sans-serif" },
  { id: "MONO", name: "Mono", css: "var(--font-geist-mono), 'Courier New', monospace" },
]

const LABEL_FORMATS: { id: LabelFormat; name: string; preview: string }[] = [
  { id: "UPPERCASE", name: "UPPER", preview: "PROGRESS" },
  { id: "TITLE_CASE", name: "Title", preview: "Progress" },
  { id: "LOWERCASE", name: "lower", preview: "progress" },
]

// ─── Section definitions ────────────────────────────────────

type SectionId = "logo" | "shape" | "colors" | "strip" | "progress" | "typography" | "back-of-pass"

const SECTIONS: { id: SectionId; label: string; description: string; icon: typeof Palette; stripOnly?: boolean }[] = [
  { id: "logo", label: "Logo", description: "Restaurant logo", icon: Upload },
  { id: "shape", label: "Card Shape", description: "Clean, Showcase, Info Rich", icon: Layers },
  { id: "colors", label: "Color Palette", description: "Presets & custom colors", icon: Palette },
  { id: "strip", label: "Strip / Hero", description: "Image, fill & patterns", icon: Image, stripOnly: true },
  { id: "progress", label: "Progress Style", description: "Numbers, stamps, icons", icon: Hash },
  { id: "typography", label: "Typography", description: "Font & label format", icon: Type },
  { id: "back-of-pass", label: "Back-of-Pass", description: "Hours, address, socials", icon: FileText },
]

// ─── Section content panels ─────────────────────────────────

function LogoContent({ ds }: { ds: CardDesignState }) {
  return (
    <div className="flex items-center gap-5">
      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {ds.state.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ds.state.logoUrl} alt="Restaurant logo" className="h-full w-full object-cover" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ds.isLogoUploading}
            onClick={() => ds.logoFileInputRef.current?.click()}
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
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, or SVG. Max 2MB.</p>
      </div>
      <input
        ref={ds.logoFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={ds.handleLogoUpload}
      />
    </div>
  )
}

function ShapeContent({ ds }: { ds: CardDesignState }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SHAPES.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => ds.setShape(s.id)}
          className={`rounded-lg border-2 p-4 text-left transition-all ${
            ds.state.shape === s.id
              ? "border-foreground bg-foreground/[0.03] ring-1 ring-foreground/10"
              : "border-border hover:border-foreground/20"
          }`}
        >
          <div className="text-sm font-medium">{s.name}</div>
          <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{s.description}</div>
        </button>
      ))}
    </div>
  )
}

function ColorsContent({ ds }: { ds: CardDesignState }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {PALETTE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => ds.handlePresetSelect(preset.id)}
            className={`group relative h-10 w-full rounded-lg overflow-hidden border-2 transition-all ${
              ds.state.palettePreset === preset.id
                ? "border-foreground ring-1 ring-foreground/20 scale-110"
                : "border-transparent hover:border-foreground/20"
            }`}
            title={preset.name}
            aria-label={`${preset.name} color palette`}
          >
            <div className="absolute inset-0" style={{ backgroundColor: preset.primary }} />
            <div className="absolute bottom-0 right-0 w-1/2 h-1/2 rounded-tl-md" style={{ backgroundColor: preset.secondary }} />
            {ds.state.palettePreset === preset.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check className="h-4 w-4 text-white drop-shadow-md" />
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="adv-primaryColor" className="text-xs">Primary Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={ds.state.primaryColor}
              onChange={(e) => ds.setPrimaryColor(e.target.value)}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input p-0.5"
            />
            <Input
              id="adv-primaryColor"
              value={ds.state.primaryColor}
              onChange={(e) => ds.setPrimaryColor(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adv-secondaryColor" className="text-xs">Secondary Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={ds.state.secondaryColor}
              onChange={(e) => ds.setSecondaryColor(e.target.value)}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input p-0.5"
            />
            <Input
              id="adv-secondaryColor"
              value={ds.state.secondaryColor}
              onChange={(e) => ds.setSecondaryColor(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="adv-textColor" className="text-xs">Text Color</Label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
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
              className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input p-0.5 disabled:opacity-50"
            />
            <Input
              id="adv-textColor"
              value={ds.state.textColor}
              onChange={(e) => ds.setTextColor(e.target.value)}
              disabled={ds.state.autoTextColor}
              className="font-mono text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StripContent({ ds }: { ds: CardDesignState }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {ds.state.stripImageUrl ? (
          <div className="relative h-16 w-40 rounded-lg overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ds.state.stripImageUrl} alt="Strip preview" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-16 w-40 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ds.isUploading}
              onClick={() => ds.fileInputRef.current?.click()}
            >
              {ds.isUploading ? "Uploading..." : "Upload image"}
            </Button>
            {ds.state.stripImageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={ds.isUploading}
                onClick={ds.handleStripDelete}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">PNG, JPEG, or WebP. Max 5MB.</p>
        </div>
        <input
          ref={ds.fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={ds.handleStripUpload}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Fill</Label>
        <div className="flex gap-2">
          {FILL_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                ds.setPatternStyle(p.id)
                if (p.id !== "NONE") ds.setStripImageUrl(null)
              }}
              disabled={!!ds.state.stripImageUrl && p.id !== "NONE"}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors disabled:opacity-40 ${
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

      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          Pattern
        </Label>
        <div className="grid grid-cols-4 gap-2">
          {PATTERN_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                ds.setPatternStyle(p.id)
                ds.setStripImageUrl(null)
              }}
              disabled={!!ds.state.stripImageUrl}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors disabled:opacity-40 ${
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

function ProgressContent({ ds }: { ds: CardDesignState }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PROGRESS_STYLES.map((ps) => (
          <button
            key={ps.id}
            type="button"
            onClick={() => ds.setProgressStyle(ps.id)}
            className={`rounded-lg border-2 p-3 text-left transition-all ${
              ds.state.progressStyle === ps.id
                ? "border-foreground bg-foreground/[0.03] ring-1 ring-foreground/10"
                : "border-border hover:border-foreground/20"
            }`}
          >
            <div className="text-xs font-medium">{ps.name}</div>
            <div className="text-[11px] text-muted-foreground mt-1 font-mono truncate">{ps.preview}</div>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="adv-customProgressLabel" className="text-xs">Custom progress label</Label>
        <Input
          id="adv-customProgressLabel"
          value={ds.state.customProgressLabel}
          onChange={(e) => ds.setCustomProgressLabel(e.target.value.slice(0, 30))}
          placeholder="PROGRESS"
          maxLength={30}
          className="text-xs max-w-[240px]"
        />
      </div>
    </div>
  )
}

function TypographyContent({ ds }: { ds: CardDesignState }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs">Font Family</Label>
        <div className="flex gap-2">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => ds.setFontFamily(f.id)}
              className={`px-4 py-2 rounded-md border text-sm transition-colors ${
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
      <div className="space-y-2">
        <Label className="text-xs">Label Format</Label>
        <div className="flex gap-2">
          {LABEL_FORMATS.map((lf) => (
            <button
              key={lf.id}
              type="button"
              onClick={() => ds.setLabelFormat(lf.id)}
              className={`px-4 py-2 rounded-md border text-xs font-medium transition-colors ${
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

function BackOfPassContent({ ds }: { ds: CardDesignState }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="adv-businessHours" className="text-xs">Business Hours</Label>
        <Textarea
          id="adv-businessHours"
          value={ds.state.businessHours}
          onChange={(e) => ds.setBusinessHours(e.target.value)}
          placeholder={"Mon-Fri: 8am-10pm\nSat-Sun: 9am-11pm"}
          rows={3}
          className="text-xs"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="adv-mapAddress" className="text-xs">Address / Map Link</Label>
        <Input
          id="adv-mapAddress"
          value={ds.state.mapAddress}
          onChange={(e) => ds.setMapAddress(e.target.value)}
          placeholder="123 Main St, City, State"
          className="text-xs"
        />
      </div>
      <div className="space-y-3">
        <Label className="text-xs">Social Links</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={ds.state.socialLinks.instagram ?? ""}
            onChange={(e) => ds.setSocialLinks({ ...ds.state.socialLinks, instagram: e.target.value })}
            placeholder="Instagram URL"
            className="text-xs"
          />
          <Input
            value={ds.state.socialLinks.facebook ?? ""}
            onChange={(e) => ds.setSocialLinks({ ...ds.state.socialLinks, facebook: e.target.value })}
            placeholder="Facebook URL"
            className="text-xs"
          />
          <Input
            value={ds.state.socialLinks.tiktok ?? ""}
            onChange={(e) => ds.setSocialLinks({ ...ds.state.socialLinks, tiktok: e.target.value })}
            placeholder="TikTok URL"
            className="text-xs"
          />
          <Input
            value={ds.state.socialLinks.x ?? ""}
            onChange={(e) => ds.setSocialLinks({ ...ds.state.socialLinks, x: e.target.value })}
            placeholder="X (Twitter) URL"
            className="text-xs"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="adv-customMessage" className="text-xs">Custom Message</Label>
        <Textarea
          id="adv-customMessage"
          value={ds.state.customMessage}
          onChange={(e) => ds.setCustomMessage(e.target.value)}
          placeholder="Thank you for being a loyal customer!"
          rows={2}
          className="text-xs"
        />
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

type AdvancedSettingsAccordionProps = {
  ds: CardDesignState
}

export function AdvancedSettingsAccordion({ ds }: AdvancedSettingsAccordionProps) {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null)
  const showStripSection = ds.state.shape === "SHOWCASE" || ds.state.shape === "INFO_RICH"

  const visibleSections = SECTIONS.filter((s) => !s.stripOnly || showStripSection)
  const active = visibleSections.find((s) => s.id === activeSection)

  function renderContent(id: SectionId) {
    switch (id) {
      case "logo": return <LogoContent ds={ds} />
      case "shape": return <ShapeContent ds={ds} />
      case "colors": return <ColorsContent ds={ds} />
      case "strip": return <StripContent ds={ds} />
      case "progress": return <ProgressContent ds={ds} />
      case "typography": return <TypographyContent ds={ds} />
      case "back-of-pass": return <BackOfPassContent ds={ds} />
    }
  }

  // Expanded panel view
  if (active) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to settings"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          {(() => { const Icon = active.icon; return <Icon className="h-3.5 w-3.5 text-muted-foreground" /> })()}
          <h3 className="text-sm font-semibold">{active.label}</h3>
        </div>
        <div className="p-4">
          {renderContent(active.id)}
        </div>
      </div>
    )
  }

  // Card grid view
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {visibleSections.map((section) => {
        const Icon = section.icon
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className="group rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-foreground/20 hover:bg-foreground/[0.02]"
          >
            <Icon className="h-4 w-4 text-muted-foreground mb-2 group-hover:text-foreground transition-colors" />
            <div className="text-sm font-medium">{section.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{section.description}</div>
          </button>
        )
      })}
    </div>
  )
}

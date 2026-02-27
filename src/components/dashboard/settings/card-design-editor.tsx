"use client"

import { useState } from "react"
import {
  Loader2,
  AlertTriangle,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardPreview } from "./card-preview"
import { TemplateGallery } from "./template-gallery"
import { VisualEditor } from "./visual-editor"
import { AdvancedSettingsAccordion } from "./advanced-settings-accordion"
import { useCardDesignState } from "@/hooks/use-card-design-state"
import type { CardDesignInput } from "@/hooks/use-card-design-state"

// ─── Types ──────────────────────────────────────────────────

type Restaurant = {
  id: string
  name: string
  slug: string
  logo: string | null
  brandColor: string | null
  secondaryColor: string | null
}

type CardDesignEditorProps = {
  restaurant: Restaurant
  programId: string
  cardDesign: CardDesignInput
  walletPassCount: number
}

type EditorMode = "templates" | "customize"

// ─── Component ──────────────────────────────────────────────

export function CardDesignEditor({
  restaurant,
  programId,
  cardDesign,
  walletPassCount,
}: CardDesignEditorProps) {
  const ds = useCardDesignState(restaurant, programId, cardDesign)
  const [mode, setMode] = useState<EditorMode>(ds.state.templateId ? "customize" : "templates")
  const [showAdvanced, setShowAdvanced] = useState(false)

  function handleSelectTemplate(id: string) {
    ds.applyTemplate(id)
    setMode("customize")
  }

  function handleStartCustom() {
    setMode("customize")
  }

  return (
    <div className={`grid gap-6 ${mode === "templates" ? "lg:grid-cols-[1fr,320px]" : ""}`}>
      {/* Main content area */}
      <div className="space-y-5">
        {/* Mode tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("templates")}
            className={`flex-1 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              mode === "templates"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => setMode("customize")}
            className={`flex-1 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              mode === "customize"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Customize
          </button>
        </div>

        {/* Templates tab */}
        {mode === "templates" && (
          <TemplateGallery
            selectedTemplateId={ds.state.templateId}
            onSelectTemplate={handleSelectTemplate}
            onStartCustom={handleStartCustom}
          />
        )}

        {/* Customize tab */}
        {mode === "customize" && (
          <div className="space-y-5">
            {/* Visual editor */}
            <VisualEditor ds={ds} restaurantName={restaurant.name} />

            {/* Advanced settings toggle */}
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
                Advanced Settings
              </button>
              {showAdvanced && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AdvancedSettingsAccordion ds={ds} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          {walletPassCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Saving will update {walletPassCount} existing wallet pass{walletPassCount !== 1 ? "es" : ""}.
            </div>
          )}
          <Button
            type="button"
            onClick={() => ds.handleSave(walletPassCount)}
            disabled={ds.isPending}
            size="sm"
            className="ml-auto"
          >
            {ds.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Saving...
              </>
            ) : (
              "Save card design"
            )}
          </Button>
        </div>
      </div>

      {/* Live Preview Panel — only in Templates mode (Customize has its own preview via VisualEditor) */}
      {mode === "templates" && (
        <div className="hidden lg:block lg:sticky lg:top-4 space-y-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-xs font-semibold">Live Preview</h3>
            </div>
            <div className="p-4">
              <CardPreview
                restaurantName={restaurant.name}
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
        </div>
      )}
    </div>
  )
}

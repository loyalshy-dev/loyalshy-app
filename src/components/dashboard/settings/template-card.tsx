"use client"

import { Check } from "lucide-react"
import { CardPreview } from "./card-preview"
import type { CardTemplate } from "@/lib/wallet/card-templates"
import { templateStripToCss } from "@/lib/wallet/card-templates"

type TemplateCardProps = {
  template: CardTemplate
  isSelected: boolean
  onSelect: (id: string) => void
}

export function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${template.name} template`}
      className={`group relative rounded-xl border-2 overflow-hidden text-left transition-all ${
        isSelected
          ? "border-foreground ring-1 ring-foreground/10"
          : "border-border hover:border-foreground/20 hover:shadow-md"
      }`}
    >
      {/* Mini preview — scaled down */}
      <div className="relative h-[160px] overflow-hidden bg-muted">
        <div
          className="origin-top-left pointer-events-none"
          style={{
            transform: "scale(0.42)",
            transformOrigin: "top center",
            width: "238%",
            marginLeft: "-69%",
            paddingTop: "8px",
          }}
        >
          <CardPreview
            restaurantName="Your Restaurant"
            logoUrl={null}
            shape={template.design.shape}
            primaryColor={template.design.primaryColor}
            secondaryColor={template.design.secondaryColor}
            textColor={template.design.textColor}
            patternStyle={template.design.patternStyle}
            progressStyle={template.design.progressStyle}
            fontFamily={template.design.fontFamily}
            labelFormat={template.design.labelFormat}
            customProgressLabel={null}
            stripImageUrl={null}
            stripCss={templateStripToCss(template.stripDesign)}
            customMessage={null}
            hideTabSelector
          />
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 border-t border-border">
        <div className="text-xs font-semibold truncate">{template.name}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
          {template.description}
        </div>
      </div>

      {/* Selection checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-foreground flex items-center justify-center">
          <Check className="h-3 w-3 text-background" />
        </div>
      )}
    </button>
  )
}

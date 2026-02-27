"use client"

import { useState } from "react"
import { Paintbrush } from "lucide-react"
import { CARD_TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/wallet/card-templates"
import type { RestaurantCategory } from "@/lib/wallet/card-templates"
import { TemplateCard } from "./template-card"

type TemplateGalleryProps = {
  selectedTemplateId: string | null
  onSelectTemplate: (id: string) => void
  onStartCustom: () => void
}

export function TemplateGallery({
  selectedTemplateId,
  onSelectTemplate,
  onStartCustom,
}: TemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<RestaurantCategory | "all">("all")

  const filtered =
    activeCategory === "all"
      ? CARD_TEMPLATES
      : CARD_TEMPLATES.filter((t) => t.category === activeCategory)

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" role="radiogroup" aria-label="Template gallery">
        {/* Custom / Start from scratch card */}
        <button
          type="button"
          onClick={onStartCustom}
          role="radio"
          aria-checked={selectedTemplateId === null}
          aria-label="Start from scratch"
          className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
            selectedTemplateId === null
              ? "border-foreground ring-1 ring-foreground/10"
              : "border-border hover:border-foreground/20 hover:shadow-md"
          }`}
        >
          <div className="h-[160px] bg-muted flex flex-col items-center justify-center gap-2">
            <Paintbrush className="h-8 w-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Start from scratch</span>
          </div>
          <div className="px-3 py-2.5 border-t border-border">
            <div className="text-xs font-semibold">Custom</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Build your own design
            </div>
          </div>
        </button>

        {/* Template cards */}
        {filtered.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            onSelect={onSelectTemplate}
          />
        ))}
      </div>
    </div>
  )
}

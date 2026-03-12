"use client"

import {

  Palette,
  BarChart3,
  ImagePlus,
  CircleUserRound,
  FileText,
  SlidersHorizontal,
} from "lucide-react"
import type { StudioTool } from "@/types/editor"
import type { CardType } from "@/lib/wallet/card-design"

type ToolSelectorProps = {
  activeTool: StudioTool | null
  onToolSelect: (tool: StudioTool | null) => void
  cardType?: CardType
}

type ToolItem = {
  id: StudioTool
  label: string
  icon: React.ReactNode
}

const TOOLS: ToolItem[] = [
  { id: "program", label: "Program", icon: <SlidersHorizontal size={18} /> },
  { id: "colors", label: "Colors", icon: <Palette size={18} /> },
  { id: "progress", label: "Progress", icon: <BarChart3 size={18} /> },
  { id: "strip", label: "Strip", icon: <ImagePlus size={18} /> },
  { id: "logo", label: "Logo", icon: <CircleUserRound size={18} /> },
  { id: "details", label: "Details", icon: <FileText size={18} /> },
]

export function ToolSelector({ activeTool, onToolSelect, cardType }: ToolSelectorProps) {
  // Hide stamp-specific "Progress" panel for non-STAMP card types
  const filteredTools = cardType && cardType !== "STAMP"
    ? TOOLS.filter((t) => t.id !== "progress")
    : TOOLS

  return (
    <div
      style={{
        width: 56,
        borderRight: "1px solid var(--border)",
        backgroundColor: "var(--background)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0",
        gap: 2,
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      {filteredTools.map((tool) => {
        const isActive = activeTool === tool.id
        return (
          <button
            key={tool.id}
            onClick={() => onToolSelect(isActive ? null : tool.id)}
            style={{
              width: 44,
              height: 44,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              borderRadius: 8,
              border: "none",
              background: isActive ? "var(--accent)" : "none",
              color: isActive ? "var(--accent-foreground)" : "var(--muted-foreground)",
              cursor: "pointer",
              padding: 0,
              transition: "background-color 0.1s",
            }}
            aria-label={tool.label}
            title={tool.label}
          >
            {tool.icon}
            <span style={{ fontSize: 8, lineHeight: 1, fontWeight: 500 }}>
              {tool.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

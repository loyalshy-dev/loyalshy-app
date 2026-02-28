"use client"

import {
  LayoutGrid,
  Palette,
  Columns3,
  BarChart3,
  ImagePlus,
  CircleUserRound,
  Tag,
  FileText,
} from "lucide-react"
import type { StudioTool } from "@/types/editor"

type ToolSelectorProps = {
  activeTool: StudioTool | null
  onToolSelect: (tool: StudioTool | null) => void
}

type ToolItem = {
  id: StudioTool
  label: string
  icon: React.ReactNode
}

const TOOLS: ToolItem[] = [
  { id: "templates", label: "Templates", icon: <LayoutGrid size={18} /> },
  { id: "colors", label: "Colors", icon: <Palette size={18} /> },
  { id: "shape", label: "Shape", icon: <Columns3 size={18} /> },
  { id: "progress", label: "Progress", icon: <BarChart3 size={18} /> },
  { id: "strip", label: "Strip", icon: <ImagePlus size={18} /> },
  { id: "logo", label: "Logo", icon: <CircleUserRound size={18} /> },
  { id: "labels", label: "Labels", icon: <Tag size={18} /> },
  { id: "details", label: "Details", icon: <FileText size={18} /> },
]

export function ToolSelector({ activeTool, onToolSelect }: ToolSelectorProps) {
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
      {TOOLS.map((tool) => {
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

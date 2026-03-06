"use client"

import { X } from "lucide-react"
import type { StudioTool } from "@/types/editor"

type PanelShellProps = {
  title: string
  activeTool: StudioTool
  onClose: () => void
  children: React.ReactNode
}

const PANEL_TITLES: Record<StudioTool, string> = {
  program: "Program Settings",
  templates: "Templates",
  colors: "Colors & Themes",
  progress: "Progress Style",
  strip: "Strip Image",
  logo: "Logo",
  labels: "Label Format",
  details: "Back-of-Pass Details",
}

export function PanelShell({ activeTool, onClose, children }: PanelShellProps) {
  return (
    <div
      style={{
        width: 300,
        borderLeft: "1px solid var(--border)",
        backgroundColor: "var(--background)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {PANEL_TITLES[activeTool] ?? "Properties"}
        </span>
        <button
          onClick={onClose}
          style={{
            padding: 4,
            borderRadius: 4,
            border: "none",
            background: "none",
            color: "var(--muted-foreground)",
            cursor: "pointer",
          }}
          aria-label="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {children}
      </div>
    </div>
  )
}

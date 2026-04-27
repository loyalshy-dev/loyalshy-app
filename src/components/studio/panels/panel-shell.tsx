"use client"

import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import type { StudioTool } from "@/types/editor"

type PanelShellProps = {
  title: string
  activeTool: StudioTool
  onClose: () => void
  children: React.ReactNode
}

export function PanelShell({ activeTool, onClose, children }: PanelShellProps) {
  const t = useTranslations("studio.panels")

  const PANEL_TITLES: Record<StudioTool, string> = {
    program: t("programSettings"),
    colors: t("colors"),
    fields: t("fields"),
    progress: t("progressStyle"),
    strip: t("stripImage"),
    logo: t("logo"),
    prize: t("prizeReveal"),
    notifications: t("notifications"),
    details: t("backOfPass"),
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
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
          {PANEL_TITLES[activeTool] ?? t("properties")}
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
          aria-label={t("closePanel")}
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

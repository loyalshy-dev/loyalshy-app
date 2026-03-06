"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Undo2, Redo2, Save, Smartphone, Tablet } from "lucide-react"
import type { PreviewFormat } from "@/types/editor"

type StudioToolbarProps = {
  programName: string
  programId: string
  isDirty: boolean
  isSaving: boolean
  canUndo: boolean
  canRedo: boolean
  previewFormat: PreviewFormat
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
  onPreviewFormatChange: (format: PreviewFormat) => void
  /** When true, hide back button (tab nav handles navigation) */
  embedded?: boolean
}

export function StudioToolbar({
  programName,
  programId,
  isDirty,
  isSaving,
  canUndo,
  canRedo,
  previewFormat,
  onSave,
  onUndo,
  onRedo,
  onPreviewFormatChange,
  embedded = false,
}: StudioToolbarProps) {
  const router = useRouter()

  return (
    <div
      style={{
        height: 48,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 8,
        backgroundColor: "var(--background)",
        flexShrink: 0,
      }}
    >
      {/* Back button — hidden when embedded in dashboard tab */}
      {!embedded && (
        <button
          onClick={() => router.push(`/dashboard/programs/${programId}/design`)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 6,
            border: "none",
            background: "none",
            color: "var(--muted-foreground)",
            cursor: "pointer",
            fontSize: 13,
          }}
          aria-label="Back to design"
        >
          <ArrowLeft size={16} />
          <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {programName}
          </span>
        </button>
      )}

      <div style={{ flex: 1 }} />

      {/* Undo / Redo */}
      <div style={{ display: "flex", gap: 2 }}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            padding: 6,
            borderRadius: 6,
            border: "none",
            background: "none",
            color: canUndo ? "var(--foreground)" : "var(--muted-foreground)",
            cursor: canUndo ? "pointer" : "default",
            opacity: canUndo ? 1 : 0.4,
          }}
          aria-label="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          style={{
            padding: 6,
            borderRadius: 6,
            border: "none",
            background: "none",
            color: canRedo ? "var(--foreground)" : "var(--muted-foreground)",
            cursor: canRedo ? "pointer" : "default",
            opacity: canRedo ? 1 : 0.4,
          }}
          aria-label="Redo"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, backgroundColor: "var(--border)" }} />

      {/* Format selector — Apple / Google */}
      <div style={{ display: "flex", gap: 2, padding: "2px", borderRadius: 8, backgroundColor: "var(--muted)" }}>
        {(["apple", "google"] as PreviewFormat[]).map((fmt) => (
          <button
            key={fmt}
            onClick={() => onPreviewFormatChange(fmt)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              background: previewFormat === fmt ? "var(--background)" : "none",
              color: previewFormat === fmt ? "var(--foreground)" : "var(--muted-foreground)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: previewFormat === fmt ? 600 : 400,
              boxShadow: previewFormat === fmt ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {fmt === "apple" && <Smartphone size={13} />}
            {fmt === "google" && <Tablet size={13} />}
            {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, backgroundColor: "var(--border)" }} />

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={isSaving || !isDirty}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 16px",
          borderRadius: 6,
          border: "none",
          backgroundColor: isDirty ? "var(--primary)" : "var(--muted)",
          color: isDirty ? "var(--primary-foreground)" : "var(--muted-foreground)",
          cursor: isDirty && !isSaving ? "pointer" : "default",
          fontSize: 13,
          fontWeight: 500,
          opacity: isSaving ? 0.7 : 1,
        }}
        aria-label="Save design"
      >
        <Save size={14} />
        {isSaving ? "Saving..." : isDirty ? "Save" : "Saved"}
      </button>
    </div>
  )
}

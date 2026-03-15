"use client"

import { useState, useEffect } from "react"
import { getOrgMediaLibrary, type MediaLibraryItem } from "@/server/org-settings-actions"

type Props = {
  organizationId: string
  /** Filter items by type */
  type: "logo" | "strip"
  /** Currently active URL (shown as selected) */
  currentUrl: string | null
  /** Called when user picks an image */
  onSelect: (url: string) => void
}

export function MediaGallery({ organizationId, type, currentUrl, onSelect }: Props) {
  const [items, setItems] = useState<MediaLibraryItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getOrgMediaLibrary(organizationId).then((result) => {
      if (cancelled) return
      setItems(result.items.filter((i) => i.type === type))
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [organizationId, type])

  if (loading) {
    return (
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "8px 0" }}>
        Loading...
      </div>
    )
  }

  if (!items || items.length === 0) return null

  const isStrip = type === "strip"

  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        Your uploads
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isStrip ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
          gap: 6,
        }}
      >
        {items.map((item) => {
          const isActive = currentUrl === item.url
          return (
            <button
              key={item.url}
              onClick={() => onSelect(item.url)}
              title={item.programName ?? "Organization"}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 0,
                border: `2px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                borderRadius: 10,
                backgroundColor: "transparent",
                cursor: "pointer",
                overflow: "hidden",
                opacity: isActive ? 1 : 0.85,
                transition: "border-color 0.12s ease, opacity 0.12s ease",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.programName ?? "Logo"}
                style={{
                  width: "100%",
                  aspectRatio: isStrip ? "1125 / 432" : "1",
                  objectFit: "cover",
                  display: "block",
                  backgroundColor: "var(--muted)",
                }}
              />
              {item.programName && (
                <span
                  style={{
                    fontSize: 8,
                    color: "var(--muted-foreground)",
                    padding: "2px 4px",
                    textAlign: "center",
                    width: "100%",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.programName}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

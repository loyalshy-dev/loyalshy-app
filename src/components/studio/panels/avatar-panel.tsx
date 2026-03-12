"use client"

import { useState, useRef } from "react"
import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { uploadHolderPhoto, deleteHolderPhoto } from "@/server/org-settings-actions"

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--muted-foreground)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginBottom: 8,
        marginTop: 16,
      }}
    >
      {children}
    </div>
  )
}

type Props = {
  store: CardDesignStoreApi
  programId: string
}

export function AvatarPanel({ store, programId }: Props) {
  const showHolderPhoto = useStore(store, (s) => s.programConfig.showHolderPhoto)
  const holderPhotoPosition = useStore(store, (s) => s.programConfig.holderPhotoPosition)
  const holderPhotoUrl = useStore(store, (s) => s.wallet.holderPhotoUrl)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      {/* Enable toggle */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: 14,
          border: `1.5px solid ${showHolderPhoto ? "var(--primary)" : "var(--border)"}`,
          backgroundColor: showHolderPhoto ? "var(--accent)" : "transparent",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
            Show holder photo
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            Overlay a circular avatar on the strip
          </div>
        </div>
        <div
          role="switch"
          aria-checked={showHolderPhoto}
          style={{
            width: 34,
            height: 20,
            borderRadius: 9999,
            backgroundColor: showHolderPhoto ? "var(--primary)" : "var(--muted)",
            position: "relative",
            cursor: "pointer",
            transition: "background-color 0.15s ease",
            flexShrink: 0,
          }}
          onClick={() => store.getState().setConfigField("showHolderPhoto", !showHolderPhoto)}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              backgroundColor: "#fff",
              position: "absolute",
              top: 3,
              left: showHolderPhoto ? 17 : 3,
              transition: "left 0.15s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      </label>

      {showHolderPhoto && (
        <>
          {/* Photo upload */}
          <SectionHeader>Photo</SectionHeader>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setIsUploading(true)
              try {
                const fd = new FormData()
                fd.append("templateId", programId)
                fd.append("file", file)
                const result = await uploadHolderPhoto(fd)
                if (result.url) {
                  store.getState().setWalletField("holderPhotoUrl", result.url)
                }
              } finally {
                setIsUploading(false)
                if (fileInputRef.current) fileInputRef.current.value = ""
              }
            }}
          />

          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 10,
              borderRadius: 14,
              border: "1.5px dashed var(--border)",
              cursor: isUploading ? "wait" : "pointer",
              transition: "all 0.15s ease",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 9999,
                backgroundColor: "var(--muted)",
                border: "2px solid var(--border)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {holderPhotoUrl ? (
                <img src={holderPhotoUrl} alt="Holder" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                {isUploading ? "Uploading..." : holderPhotoUrl ? "Change photo" : "Upload photo"}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
                {holderPhotoUrl ? "Click to replace" : "PNG, JPEG, or WebP · 2MB max"}
              </div>
            </div>
            {holderPhotoUrl && (
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  setIsUploading(true)
                  try {
                    await deleteHolderPhoto(programId)
                    store.getState().setWalletField("holderPhotoUrl", null)
                  } finally {
                    setIsUploading(false)
                  }
                }}
                style={{
                  padding: 4,
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--muted-foreground)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                aria-label="Remove holder photo"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            )}
          </div>

          {/* Position picker */}
          <SectionHeader>Position</SectionHeader>
          <div style={{ display: "flex", gap: 4 }}>
            {(["left", "center", "right"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => store.getState().setConfigField("holderPhotoPosition", pos)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 10,
                  border: `1.5px solid ${holderPhotoPosition === pos ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: holderPhotoPosition === pos ? "var(--accent)" : "transparent",
                  color: holderPhotoPosition === pos ? "var(--foreground)" : "var(--muted-foreground)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: holderPhotoPosition === pos ? 600 : 400,
                  textTransform: "capitalize",
                  transition: "all 0.15s ease",
                }}
              >
                {pos}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

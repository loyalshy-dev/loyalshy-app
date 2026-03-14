"use client"

import { useStore } from "zustand"
import { useTranslations } from "next-intl"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"

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

export function AvatarPanel({ store }: Props) {
  const t = useTranslations("studio.avatar")
  const showHolderPhoto = useStore(store, (s) => s.programConfig.showHolderPhoto)
  const holderPhotoPosition = useStore(store, (s) => s.programConfig.holderPhotoPosition)

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
            {t("showHolderPhoto")}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            {t("overlayAvatar")}
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
          {/* Info note */}
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              borderRadius: 10,
              backgroundColor: "var(--muted)",
              fontSize: 11,
              color: "var(--muted-foreground)",
              lineHeight: 1.4,
            }}
          >
            The holder photo is set per contact when a pass is issued. You can upload it from the passes list or contact detail.
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

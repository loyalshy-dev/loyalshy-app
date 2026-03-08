"use client"

import { useState } from "react"
import { useStore } from "zustand"
import { MapPin } from "lucide-react"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"

type Props = {
  store: CardDesignStoreApi
  organizationName: string
  organizationLogo: string | null
}

export function NotificationsPanel({ store, organizationName, organizationLogo }: Props) {
  const mapAddress = useStore(store, (s) => s.wallet.mapAddress)
  const mapLatitude = useStore(store, (s) => s.wallet.mapLatitude)
  const mapLongitude = useStore(store, (s) => s.wallet.mapLongitude)
  const locationMessage = useStore(store, (s) => s.wallet.locationMessage)
  const [previewPlatform, setPreviewPlatform] = useState<"apple" | "google">("apple")

  const set = store.getState().setWalletField

  const hasCoords = mapLatitude != null && mapLongitude != null
  const displayMessage = locationMessage || (previewPlatform === "apple"
    ? `You're near ${organizationName}`
    : `You're near ${organizationName}! Show your pass.`)

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
        When a customer is near your location, their wallet pass appears on the lock screen automatically.
      </div>

      {/* Address input */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>Business address</div>
        <input
          type="text"
          value={mapAddress}
          onChange={(e) => set("mapAddress", e.target.value)}
          placeholder="123 Main St, City, State"
          maxLength={500}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            backgroundColor: "var(--background)",
            fontSize: 12,
            color: "var(--foreground)",
            outline: "none",
          }}
        />
      </div>

      {/* Status indicator */}
      {hasCoords ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 10px",
            borderRadius: 6,
            backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
            marginBottom: 12,
          }}
        >
          <MapPin size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--foreground)", lineHeight: 1.4 }}>
            <div style={{ fontWeight: 600 }}>Location active</div>
            <div style={{ color: "var(--muted-foreground)", fontFamily: "monospace", fontSize: 10 }}>
              {mapLatitude.toFixed(5)}, {mapLongitude.toFixed(5)}
            </div>
          </div>
        </div>
      ) : mapAddress ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 10px",
            borderRadius: 6,
            backgroundColor: "color-mix(in srgb, var(--muted-foreground) 8%, transparent)",
            border: "1px solid var(--border)",
            marginBottom: 12,
          }}
        >
          <MapPin size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Coordinates will be resolved on save
          </div>
        </div>
      ) : null}

      {/* Notification message */}
      {mapAddress && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>Notification message</div>
          <input
            type="text"
            value={locationMessage}
            onChange={(e) => set("locationMessage", e.target.value)}
            placeholder="You're nearby! Show your pass."
            maxLength={200}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              backgroundColor: "var(--background)",
              fontSize: 12,
              color: "var(--foreground)",
              outline: "none",
            }}
          />
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
            Shown on the lock screen when near your location. Leave empty for default.
          </div>
        </div>
      )}

      {/* Notification preview */}
      {mapAddress && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>Preview</div>

          {/* Platform toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10, backgroundColor: "var(--muted)", borderRadius: 6, padding: 3 }}>
            {(["apple", "google"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreviewPlatform(p)}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 11,
                  fontWeight: previewPlatform === p ? 600 : 400,
                  backgroundColor: previewPlatform === p ? "var(--background)" : "transparent",
                  color: previewPlatform === p ? "var(--foreground)" : "var(--muted-foreground)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: previewPlatform === p ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {p === "apple" ? "iOS" : "Android"}
              </button>
            ))}
          </div>

          {previewPlatform === "apple" ? (
            <AppleNotificationPreview
              organizationName={organizationName}
              organizationLogo={organizationLogo}
              message={displayMessage}
            />
          ) : (
            <GoogleNotificationPreview
              organizationName={organizationName}
              organizationLogo={organizationLogo}
              message={displayMessage}
            />
          )}
        </div>
      )}

      {/* How it works */}
      {!mapAddress && (
        <div
          style={{
            fontSize: 11,
            color: "var(--muted-foreground)",
            lineHeight: 1.5,
            padding: "10px 12px",
            borderRadius: 6,
            backgroundColor: "var(--muted)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}>How it works</div>
          <div style={{ marginBottom: 2 }}><strong>Apple:</strong> Pass appears on lock screen within ~100m</div>
          <div><strong>Google:</strong> Notification when near your location</div>
        </div>
      )}
    </div>
  )
}

// ─── Apple iOS Lock Screen Notification ─────────────────────

function AppleNotificationPreview({
  organizationName,
  organizationLogo,
  message,
}: {
  organizationName: string
  organizationLogo: string | null
  message: string
}) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#f2f2f7",
        fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
      }}
    >
      {/* Lock screen time */}
      <div style={{ textAlign: "center", padding: "14px 0 10px" }}>
        <div style={{ fontSize: 42, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em", lineHeight: 1 }}>
          {timeStr}
        </div>
        <div style={{ fontSize: 13, color: "#636366", marginTop: 2, fontWeight: 500 }}>
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Notification banner */}
      <div style={{ padding: "0 10px 10px" }}>
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 14,
            padding: "10px 12px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          {/* App icon + title + time */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {organizationLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organizationLogo}
                alt=""
                style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  background: "linear-gradient(135deg, #007AFF, #5856D6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>W</span>
              </div>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1c1c1e", flex: 1 }}>
              Wallet
            </span>
            <span style={{ fontSize: 11, color: "#8e8e93" }}>now</span>
          </div>

          {/* Notification body */}
          <div style={{ fontSize: 13, color: "#1c1c1e", lineHeight: 1.35 }}>
            <span style={{ fontWeight: 600 }}>{organizationName}</span>
            <span style={{ color: "#3a3a3c" }}> — {message}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Google Android Notification ────────────────────────────

function GoogleNotificationPreview({
  organizationName,
  organizationLogo,
  message,
}: {
  organizationName: string
  organizationLogo: string | null
  message: string
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "#1a1a2e",
        fontFamily: "Roboto, 'Google Sans', system-ui, sans-serif",
        padding: "16px 14px 14px",
      }}
    >
      {/* Status bar hint */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" }} />
      </div>

      {/* Notification card */}
      <div
        style={{
          backgroundColor: "#2d2d3f",
          borderRadius: 16,
          padding: "12px 14px",
        }}
      >
        {/* Header: icon + app name + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {organizationLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organizationLogo}
              alt=""
              style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#4285F4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 8, fontWeight: 700, color: "#fff" }}>G</span>
            </div>
          )}
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", flex: 1 }}>
            Google Wallet
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>now</span>
        </div>

        {/* Title */}
        <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 2 }}>
          {organizationName}
        </div>

        {/* Body */}
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.35 }}>
          {message}
        </div>
      </div>
    </div>
  )
}

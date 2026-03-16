"use client"

import { useState, useCallback } from "react"
import { useStore } from "zustand"
import { useTranslations } from "next-intl"
import { MapPin } from "lucide-react"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import { AddressAutocomplete } from "@/components/studio/address-autocomplete"

type Props = {
  store: CardDesignStoreApi
  organizationName: string
  organizationLogo: string | null
}

export function NotificationsPanel({ store, organizationName, organizationLogo }: Props) {
  const t = useTranslations("studio.notifications")
  const mapAddress = useStore(store, (s) => s.wallet.mapAddress)
  const mapLatitude = useStore(store, (s) => s.wallet.mapLatitude)
  const mapLongitude = useStore(store, (s) => s.wallet.mapLongitude)
  const locationMessage = useStore(store, (s) => s.wallet.locationMessage)
  const logoGoogleUrl = useStore(store, (s) => s.wallet.logoGoogleUrl)
  const logoAppleUrl = useStore(store, (s) => s.wallet.logoAppleUrl)
  const primaryColor = useStore(store, (s) => s.wallet.primaryColor)
  const stripImageUrl = useStore(store, (s) => s.wallet.stripImageUrl)
  const generatedStripApple = useStore(store, (s) => s.wallet.generatedStripApple)
  const [previewPlatform, setPreviewPlatform] = useState<"apple" | "google">("apple")

  const set = store.getState().setWalletField

  // Use the wallet logo URLs (which reflect what actually appears on the pass)
  const effectiveLogo = logoGoogleUrl ?? logoAppleUrl ?? organizationLogo
  const effectiveStrip = stripImageUrl ?? generatedStripApple

  const handleAddressChange = useCallback(
    (address: string, lat: number | null, lng: number | null) => {
      set("mapAddress", address)
      set("mapLatitude", lat)
      set("mapLongitude", lng)
    },
    [set]
  )

  const hasCoords = mapLatitude != null && mapLongitude != null
  const displayMessage = locationMessage || (previewPlatform === "apple"
    ? `You're near ${organizationName}`
    : `You're near ${organizationName}! Show your pass.`)

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
        {t("description")}
      </div>

      {/* Address input with autocomplete */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>{t("businessAddress")}</div>
        <AddressAutocomplete
          value={mapAddress}
          onChange={handleAddressChange}
          placeholder={t("addressPlaceholder")}
          maxLength={500}
          labels={{
            searching: t("searching"),
            noResults: t("noResults"),
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
            borderRadius: 12,
            backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
            marginBottom: 12,
          }}
        >
          <MapPin size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--foreground)", lineHeight: 1.4 }}>
            <div style={{ fontWeight: 600 }}>{t("locationActive")}</div>
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
            borderRadius: 12,
            backgroundColor: "color-mix(in srgb, var(--muted-foreground) 8%, transparent)",
            border: "1px solid var(--border)",
            marginBottom: 12,
          }}
        >
          <MapPin size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {t("coordinatesResolved")}
          </div>
        </div>
      ) : null}

      {/* Notification message */}
      {mapAddress && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>{t("notificationMessage")}</div>
          <input
            type="text"
            value={locationMessage}
            onChange={(e) => set("locationMessage", e.target.value)}
            placeholder={t("messagePlaceholder")}
            maxLength={200}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              backgroundColor: "var(--background)",
              fontSize: 12,
              color: "var(--foreground)",
              outline: "none",
            }}
          />
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
            {t("messageHint")}
          </div>
        </div>
      )}

      {/* Notification preview */}
      {mapAddress && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>{t("preview")}</div>

          {/* Platform toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10, backgroundColor: "var(--muted)", borderRadius: 9999, padding: 3 }}>
            {(["apple", "google"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreviewPlatform(p)}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  borderRadius: 9999,
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
                {p === "apple" ? t("ios") : t("android")}
              </button>
            ))}
          </div>

          {previewPlatform === "apple" ? (
            <AppleNotificationPreview
              organizationName={organizationName}
              organizationLogo={effectiveLogo}
              message={displayMessage}
              cardColor={primaryColor}
              stripImage={effectiveStrip}
            />
          ) : (
            <GoogleNotificationPreview
              organizationName={organizationName}
              organizationLogo={effectiveLogo}
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
            borderRadius: 12,
            backgroundColor: "var(--muted)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}>{t("howItWorks")}</div>
          <div style={{ marginBottom: 2 }}><strong>{t("apple")}</strong> Pass appears on lock screen within ~100m</div>
          <div><strong>{t("google")}</strong> Notification when near your location</div>
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
  cardColor,
  stripImage,
}: {
  organizationName: string
  organizationLogo: string | null
  message: string
  cardColor: string
  stripImage: string | null
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "rgba(40, 40, 40, 0.85)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif",
        padding: "12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Large app icon — rounded square like real iOS */}
      {organizationLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={organizationLogo}
          alt=""
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "linear-gradient(135deg, #007AFF, #5856D6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>W</span>
        </div>
      )}

      {/* Title + message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.25,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {organizationName}
        </div>
        <div
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.25,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {message}
        </div>
      </div>

      {/* Mini card thumbnail on the right */}
      <div
        style={{
          width: 48,
          height: 56,
          borderRadius: 6,
          overflow: "hidden",
          flexShrink: 0,
          backgroundColor: cardColor,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Mini strip area */}
        {stripImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stripImage}
            alt=""
            style={{
              width: "100%",
              height: 24,
              objectFit: "cover",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: 24, backgroundColor: "rgba(0,0,0,0.15)" }} />
        )}
        {/* Mini logo on the card */}
        {organizationLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={organizationLogo}
            alt=""
            style={{
              width: 14,
              height: 14,
              borderRadius: 2,
              objectFit: "cover",
              position: "absolute",
              top: 3,
              left: 3,
            }}
          />
        )}
        {/* Bottom area hint */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 16, height: 16, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.12)" }} />
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
  const t = useTranslations("studio.notifications")
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
            {t("googleWallet")}
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

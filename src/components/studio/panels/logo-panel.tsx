"use client"

import { useState, useRef } from "react"
import { useStore } from "zustand"
import { ChevronDown, RotateCcw } from "lucide-react"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import {
  uploadOrganizationLogo,
  deleteOrganizationLogo,
  uploadPlatformLogo,
  resetPlatformLogo,
} from "@/server/org-settings-actions"

type Props = {
  store: CardDesignStoreApi
  organizationId: string
  organizationName: string
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  )
}

function Placeholder({ initial, fontSize }: { initial: string; fontSize: number }) {
  return (
    <span
      style={{
        fontSize,
        fontWeight: 700,
        color: "var(--muted-foreground)",
        lineHeight: 1,
      }}
    >
      {initial}
    </span>
  )
}

export function LogoPanel({ store, organizationId, organizationName }: Props) {
  const logoAppleUrl = useStore(store, (s) => s.wallet.logoAppleUrl)
  const logoGoogleUrl = useStore(store, (s) => s.wallet.logoGoogleUrl)
  const logoAppleZoom = useStore(store, (s) => s.wallet.logoAppleZoom)
  const logoGoogleZoom = useStore(store, (s) => s.wallet.logoGoogleZoom)

  const [uploading, setUploading] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState<"apple" | "google" | null>(null)
  const [overridePlatformUploading, setOverridePlatformUploading] = useState<"apple" | "google" | null>(null)

  const mainInputRef = useRef<HTMLInputElement>(null)
  const overrideInputRef = useRef<HTMLInputElement>(null)

  const initial = organizationName.charAt(0).toUpperCase()
  const hasLogo = !!(logoAppleUrl || logoGoogleUrl)

  // ─── Main upload (auto-generates both platforms) ────────

  async function handleMainUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("organizationId", organizationId)
      formData.set("file", file)
      const result = await uploadOrganizationLogo(formData)
      if ("appleUrl" in result && result.appleUrl && "googleUrl" in result && result.googleUrl) {
        store.getState().setWalletField("logoAppleUrl", result.appleUrl)
        store.getState().setWalletField("logoGoogleUrl", result.googleUrl)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleMainDelete() {
    await deleteOrganizationLogo(organizationId)
    store.getState().setWalletField("logoAppleUrl", null)
    store.getState().setWalletField("logoGoogleUrl", null)
  }

  // ─── Platform override ──────────────────────────────────

  async function handleOverrideUpload(platform: "apple" | "google", file: File) {
    setOverridePlatformUploading(platform)
    try {
      const formData = new FormData()
      formData.set("organizationId", organizationId)
      formData.set("platform", platform)
      formData.set("file", file)
      const result = await uploadPlatformLogo(formData)
      if ("url" in result && result.url) {
        const field = platform === "apple" ? "logoAppleUrl" : "logoGoogleUrl"
        store.getState().setWalletField(field, result.url)
      }
    } finally {
      setOverridePlatformUploading(null)
    }
  }

  async function handleReset(platform: "apple" | "google") {
    setOverridePlatformUploading(platform)
    try {
      const result = await resetPlatformLogo(organizationId, platform)
      if ("url" in result && result.url) {
        const field = platform === "apple" ? "logoAppleUrl" : "logoGoogleUrl"
        store.getState().setWalletField(field, result.url)
      }
    } finally {
      setOverridePlatformUploading(null)
    }
  }

  return (
    <div>
      {/* ─── Main upload ─────────────────────────────────── */}
      <SectionHeader>Organization Logo</SectionHeader>

      <input
        ref={mainInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          await handleMainUpload(file)
          if (mainInputRef.current) mainInputRef.current.value = ""
        }}
      />

      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => mainInputRef.current?.click()}
          disabled={uploading}
          style={{
            flex: 1,
            padding: "7px 14px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            backgroundColor: "var(--muted)",
            cursor: uploading ? "wait" : "pointer",
            fontSize: 12,
            color: "var(--foreground)",
          }}
        >
          {uploading ? "Processing..." : hasLogo ? "Replace Logo" : "Upload Logo"}
        </button>
        {hasLogo && (
          <button
            onClick={handleMainDelete}
            style={{
              padding: "7px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: 11,
              color: "var(--destructive)",
            }}
          >
            Remove
          </button>
        )}
      </div>

      <div
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          backgroundColor: "var(--muted)",
          marginTop: 8,
          fontSize: 11,
          color: "var(--muted-foreground)",
        }}
      >
        Upload once — we&apos;ll auto-optimize for Apple and Google Wallet.
        PNG, JPEG, WebP, or SVG. Max 2MB.
      </div>

      {/* ─── Platform previews + zoom ────────────────────── */}
      {hasLogo && (
        <>
          <SectionHeader>Preview</SectionHeader>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              alignItems: "flex-end",
            }}
          >
            {/* Apple preview */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 160,
                  height: 50,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "var(--muted)",
                }}
              >
                {logoAppleUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoAppleUrl}
                    alt={`${organizationName} — Apple`}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      transform: logoAppleZoom !== 1 ? `scale(${logoAppleZoom})` : undefined,
                    }}
                  />
                ) : (
                  <Placeholder initial={initial} fontSize={20} />
                )}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
                Apple Wallet
              </div>
            </div>

            {/* Google preview */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "var(--muted)",
                }}
              >
                {logoGoogleUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoGoogleUrl}
                    alt={`${organizationName} — Google`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: logoGoogleZoom !== 1 ? `scale(${logoGoogleZoom})` : undefined,
                    }}
                  />
                ) : (
                  <Placeholder initial={initial} fontSize={24} />
                )}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
                Google Wallet
              </div>
            </div>
          </div>

          {/* Zoom sliders */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {logoAppleUrl && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--foreground)" }}>Apple zoom</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                    {logoAppleZoom.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={300}
                  step={5}
                  value={Math.round(logoAppleZoom * 100)}
                  onChange={(e) => store.getState().setWalletField("logoAppleZoom", Number(e.target.value) / 100)}
                  style={{ width: "100%", accentColor: "var(--primary)" }}
                />
              </div>
            )}
            {logoGoogleUrl && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--foreground)" }}>Google zoom</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                    {logoGoogleZoom.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={300}
                  step={5}
                  value={Math.round(logoGoogleZoom * 100)}
                  onChange={(e) => store.getState().setWalletField("logoGoogleZoom", Number(e.target.value) / 100)}
                  style={{ width: "100%", accentColor: "var(--primary)" }}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Platform override (collapsed) ───────────────── */}
      {hasLogo && (
        <>
          <SectionHeader>Advanced</SectionHeader>

          <input
            ref={overrideInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file || !overrideOpen) return
              await handleOverrideUpload(overrideOpen, file)
              if (overrideInputRef.current) overrideInputRef.current.value = ""
            }}
          />

          {(["apple", "google"] as const).map((platform) => {
            const isOpen = overrideOpen === platform
            const isUploading = overridePlatformUploading === platform
            const label = platform === "apple" ? "Apple Wallet" : "Google Wallet"

            return (
              <div key={platform} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => setOverrideOpen(isOpen ? null : platform)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: isOpen ? "var(--accent)" : "transparent",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "var(--foreground)",
                    gap: 6,
                  }}
                >
                  <ChevronDown
                    size={14}
                    style={{
                      transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 150ms",
                      color: "var(--muted-foreground)",
                    }}
                  />
                  Use different image for {label}
                </button>

                {isOpen && (
                  <div style={{ padding: "8px 8px 8px 28px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => overrideInputRef.current?.click()}
                        disabled={isUploading}
                        style={{
                          flex: 1,
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--muted)",
                          cursor: isUploading ? "wait" : "pointer",
                          fontSize: 11,
                          color: "var(--foreground)",
                        }}
                      >
                        {isUploading ? "Processing..." : "Upload Override"}
                      </button>
                      <button
                        onClick={() => handleReset(platform)}
                        disabled={isUploading}
                        aria-label={`Reset ${label} logo to auto-generated`}
                        title="Regenerate from source"
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          backgroundColor: "transparent",
                          cursor: isUploading ? "wait" : "pointer",
                          color: "var(--muted-foreground)",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--muted-foreground)",
                        marginTop: 4,
                      }}
                    >
                      {platform === "apple"
                        ? "Wide rectangle (320 \u00d7 100px). Transparent PNG recommended."
                        : "Square (660px). Keep artwork centered with margin for circle crop."}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ─── Shared info ─────────────────────────────────── */}
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          backgroundColor: "var(--muted)",
          marginTop: 16,
        }}
      >
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Your logo is shared across all programs.
        </div>
      </div>
    </div>
  )
}

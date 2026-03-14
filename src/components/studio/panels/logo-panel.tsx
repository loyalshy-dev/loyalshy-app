"use client"

import { useState, useRef } from "react"
import { useStore } from "zustand"
import { useTranslations } from "next-intl"
import { ChevronDown, RotateCcw, Wand2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import type { ExtractedPalette } from "@/lib/color-extraction"
import {
  uploadProgramLogo,
  deleteProgramLogo,
  uploadProgramPlatformLogo,
  resetProgramPlatformLogo,
  useOrgLogoForProgram,
  extractPaletteFromLogoUrl,
} from "@/server/org-settings-actions"

type Props = {
  store: CardDesignStoreApi
  organizationId: string
  organizationName: string
  organizationLogo: string | null
  organizationLogoApple: string | null
  organizationLogoGoogle: string | null
  templateId: string
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

export function LogoPanel({ store, organizationId, organizationName, organizationLogo, organizationLogoApple, organizationLogoGoogle, templateId }: Props) {
  const t = useTranslations("studio.logo")
  const logoAppleUrl = useStore(store, (s) => s.wallet.logoAppleUrl)
  const logoGoogleUrl = useStore(store, (s) => s.wallet.logoGoogleUrl)
  const logoAppleZoom = useStore(store, (s) => s.wallet.logoAppleZoom)
  const programLogoUrl = useStore(store, (s) => s.wallet.programLogoUrl)

  const [uploading, setUploading] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState<"apple" | "google" | null>(null)
  const [overridePlatformUploading, setOverridePlatformUploading] = useState<"apple" | "google" | null>(null)

  // Brand match state
  const [isMatching, setIsMatching] = useState(false)
  const [matchPalette, setMatchPalette] = useState<ExtractedPalette | null>(null)
  const paletteCacheRef = useRef<{ url: string; palette: ExtractedPalette } | null>(null)

  const mainInputRef = useRef<HTMLInputElement>(null)
  const overrideInputRef = useRef<HTMLInputElement>(null)

  const initial = organizationName.charAt(0).toUpperCase()
  const hasLogo = !!(logoAppleUrl || logoGoogleUrl)
  const hasProgramLogo = !!programLogoUrl
  const effectiveOrgApple = organizationLogoApple ?? organizationLogo
  const effectiveOrgGoogle = organizationLogoGoogle ?? organizationLogo

  // ─── Main upload (program-level, auto-generates both platforms) ────

  async function handleMainUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("organizationId", organizationId)
      formData.set("templateId", templateId)
      formData.set("file", file)
      const result = await uploadProgramLogo(formData)
      if ("appleUrl" in result && result.appleUrl && "googleUrl" in result && result.googleUrl) {
        store.getState().setWalletField("logoAppleUrl", result.appleUrl)
        store.getState().setWalletField("logoGoogleUrl", result.googleUrl)
        store.getState().setWalletField("programLogoUrl", result.url ?? null)
      }
      // Reset brand match results when logo changes
      setMatchPalette(null)
      paletteCacheRef.current = null
    } finally {
      setUploading(false)
    }
  }

  async function handleMainDelete() {
    await deleteProgramLogo(organizationId, templateId)
    // Fall back to organization logos
    store.getState().setWalletField("logoAppleUrl", effectiveOrgApple)
    store.getState().setWalletField("logoGoogleUrl", effectiveOrgGoogle)
    store.getState().setWalletField("programLogoUrl", null)
    setMatchPalette(null)
    paletteCacheRef.current = null
  }

  async function handleUseOrgLogo() {
    await useOrgLogoForProgram(organizationId, templateId)
    store.getState().setWalletField("logoAppleUrl", effectiveOrgApple)
    store.getState().setWalletField("logoGoogleUrl", effectiveOrgGoogle)
    store.getState().setWalletField("programLogoUrl", null)
    setMatchPalette(null)
    paletteCacheRef.current = null
    toast.success(t("usingOrgLogo"))
  }

  // ─── Platform override ──────────────────────────────────

  async function handleOverrideUpload(platform: "apple" | "google", file: File) {
    setOverridePlatformUploading(platform)
    try {
      const formData = new FormData()
      formData.set("organizationId", organizationId)
      formData.set("templateId", templateId)
      formData.set("platform", platform)
      formData.set("file", file)
      const result = await uploadProgramPlatformLogo(formData)
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
      const result = await resetProgramPlatformLogo(organizationId, templateId, platform)
      if ("url" in result && result.url) {
        const field = platform === "apple" ? "logoAppleUrl" : "logoGoogleUrl"
        store.getState().setWalletField(field, result.url)
      }
    } finally {
      setOverridePlatformUploading(null)
    }
  }

  // ─── Brand Match ────────────────────────────────────────

  async function handleBrandMatch() {
    const sourceUrl = programLogoUrl ?? organizationLogo
    if (!sourceUrl) return
    setIsMatching(true)
    try {
      let palette: ExtractedPalette | null = null

      if (paletteCacheRef.current?.url === sourceUrl) {
        palette = paletteCacheRef.current.palette
      } else {
        const result = await extractPaletteFromLogoUrl(organizationId)
        if ("palette" in result && result.palette) {
          palette = result.palette
          paletteCacheRef.current = { url: sourceUrl, palette }
        }
      }

      if (palette) {
        setMatchPalette(palette)
        const s = store.getState()
        s.setWalletField("primaryColor", palette.primarySuggestion)
        s.setWalletField("secondaryColor", palette.secondarySuggestion)
        s.setWalletField("textColor", palette.textColor)
        toast.success("Card colors matched to your brand!")
      } else {
        toast.error("Could not extract colors from your logo.")
      }
    } catch {
      toast.error("Failed to extract brand colors. Please try again.")
    } finally {
      setIsMatching(false)
    }
  }

  return (
    <div>
      {/* ─── Main upload ─────────────────────────────────── */}
      <SectionHeader>Program Logo</SectionHeader>

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
            borderRadius: 9999,
            border: "1px solid var(--border)",
            backgroundColor: "var(--muted)",
            cursor: uploading ? "wait" : "pointer",
            fontSize: 12,
            color: "var(--foreground)",
          }}
        >
          {uploading ? "Processing..." : hasProgramLogo ? "Replace Logo" : "Upload Logo"}
        </button>
        {hasProgramLogo && (
          <button
            onClick={handleMainDelete}
            style={{
              padding: "7px 12px",
              borderRadius: 9999,
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

      {/* Use org logo button — show when program has its own logo */}
      {hasProgramLogo && effectiveOrgApple && (
        <button
          onClick={handleUseOrgLogo}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "6px 14px",
            borderRadius: 9999,
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            cursor: "pointer",
            fontSize: 11,
            color: "var(--muted-foreground)",
          }}
        >
          Use organization logo instead
        </button>
      )}

      <div
        style={{
          padding: "6px 10px",
          borderRadius: 12,
          backgroundColor: "var(--muted)",
          marginTop: 8,
          fontSize: 11,
          color: "var(--muted-foreground)",
        }}
      >
        {hasProgramLogo
          ? "This program has its own logo."
          : "Using your organization logo. Upload a different one for this program."}
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
                  borderRadius: 12,
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

          {/* Apple logo zoom — Google Wallet renders logos at a fixed size via URL, zoom not supported */}
          {logoAppleUrl && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--foreground)" }}>Apple logo zoom</span>
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

          {/* ─── Brand Match ─────────────────────────────── */}
          <SectionHeader>Brand Match</SectionHeader>
          <div
            style={{
              padding: 10,
              borderRadius: 14,
              border: "1px solid var(--border)",
              backgroundColor: "var(--accent)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>
              Extract colors from your logo and apply them to your card design.
            </div>

            {/* Extracted palette dots */}
            {matchPalette && matchPalette.colors.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginBottom: 8,
                  padding: "4px 8px",
                  borderRadius: 12,
                  backgroundColor: "var(--background)",
                }}
              >
                {matchPalette.colors.slice(0, 5).map((c, i) => (
                  <div
                    key={i}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      backgroundColor: c.hex,
                      border: "1px solid var(--border)",
                    }}
                    title={`${c.hex} (${c.percentage}%)`}
                  />
                ))}
                <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 4 }}>
                  {matchPalette.isMonochrome ? "Monochrome" : `${matchPalette.colors.length} colors`}
                </span>
              </div>
            )}

            <button
              onClick={handleBrandMatch}
              disabled={isMatching}
              style={{
                width: "100%",
                padding: "7px 14px",
                borderRadius: 9999,
                border: "none",
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
                cursor: isMatching ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                opacity: isMatching ? 0.5 : 1,
              }}
            >
              {isMatching ? (
                <>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  Extracting...
                </>
              ) : (
                <>
                  <Wand2 size={13} />
                  {matchPalette ? "Re-extract colors" : "Match to my brand"}
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* ─── Platform override (collapsed) ───────────────── */}
      {hasLogo && hasProgramLogo && (
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
                    borderRadius: 9999,
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
                          borderRadius: 9999,
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
                          borderRadius: 9999,
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
    </div>
  )
}

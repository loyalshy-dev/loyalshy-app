"use client"

import { useStore } from "zustand"
import { useTranslations } from "next-intl"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"

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

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLength?: number
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
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
  )
}

type Props = { store: CardDesignStoreApi }

export function DetailsPanel({ store }: Props) {
  const t = useTranslations("studio.details")
  const businessHours = useStore(store, (s) => s.wallet.businessHours)
  const socialLinks = useStore(store, (s) => s.wallet.socialLinks)
  const customMessage = useStore(store, (s) => s.wallet.customMessage)

  const set = store.getState().setWalletField

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
        {t("description")}
      </div>

      <SectionHeader>{t("businessHours")}</SectionHeader>
      <textarea
        value={businessHours}
        onChange={(e) => set("businessHours", e.target.value)}
        placeholder={t("hoursPlaceholder")}
        maxLength={1000}
        rows={3}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          fontSize: 12,
          color: "var(--foreground)",
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />

      <SectionHeader>{t("socialLinks")}</SectionHeader>
      <TextInput
        label={t("instagram")}
        value={socialLinks.instagram ?? ""}
        onChange={(v) => set("socialLinks", { ...socialLinks, instagram: v || undefined })}
        placeholder={t("handlePlaceholder")}
        maxLength={200}
      />
      <TextInput
        label={t("facebook")}
        value={socialLinks.facebook ?? ""}
        onChange={(v) => set("socialLinks", { ...socialLinks, facebook: v || undefined })}
        placeholder={t("facebookPlaceholder")}
        maxLength={200}
      />
      <TextInput
        label={t("tiktok")}
        value={socialLinks.tiktok ?? ""}
        onChange={(v) => set("socialLinks", { ...socialLinks, tiktok: v || undefined })}
        placeholder={t("handlePlaceholder")}
        maxLength={200}
      />
      <TextInput
        label={t("twitter")}
        value={socialLinks.x ?? ""}
        onChange={(v) => set("socialLinks", { ...socialLinks, x: v || undefined })}
        placeholder={t("handlePlaceholder")}
        maxLength={200}
      />

      <SectionHeader>{t("customMessage")}</SectionHeader>
      <textarea
        value={customMessage}
        onChange={(e) => set("customMessage", e.target.value)}
        placeholder={t("messagePlaceholder")}
        maxLength={2000}
        rows={3}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          fontSize: 12,
          color: "var(--foreground)",
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
    </div>
  )
}

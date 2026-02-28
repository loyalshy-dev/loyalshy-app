"use client"

import { useStore } from "zustand"
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
  const businessHours = useStore(store, (s) => s.wallet.businessHours)
  const mapAddress = useStore(store, (s) => s.wallet.mapAddress)
  const socialLinks = useStore(store, (s) => s.wallet.socialLinks)
  const customMessage = useStore(store, (s) => s.wallet.customMessage)

  const set = store.getState().setWalletField

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
        Back-of-pass details. These appear when the customer taps the card for more info.
      </div>

      <SectionHeader>Business Hours</SectionHeader>
      <textarea
        value={businessHours}
        onChange={(e) => set("businessHours", e.target.value)}
        placeholder={"Mon–Fri: 7am–9pm\nSat–Sun: 8am–10pm"}
        maxLength={1000}
        rows={3}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          fontSize: 12,
          color: "var(--foreground)",
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />

      <SectionHeader>Location</SectionHeader>
      <TextInput
        label="Map address"
        value={mapAddress}
        onChange={(v) => set("mapAddress", v)}
        placeholder="123 Main St, City, State"
        maxLength={500}
      />

      <SectionHeader>Social Links</SectionHeader>
      <TextInput
        label="Instagram"
        value={socialLinks.instagram ?? ""}
        onChange={(v) => set("socialLinks", { ...socialLinks, instagram: v || undefined })}
        placeholder="@yourrestaurant"
        maxLength={200}
      />
      <TextInput
        label="Facebook"
        value={socialLinks.facebook ?? ""}
        onChange={(v) => set("socialLinks", { ...socialLinks, facebook: v || undefined })}
        placeholder="facebook.com/yourrestaurant"
        maxLength={200}
      />
      <TextInput
        label="TikTok"
        value={socialLinks.tiktok ?? ""}
        onChange={(v) => set("socialLinks", { ...socialLinks, tiktok: v || undefined })}
        placeholder="@yourrestaurant"
        maxLength={200}
      />
      <TextInput
        label="X (Twitter)"
        value={socialLinks.x ?? ""}
        onChange={(v) => set("socialLinks", { ...socialLinks, x: v || undefined })}
        placeholder="@yourrestaurant"
        maxLength={200}
      />

      <SectionHeader>Custom Message</SectionHeader>
      <textarea
        value={customMessage}
        onChange={(e) => set("customMessage", e.target.value)}
        placeholder="Thank you for being a loyal customer!"
        maxLength={2000}
        rows={3}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
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

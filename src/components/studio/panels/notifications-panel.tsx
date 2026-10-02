"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { MapPin } from "lucide-react"

/**
 * "Near your business" used to be configured here, per program. It's now one
 * location per business under Automations (src/lib/proximity); this panel
 * points there so merchants who look in the studio still find it.
 */
export function NotificationsPanel() {
  const t = useTranslations("studio.notifications")
  return (
    <div
      style={{
        fontSize: 12,
        lineHeight: 1.5,
        padding: "12px",
        borderRadius: 12,
        backgroundColor: "var(--muted)",
        color: "var(--foreground)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 4 }}>
        <MapPin size={13} />
        {t("movedTitle")}
      </div>
      <div style={{ color: "var(--muted-foreground)", marginBottom: 10 }}>{t("movedBody")}</div>
      <Link
        href="/dashboard/automations/proximity"
        style={{
          display: "inline-block",
          padding: "6px 12px",
          borderRadius: 9999,
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--foreground)",
          textDecoration: "none",
        }}
      >
        {t("movedCta")}
      </Link>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { ChevronRight } from "lucide-react"
import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"
import type { CardType } from "@/lib/wallet/card-design"
import { ProgramPanel } from "./panels/program-panel"
import { ColorsPanel } from "./panels/colors-panel"
import { ProgressPanel } from "./panels/progress-panel"
import { StripPanel } from "./panels/strip-panel"
import { LogoPanel } from "./panels/logo-panel"
import { DetailsPanel } from "./panels/details-panel"
import { NotificationsPanel } from "./panels/notifications-panel"
import { PrizeRevealPanel } from "./panels/prize-reveal-panel"

// ─── Collapsible Section ─────────────────────────────────

function Section({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "var(--foreground)",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
        aria-expanded={isOpen}
      >
        {title}
        <ChevronRight
          size={14}
          style={{
            color: "var(--muted-foreground)",
            transition: "transform 0.15s ease",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {isOpen && (
        <div style={{ padding: "0 16px 16px" }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Main Sidebar ────────────────────────────────────────

type StudioSidebarProps = {
  store: CardDesignStoreApi
  passType: string
  cardType: CardType
  templateId: string
  organizationId: string
  organizationName: string
  organizationLogo: string | null
}

export function StudioSidebar({
  store,
  passType,
  cardType,
  templateId,
  organizationId,
  organizationName,
  organizationLogo,
}: StudioSidebarProps) {
  const stampsRequired = useStore(store, (s) => s.programConfig.stampsRequired)
  const selectedColorZone = useStore(store, (s) => s.ui.selectedColorZone)
  const isStampType = cardType === "STAMP"
  const hasProgress = cardType === "STAMP" || cardType === "POINTS"

  // Track which sections are open — Program open by default
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["program"]))

  // Auto-open Colors section when a color zone is selected on the card
  useEffect(() => {
    if (selectedColorZone && !openSections.has("colors")) {
      setOpenSections((prev) => new Set(prev).add("colors"))
    }
  }, [selectedColorZone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key clears zone selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedColorZone) {
        store.getState().setSelectedColorZone(null)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedColorZone, store])

  function toggle(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div
      style={{
        width: 320,
        borderRight: "1px solid var(--border)",
        backgroundColor: "var(--background)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <Section title="Program" isOpen={openSections.has("program")} onToggle={() => toggle("program")}>
        <ProgramPanel store={store} passType={passType} />
      </Section>

      <Section title="Colors" isOpen={openSections.has("colors")} onToggle={() => toggle("colors")}>
        <ColorsPanel store={store} />
      </Section>

      {isStampType && (
        <Section title="Progress Style" isOpen={openSections.has("progress")} onToggle={() => toggle("progress")}>
          <ProgressPanel
            store={store}
            programId={templateId}
            visitsRequired={stampsRequired}
          />
        </Section>
      )}

      <Section title="Images" isOpen={openSections.has("images")} onToggle={() => toggle("images")}>
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Logo
          </div>
          <LogoPanel
            store={store}
            organizationId={organizationId}
            organizationName={organizationName}
            organizationLogo={organizationLogo}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Strip Image
          </div>
          <StripPanel store={store} programId={templateId} forceStrip={hasProgress} />
        </div>
      </Section>

      {(passType === "STAMP_CARD" || passType === "COUPON") && (
        <Section title="Prize Reveal" isOpen={openSections.has("prize")} onToggle={() => toggle("prize")}>
          <PrizeRevealPanel store={store} />
        </Section>
      )}

      <Section title="Notifications" isOpen={openSections.has("notifications")} onToggle={() => toggle("notifications")}>
        <NotificationsPanel store={store} organizationName={organizationName} organizationLogo={organizationLogo} />
      </Section>

      <Section title="Back of Pass" isOpen={openSections.has("details")} onToggle={() => toggle("details")}>
        <DetailsPanel store={store} />
      </Section>
    </div>
  )
}

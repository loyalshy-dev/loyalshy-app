"use client"

import { useState, useMemo } from "react"
import type { PreviewFormat, DeviceFrame } from "@/types/editor"
import { WalletPassRenderer, type WalletPassDesign } from "@/components/wallet-pass-renderer"
import { DeviceFrameWrapper } from "./device-frame"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue } from "@/lib/pass-config"

type PreviewState = string

type PreviewStateOption = { id: PreviewState; label: string }

const STAMP_PREVIEW_STATES: PreviewStateOption[] = [
  { id: "in-progress", label: "In Progress" },
  { id: "almost-done", label: "Almost Done" },
  { id: "completed", label: "Completed" },
]

const COUPON_PREVIEW_STATES: PreviewStateOption[] = [
  { id: "available", label: "Available" },
  { id: "redeemed", label: "Redeemed" },
]

const MEMBERSHIP_PREVIEW_STATES: PreviewStateOption[] = [
  { id: "active", label: "Active" },
]

type CanvasPanelProps = {
  design: WalletPassDesign
  format: PreviewFormat
  deviceFrame: DeviceFrame
  organizationName: string
  organizationLogo: string | null
  templateName: string
  passType: string
  templateConfig: unknown
  visitsRequired: number
  rewardDescription: string
}

export function CanvasPanel({
  design,
  format,
  deviceFrame,
  organizationName,
  organizationLogo,
  templateName,
  passType,
  templateConfig,
  visitsRequired,
  rewardDescription,
}: CanvasPanelProps) {
  const previewStates: PreviewStateOption[] =
    passType === "COUPON" ? COUPON_PREVIEW_STATES
    : passType === "MEMBERSHIP" ? MEMBERSHIP_PREVIEW_STATES
    : STAMP_PREVIEW_STATES

  const [previewState, setPreviewState] = useState<PreviewState>(previewStates[0].id)

  // Stamp-specific visit counts
  const currentVisits =
    passType !== "STAMP_CARD"
      ? 0
      : previewState === "completed"
        ? visitsRequired
        : previewState === "almost-done"
          ? visitsRequired - 1
          : Math.min(4, Math.floor(visitsRequired * 0.4))

  // Coupon-specific preview data
  const couponPreview = useMemo(() => {
    if (passType !== "COUPON") return {}
    const config = parseCouponConfig(templateConfig)
    const discountText = config ? formatCouponValue(config) : rewardDescription
    const validUntil = config?.validUntil
      ? new Date(config.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "No expiry"
    const couponCode = config?.couponCode ?? undefined
    return { discountText, validUntil, couponCode }
  }, [passType, templateConfig, rewardDescription])

  // Membership-specific preview data
  const membershipPreview = useMemo(() => {
    if (passType !== "MEMBERSHIP") return {}
    const config = parseMembershipConfig(templateConfig)
    const tierName = config?.membershipTier ?? "Member"
    const benefits = config?.benefits ?? "Exclusive perks"
    return { tierName, benefits }
  }, [passType, templateConfig])

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--muted)",
        backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        overflow: "auto",
        padding: 32,
        gap: 16,
      }}
    >
      {/* Preview state toggle */}
      {previewStates.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 4,
            backgroundColor: "var(--background)",
            borderRadius: 8,
            padding: 3,
            border: "1px solid var(--border)",
          }}
        >
          {previewStates.map((state) => (
            <button
              key={state.id}
              onClick={() => setPreviewState(state.id)}
              aria-pressed={previewState === state.id}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                backgroundColor: previewState === state.id ? "var(--primary)" : "transparent",
                color: previewState === state.id ? "var(--primary-foreground)" : "var(--muted-foreground)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: previewState === state.id ? 600 : 400,
                transition: "all 0.15s ease",
              }}
            >
              {state.label}
            </button>
          ))}
        </div>
      )}

      <DeviceFrameWrapper frame={deviceFrame}>
        <WalletPassRenderer
          design={design}
          format={format}
          organizationName={organizationName}
          logoUrl={organizationLogo}
          programName={templateName}
          currentVisits={currentVisits}
          totalVisits={visitsRequired}
          rewardDescription={rewardDescription}
          customerName="Jane D."
          hasReward={previewState === "completed"}
          // Coupon props
          discountText={previewState === "redeemed" ? "Redeemed" : couponPreview.discountText}
          couponCode={couponPreview.couponCode}
          validUntil={couponPreview.validUntil}
          // Membership props
          tierName={membershipPreview.tierName}
          benefits={membershipPreview.benefits}
        />
      </DeviceFrameWrapper>
    </div>
  )
}

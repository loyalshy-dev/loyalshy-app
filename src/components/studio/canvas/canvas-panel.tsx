"use client"

import { useState, useMemo } from "react"
import type { PreviewFormat, DeviceFrame } from "@/types/editor"
import { WalletPassRenderer, type WalletPassDesign } from "@/components/wallet-pass-renderer"
import { DeviceFrameWrapper } from "./device-frame"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue, parsePrepaidConfig, parseGiftCardConfig, parseTicketConfig, parseAccessConfig, parseTransitConfig, parseBusinessIdConfig } from "@/lib/pass-config"

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
    : passType === "STAMP_CARD" || passType === "POINTS" ? STAMP_PREVIEW_STATES
    : []

  const [previewState, setPreviewState] = useState<PreviewState>(previewStates[0]?.id ?? "default")

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

  // Prepaid
  const prepaidConfig = useMemo(() => passType === "PREPAID" ? parsePrepaidConfig(templateConfig) : null, [passType, templateConfig])
  // Gift card
  const giftCardConfig = useMemo(() => passType === "GIFT_CARD" ? parseGiftCardConfig(templateConfig) : null, [passType, templateConfig])
  // Ticket
  const ticketConfig = useMemo(() => passType === "TICKET" ? parseTicketConfig(templateConfig) : null, [passType, templateConfig])
  // Access
  const accessConfig = useMemo(() => passType === "ACCESS" ? parseAccessConfig(templateConfig) : null, [passType, templateConfig])
  // Transit
  const transitConfig = useMemo(() => passType === "TRANSIT" ? parseTransitConfig(templateConfig) : null, [passType, templateConfig])
  // Business ID
  const businessIdConfig = useMemo(() => passType === "BUSINESS_ID" ? parseBusinessIdConfig(templateConfig) : null, [passType, templateConfig])

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--muted)",
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

      <DeviceFrameWrapper frame={deviceFrame} squareCorners={passType === "TICKET" && format === "apple"}>
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
          // Prepaid props
          remainingUses={prepaidConfig?.totalUses}
          totalUses={prepaidConfig?.totalUses}
          prepaidValidUntil={prepaidConfig?.validUntil
            ? new Date(prepaidConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : passType === "PREPAID" ? "No expiry" : undefined}
          // Gift card props
          giftBalance={giftCardConfig ? `${giftCardConfig.currency} ${(giftCardConfig.initialBalanceCents / 100).toFixed(2)}` : undefined}
          giftInitialValue={giftCardConfig ? `${giftCardConfig.currency} ${(giftCardConfig.initialBalanceCents / 100).toFixed(2)}` : undefined}
          // Ticket props
          eventName={ticketConfig?.eventName}
          eventDate={ticketConfig?.eventDate ? new Date(ticketConfig.eventDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : undefined}
          eventVenue={ticketConfig?.eventVenue}
          scanStatus={ticketConfig ? `0 / ${ticketConfig.maxScans}` : undefined}
          // Access props
          accessLabel={accessConfig?.accessLabel}
          // Transit props
          transitType={transitConfig?.transitType?.toUpperCase()}
          originName={transitConfig?.originName}
          destinationName={transitConfig?.destinationName}
          // Business ID props
          idLabel={businessIdConfig?.idLabel}
        />
      </DeviceFrameWrapper>
    </div>
  )
}

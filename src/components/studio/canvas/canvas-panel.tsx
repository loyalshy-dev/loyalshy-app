"use client"

import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import type { PreviewFormat, DeviceFrame } from "@/types/editor"
import { WalletPassRenderer, type WalletPassDesign } from "@/components/wallet-pass-renderer"
import { DeviceFrameWrapper } from "./device-frame"
import { InteractiveCardWrapper } from "./interactive-card-overlay"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue, parsePrepaidConfig, parseGiftCardConfig, parseTicketConfig, parseAccessConfig, parseTransitConfig, parseBusinessIdConfig } from "@/lib/pass-config"
import type { SocialLinks } from "@/lib/wallet/card-design"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"

type PreviewState = string

type PreviewStateOption = { id: PreviewState; label: string }

type CanvasPanelProps = {
  design: WalletPassDesign
  format: PreviewFormat
  deviceFrame: DeviceFrame
  organizationName: string
  organizationLogo: string | null
  organizationId?: string
  templateId?: string
  templateName: string
  passType: string
  templateConfig: unknown
  visitsRequired: number
  rewardDescription: string
  // Back-of-pass data
  businessHours?: string
  socialLinks?: SocialLinks
  customMessage?: string
  // Business ID holder photo
  holderPhotoUrl?: string | null
  // Store for interactive color overlay
  store?: CardDesignStoreApi
}

export function CanvasPanel({
  design,
  format,
  deviceFrame,
  organizationName,
  organizationLogo,
  organizationId,
  templateId,
  templateName,
  passType,
  templateConfig,
  visitsRequired,
  rewardDescription,
  businessHours,
  socialLinks,
  customMessage,
  holderPhotoUrl,
  store,
}: CanvasPanelProps) {
  const t = useTranslations("studio.canvas")

  const STAMP_PREVIEW_STATES: PreviewStateOption[] = [
    { id: "in-progress", label: t("inProgress") },
    { id: "almost-done", label: t("almostDone") },
    { id: "completed", label: t("completed") },
  ]

  const COUPON_PREVIEW_STATES: PreviewStateOption[] = [
    { id: "available", label: t("available") },
    { id: "redeemed", label: t("redeemed") },
  ]

  const MEMBERSHIP_PREVIEW_STATES: PreviewStateOption[] = [
    { id: "active", label: t("active") },
  ]

  const previewStates: PreviewStateOption[] =
    passType === "COUPON" ? COUPON_PREVIEW_STATES
    : passType === "MEMBERSHIP" ? MEMBERSHIP_PREVIEW_STATES
    : passType === "STAMP_CARD" || passType === "POINTS" ? STAMP_PREVIEW_STATES
    : []

  const [previewState, setPreviewState] = useState<PreviewState>(previewStates[0]?.id ?? "default")
  const [isFlipped, setIsFlipped] = useState(false)

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
    const discountText = config?.discountType === "freebie"
      ? (config.couponDescription || "Free item")
      : config ? formatCouponValue(config) : rewardDescription
    const validUntil = config?.validUntil
      ? new Date(config.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : t("noExpiry")
    const couponCode = config?.couponCode ?? undefined
    const discountLabel = config?.discountType === "freebie" ? "OFFER" : undefined
    return { discountText, discountLabel, validUntil, couponCode }
  }, [passType, templateConfig, rewardDescription])

  // Membership-specific preview data
  const membershipConfig = useMemo(() => passType === "MEMBERSHIP" ? parseMembershipConfig(templateConfig) : null, [passType, templateConfig])
  const membershipPreview = useMemo(() => {
    if (!membershipConfig) return {}
    return { tierName: membershipConfig.membershipTier ?? "Member", benefits: membershipConfig.benefits ?? "Exclusive perks" }
  }, [membershipConfig])

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

  // Check if back has any content
  const hasBackContent = !!(businessHours || customMessage ||
    socialLinks?.instagram || socialLinks?.facebook || socialLinks?.tiktok || socialLinks?.x)

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--background)",
        overflow: "auto",
        padding: "32px",
        gap: 16,
        position: "relative",
      }}
    >
      {/* Preview state toggle */}
      {previewStates.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 4,
            backgroundColor: "var(--background)",
            borderRadius: 9999,
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
                borderRadius: 9999,
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

      {/* 3D flip container */}
      <div style={{ perspective: 1000 }}>
        <div
          style={{
            transition: "transform 0.6s ease",
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            position: "relative",
          }}
        >
          {/* Front — wallet pass */}
          <div style={{ backfaceVisibility: "hidden" }}>
            <DeviceFrameWrapper frame={deviceFrame} squareCorners={passType === "TICKET" && format === "apple"} format={format}>
              <InteractiveCardWrapper
                store={store}
                format={format}
                showStrip={design.showStrip}
                cardType={passType}
                cardHeight={format === "apple" ? 450 : 480}
                isFlipped={isFlipped}
              >
              <WalletPassRenderer
                design={design}
                format={format}
                organizationName={organizationName}
                logoUrl={organizationLogo}
                programName={templateName}
                currentVisits={currentVisits}
                totalVisits={visitsRequired}
                rewardDescription={rewardDescription}
                memberNumber="42"
                customerName="Jane D."
                hasReward={previewState === "completed"}
                // Coupon props
                discountText={previewState === "redeemed" ? "Redeemed" : couponPreview.discountText}
                discountLabel={couponPreview.discountLabel}
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
                  : passType === "PREPAID" ? t("noExpiry") : undefined}
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
                accessGranted={passType === "ACCESS" ? "0" : undefined}
                // Transit props
                transitType={transitConfig?.transitType?.toUpperCase()}
                originName={transitConfig?.originName}
                destinationName={transitConfig?.destinationName}
                boardingStatus={passType === "TRANSIT" ? "NOT BOARDED" : undefined}
                // Business ID props
                idLabel={businessIdConfig?.idLabel}
                verifications={passType === "BUSINESS_ID" ? "0" : undefined}
                showHolderPhoto={businessIdConfig?.showHolderPhoto ?? membershipConfig?.showHolderPhoto ?? accessConfig?.showHolderPhoto}
                holderPhotoPosition={businessIdConfig?.holderPhotoPosition ?? membershipConfig?.holderPhotoPosition ?? accessConfig?.holderPhotoPosition}
                holderPhotoUrl={holderPhotoUrl}
              />
              </InteractiveCardWrapper>
            </DeviceFrameWrapper>
          </div>

          {/* Back — pass details */}
          <div
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          >
            <DeviceFrameWrapper frame={deviceFrame} squareCorners={false} format={format}>
              <PassBackView
                format={format}
                businessHours={businessHours}
                socialLinks={socialLinks}
                customMessage={customMessage}
                organizationName={organizationName}
                programName={templateName}
              />
            </DeviceFrameWrapper>
          </div>
        </div>
      </div>

      {/* Flip button */}
      <button
        onClick={() => setIsFlipped(!isFlipped)}
        aria-label={isFlipped ? "Show front of pass" : "Show back of pass"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          borderRadius: 9999,
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          color: "var(--muted-foreground)",
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 500,
          transition: "all 0.15s ease",
          opacity: hasBackContent ? 1 : 0.5,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.69 3L3 13" />
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 0 9 9 9 9 0 0 0 6.69-3L21 21" />
        </svg>
        {isFlipped ? "Show front" : "Show back"}
      </button>
    </div>
  )
}

// ─── Back of Pass View ──────────────────────────────────────

function PassBackView({
  format,
  businessHours,
  socialLinks,
  customMessage,
  organizationName,
  programName,
}: {
  format: PreviewFormat
  businessHours?: string
  socialLinks?: SocialLinks
  customMessage?: string
  organizationName: string
  programName: string
}) {
  const isApple = format === "apple"
  const bgColor = isApple ? "#f2f2f7" : "#ffffff"
  const textColor = "#1c1c1e"
  const mutedColor = "#8e8e93"
  const dividerColor = isApple ? "#d1d1d6" : "#e5e5e5"

  const socialEntries = [
    socialLinks?.instagram && { label: "Instagram", value: socialLinks.instagram },
    socialLinks?.facebook && { label: "Facebook", value: socialLinks.facebook },
    socialLinks?.tiktok && { label: "TikTok", value: socialLinks.tiktok },
    socialLinks?.x && { label: "X (Twitter)", value: socialLinks.x },
  ].filter(Boolean) as { label: string; value: string }[]

  const hasContent = !!(businessHours || customMessage || socialEntries.length > 0)

  return (
    <div
      style={{
        width: 320,
        minHeight: isApple ? 450 : 480,
        backgroundColor: bgColor,
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: textColor,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${dividerColor}`,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: mutedColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {organizationName}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
          {programName}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "4px 0" }}>
        {businessHours && (
          <BackField label="Business Hours" value={businessHours} textColor={textColor} mutedColor={mutedColor} dividerColor={dividerColor} />
        )}

        {socialEntries.length > 0 && (
          <BackField
            label="Social"
            value={socialEntries.map((s) => `${s.label}: ${s.value}`).join("\n")}
            textColor={textColor}
            mutedColor={mutedColor}
            dividerColor={dividerColor}
          />
        )}

        {customMessage && (
          <BackField label="Message" value={customMessage} textColor={textColor} mutedColor={mutedColor} dividerColor={dividerColor} />
        )}

        {!hasContent && (
          <div style={{ padding: "32px 20px", textAlign: "center", color: mutedColor, fontSize: 13 }}>
            No back-of-pass details configured.
            <br />
            <span style={{ fontSize: 11, marginTop: 4, display: "block" }}>
              Add business hours, social links, or a custom message in the &quot;Back of Pass&quot; section.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function BackField({
  label,
  value,
  textColor,
  mutedColor,
  dividerColor,
}: {
  label: string
  value: string
  textColor: string
  mutedColor: string
  dividerColor: string
}) {
  return (
    <div style={{ borderBottom: `1px solid ${dividerColor}` }}>
      <div style={{ padding: "12px 20px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: mutedColor, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", color: textColor }}>
          {value}
        </div>
      </div>
    </div>
  )
}

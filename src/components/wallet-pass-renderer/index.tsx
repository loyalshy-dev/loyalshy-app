"use client"

import { useState, useEffect } from "react"
import QRCode from "qrcode"
import {
  formatProgressValue,
  formatLabel,
  getFieldLayout,
  DEFAULT_HEADER_FIELDS,
  DEFAULT_SECONDARY_FIELDS,
  type CardType,
  type PatternStyle,
  type ProgressStyle,
  type LabelFormat,
  type StampGridConfig,
} from "@/lib/wallet/card-design"
import { getStampIconPaths, getRewardIconPaths } from "@/lib/wallet/stamp-icons"
import type { PreviewFormat } from "@/types/editor"
import { FieldSection } from "./field-section"

// ─── Types ──────────────────────────────────────────────────

export type WalletPassDesign = {
  cardType?: CardType // defaults to "STAMP"
  showStrip: boolean
  primaryColor: string
  secondaryColor: string
  textColor: string
  progressStyle: ProgressStyle
  labelFormat: LabelFormat
  customProgressLabel: string | null
  stripImageUrl: string | null
  stripOpacity?: number     // 0–1, default 1
  stripGrayscale?: boolean  // black & white filter
  stripColor1?: string | null  // strip gradient start (null = use primaryColor)
  stripColor2?: string | null  // strip gradient end (null = use secondaryColor)
  stripFill?: "flat" | "gradient"  // flat = solid sc1, gradient = sc1 → sc2
  patternColor?: string | null     // pattern accent color (null = use sc2)
  patternStyle: PatternStyle
  useStampGrid?: boolean    // independent stamp grid overlay
  stampGridConfig?: StampGridConfig
  stampFilledColor?: string | null // stamp icon fill color (null = use stripColor2 ?? secondaryColor)
  stripImagePosition?: { x: number; y: number }
  stripImageZoom?: number
  labelColor?: string | null
  logoAppleZoom?: number   // 1–3, default 1
  logoGoogleZoom?: number  // 1–3, default 1
  headerFields?: string[] | null   // custom header fields (null = default)
  secondaryFields?: string[] | null // custom secondary fields (null = default)
}

type WalletPassRendererProps = {
  design: WalletPassDesign
  format?: PreviewFormat
  organizationName?: string
  logoUrl?: string | null
  logoAppleUrl?: string | null
  logoGoogleUrl?: string | null
  programName?: string
  currentVisits?: number
  totalVisits?: number
  rewardDescription?: string
  customerName?: string
  hasReward?: boolean
  memberSince?: string
  width?: number
  height?: number
  compact?: boolean
  className?: string
  style?: React.CSSProperties
  qrValue?: string // When provided, renders a real QR code instead of placeholder
  // Coupon-specific
  discountText?: string      // e.g. "20% OFF", "$5 off", "Free item"
  couponCode?: string        // coupon code to display
  validUntil?: string        // expiry date string
  // Membership-specific
  tierName?: string          // e.g. "VIP", "Gold"
  benefits?: string          // membership benefits summary
  // Prepaid-specific
  remainingUses?: number     // remaining uses on prepaid pass
  totalUses?: number         // total uses on prepaid pass
  prepaidValidUntil?: string // expiry date for prepaid
  // Gift card-specific
  giftBalance?: string       // e.g. "USD 25.00"
  giftInitialValue?: string  // e.g. "USD 50.00"
  // Ticket-specific
  eventName?: string         // event name
  eventDate?: string         // formatted date string
  eventVenue?: string        // venue name
  scanStatus?: string        // e.g. "0 / 1"
  // Access-specific
  accessLabel?: string       // e.g. "VIP Access"
  accessGranted?: string     // e.g. "12"
  // Transit-specific
  transitType?: string       // e.g. "BUS", "TRAIN"
  originName?: string        // e.g. "Central Station"
  destinationName?: string   // e.g. "Airport"
  boardingStatus?: string    // e.g. "NOT BOARDED"
  // Business ID-specific
  idLabel?: string           // e.g. "Employee ID"
  verifications?: string     // e.g. "5"
}

// ─── Constants ──────────────────────────────────────────────

const SYSTEM_FONT = `-apple-system, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, sans-serif`
const CARD_WIDTH = 320
const APPLE_CARD_HEIGHT = 450
const GOOGLE_CARD_HEIGHT = 480
const BORDER_RADIUS = 12

// ─── Helpers ────────────────────────────────────────────────

function textColorForBg(hex: string): string {
  if (!hex || hex[0] !== "#" || hex.length < 7) return "#ffffff"
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

// ─── Component ──────────────────────────────────────────────

export function WalletPassRenderer({
  design,
  format = "apple",
  organizationName = "Organization",
  logoUrl,
  logoAppleUrl,
  logoGoogleUrl,
  programName = "Loyalty Program",
  currentVisits = 0,
  totalVisits = 10,
  rewardDescription = "Free reward",
  customerName = "Jane D.",
  hasReward = false,
  memberSince = "Feb 2026",
  width,
  height,
  compact = false,
  className,
  style: styleProp,
  qrValue,
  discountText,
  couponCode,
  validUntil,
  tierName,
  benefits,
  remainingUses,
  totalUses,
  prepaidValidUntil,
  giftBalance,
  giftInitialValue,
  eventName,
  eventDate,
  eventVenue,
  scanStatus,
  accessLabel,
  accessGranted,
  transitType,
  originName,
  destinationName,
  boardingStatus,
  idLabel,
  verifications,
}: WalletPassRendererProps) {
  const cardType = design.cardType ?? "STAMP"
  const isTicket = cardType === "TICKET"
  const defaultLayout = getFieldLayout(cardType)
  const isApple = format === "apple"

  // Custom field layout: user-configurable header + secondary for STAMP/POINTS
  const isStampGrid = design.useStampGrid && design.showStrip
  const isStampType = !cardType || cardType === "STAMP" || cardType === "POINTS"
  const layout = isStampType
    ? {
        ...defaultLayout,
        apple: {
          header: design.headerFields ?? DEFAULT_HEADER_FIELDS,
          // Progress is baked into the strip image — no primary text field needed
          primary: design.showStrip ? [] : defaultLayout.apple.primary,
          secondary: design.secondaryFields ?? DEFAULT_SECONDARY_FIELDS,
          auxiliary: [],
        },
      }
    : defaultLayout
  const resolvedLogo = isApple
    ? (logoAppleUrl ?? logoUrl ?? null)
    : (logoGoogleUrl ?? logoUrl ?? null)
  const useStrip = design.showStrip
  const stripHeight = isTicket && isApple ? 100 : isApple ? 130 : 125

  // Dimensions
  const CARD_HEIGHT = isApple ? APPLE_CARD_HEIGHT : GOOGLE_CARD_HEIGHT
  const baseW = width ?? CARD_WIDTH
  const baseH = height ?? CARD_HEIGHT

  // Scale for compact mode
  const scale = compact ? Math.min(baseW / CARD_WIDTH, baseH / CARD_HEIGHT, 1) : 1
  const outerW = compact ? baseW : CARD_WIDTH
  const outerH = compact ? baseH : CARD_HEIGHT

  // Build field values — stamp/points only
  const progressText = cardType === "STAMP" || cardType === "POINTS"
    ? formatProgressValue(
        currentVisits,
        totalVisits,
        design.progressStyle,
        hasReward,
        design.customProgressLabel ?? rewardDescription
      )
    : ""

  const lbl = (text: string) => formatLabel(text, design.labelFormat)

  // Map field names to label+value pairs — must match actual pass field data
  // (Apple: generate-pass.ts fieldData; Google: loyaltyObject textModulesData)
  const progressLabel = design.customProgressLabel
    ? design.customProgressLabel
    : hasReward ? "STATUS" : "PROGRESS"

  function resolveField(name: string) {
    switch (name) {
      case "restaurant":
      case "organization":
        return { label: lbl("ORGANIZATION"), value: organizationName }
      // Stamp/Points fields
      case "progress":
        return { label: lbl(progressLabel), value: progressText }
      case "nextReward":
        return { label: lbl("NEXT REWARD"), value: rewardDescription }
      case "totalVisits":
        return { label: lbl("TOTAL VISITS"), value: `${totalVisits}` }
      case "memberNumber":
        return { label: lbl("MEMBER"), value: `#${totalVisits}` }
      // Coupon fields
      case "discount":
        return { label: lbl("DISCOUNT"), value: discountText ?? rewardDescription }
      case "validUntil":
        return { label: lbl("VALID UNTIL"), value: validUntil ?? "—" }
      case "couponCode":
        return { label: lbl("CODE"), value: couponCode ?? "—" }
      // Membership fields
      case "tierName":
        return { label: lbl("TIER"), value: tierName ?? "Member" }
      case "benefits":
        return { label: lbl("BENEFITS"), value: benefits ?? "—" }
      // Prepaid fields
      case "remaining":
        return { label: lbl("REMAINING"), value: `${remainingUses ?? 0} / ${totalUses ?? 0}` }
      case "prepaidValidUntil":
        return { label: lbl("VALID UNTIL"), value: prepaidValidUntil ?? "No expiry" }
      case "totalUsed":
        return { label: lbl("TOTAL USED"), value: `${currentVisits}` }
      // Gift card fields
      case "giftBalance":
        return { label: lbl("BALANCE"), value: giftBalance ?? "$0.00" }
      case "giftInitial":
        return { label: lbl("INITIAL VALUE"), value: giftInitialValue ?? "—" }
      // Ticket fields
      case "eventName":
        return { label: lbl("EVENT"), value: eventName ?? programName }
      case "eventDate":
        return { label: lbl("DATE"), value: eventDate ?? "—" }
      case "eventVenue":
        return { label: lbl("VENUE"), value: eventVenue ?? "—" }
      case "scanStatus":
        return { label: lbl("SCANS"), value: scanStatus ?? "0 / 1" }
      // Access fields
      case "accessLabel":
        return { label: lbl(accessLabel ?? "ACCESS"), value: "Granted" }
      case "accessGranted":
        return { label: lbl("TOTAL GRANTED"), value: accessGranted ?? "0" }
      // Transit fields
      case "transitType":
        return { label: lbl("TYPE"), value: transitType ?? "OTHER" }
      case "origin":
        return { label: lbl("FROM"), value: originName ?? "—" }
      case "destination":
        return { label: lbl("TO"), value: destinationName ?? "—" }
      case "boardingStatus":
        return { label: lbl("STATUS"), value: boardingStatus ?? "NOT BOARDED" }
      // Business ID fields
      case "idLabel":
        return { label: lbl(idLabel ?? "ID"), value: customerName }
      case "verifications":
        return { label: lbl("VERIFICATIONS"), value: verifications ?? "0" }
      // Shared fields
      case "customerName":
        return { label: lbl("NAME"), value: customerName }
      case "memberSince":
        return { label: lbl("MEMBER SINCE"), value: memberSince }
      case "registeredAt": {
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, "0")
        return { label: lbl("REGISTERED"), value: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` }
      }
      default:
        return { label: name, value: "—" }
    }
  }

  const headerFields = layout.apple.header.map(resolveField)
  const primaryFields = layout.apple.primary.map(resolveField)
  const secondaryFields = layout.apple.secondary.map(resolveField)
  const auxiliaryFields = layout.apple.auxiliary.map(resolveField)

  // Google: flatten header + secondary into rows
  // Filter out fields that Google handles natively (not as text rows):
  // - "organization" / "memberNumber": shown in Google header
  // - "progress" / "totalVisits": shown via Google's native loyaltyPoints widget (stamp/points only)
  const googleExclude = new Set(["organization", "memberNumber"])
  if (isStampType) {
    googleExclude.add("progress")
    googleExclude.add("totalVisits")
  }
  const googleFieldNames = [
    ...layout.apple.header,
    ...layout.apple.secondary,
    ...layout.apple.auxiliary,
  ].filter((name) => !googleExclude.has(name))
  const googleFields = googleFieldNames.map(resolveField)

  // Hide org name text next to logo (Apple: no text beside logo; Google: only shows circular logo)
  const hideLogoText = true
  const logoZoom = isApple ? (design.logoAppleZoom ?? 1) : (design.logoGoogleZoom ?? 1)

  // ─── Section: Header ───
  const headerSection = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: isApple ? "6px 16px 6px" : "8px 12px 6px",
        flexShrink: 0,
      }}
    >
      {/* Left side: Logo + optional org name (hidden for Apple ticket) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, ...(isTicket && isApple ? { visibility: "hidden" as const } : {}) }}>
        {/* Logo — rectangular for Apple, circular for Google (centered on corner radius) */}
        <div
          style={{
            width: isApple ? 150 : 40,
            height: isApple ? 50 : 40,
            borderRadius: isApple ? 3 : "50%",
            backgroundColor: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {resolvedLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedLogo}
              alt=""
              style={{
                width: isApple ? "100%" : 40,
                height: isApple ? "100%" : 40,
                borderRadius: isApple ? 0 : "50%",
                objectFit: isApple ? "contain" : "cover",
                transform: logoZoom !== 1 ? `scale(${logoZoom})` : undefined,
              }}
            />
          ) : isApple ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: "100%",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: `color-mix(in srgb, ${design.textColor} 12%, transparent)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: design.textColor }}>
                  {organizationName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: design.textColor,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.01em",
                }}
              >
                {organizationName}
              </span>
            </div>
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: `color-mix(in srgb, ${design.textColor} 12%, transparent)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: design.textColor }}>
                {organizationName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        {!hideLogoText && (
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {organizationName}
          </div>
        )}
      </div>

      {/* Right side: Header fields (Apple Wallet style — right-aligned) */}
      {isApple && headerFields.length > 0 && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {headerFields.map((f, i) => (
            <div key={i}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                color: design.labelColor ?? design.textColor,
                opacity: design.labelColor ? 1 : 0.6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}>
                {f.label}
              </div>
              <div style={{ fontSize: isTicket ? 18 : 22, fontWeight: 300, lineHeight: 1.1 }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apple Wallet logo indicator (only when no header fields) */}
      {isApple && headerFields.length === 0 && (
        <div style={{ opacity: 0.4, fontSize: 10, fontWeight: 500 }}>
          ●●●
        </div>
      )}
    </div>
  )

  // ─── Section: Primary Fields ───
  const primaryPadding = useStrip ? "2px 16px 2px" : "12px 16px 8px"
  const primaryFontSize = useStrip ? 28 : 24

  // Progress text overlay on strip — for non-stamp-grid STAMP/POINTS cards
  const showProgressOnStrip = useStrip && isStampType && !isStampGrid
  const progressOverlay = showProgressOnStrip ? (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        zIndex: 2,
        padding: "8px 16px",
        textShadow: "0 2px 6px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: design.labelColor ?? design.textColor,
          opacity: design.labelColor ? 1 : 0.85,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          lineHeight: 1,
          marginBottom: 2,
        }}
      >
        {lbl(progressLabel)}
      </div>
      <div
        style={{
          fontSize: primaryFontSize,
          fontWeight: 700,
          color: design.textColor,
          letterSpacing: design.progressStyle === "NUMBERS" ? "0.02em" : "0.08em",
          lineHeight: 1.1,
          opacity: 0.95,
        }}
      >
        {progressText}
      </div>
    </div>
  ) : null

  // ─── Section: Strip Image ───
  const stripSection = useStrip ? (() => {
    const sc1 = design.stripColor1 ?? design.primaryColor
    const sc2 = design.stripColor2 ?? design.secondaryColor
    const isFlat = (design.stripFill ?? "gradient") === "flat"
    const pc = design.patternColor ?? sc2
    return (
      <div
        style={{
          height: stripHeight,
          flexShrink: 0,
          backgroundColor: sc1,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background layer: image, pattern, flat, or gradient */}
        {design.stripImageUrl ? (() => {
          const pos = design.stripImagePosition ?? { x: 0.5, y: 0.5 }
          const zoom = design.stripImageZoom ?? 1
          const anchor = `${pos.x * 100}% ${pos.y * 100}%`
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={design.stripImageUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: anchor,
                transform: zoom !== 1 ? `scale(${zoom})` : undefined,
                transformOrigin: anchor,
                opacity: design.stripOpacity ?? 1,
                filter: design.stripGrayscale ? "grayscale(1)" : undefined,
              }}
            />
          )
        })() : design.patternStyle !== "NONE" ? (
          <PatternFill
            pattern={design.patternStyle}
            primaryColor={sc1}
            secondaryColor={pc}
          />
        ) : isFlat ? (
          <div style={{ width: "100%", height: "100%", backgroundColor: sc1 }} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${sc1} 0%, ${sc2} 100%)`,
            }}
          />
        )}

        {/* Stamp grid overlay (stamp cards only) */}
        {cardType === "STAMP" && design.useStampGrid && (
          <StampGridOverlay
            currentVisits={currentVisits}
            totalVisits={totalVisits}
            hasReward={hasReward}
            config={design.stampGridConfig}
            primaryColor={sc1}
            secondaryColor={design.stampFilledColor ?? sc2}
            textColor={design.textColor}
            stripHeight={stripHeight}
          />
        )}

        {/* Progress text overlay on strip (non-stamp-grid STAMP/POINTS) */}
        {progressOverlay}

      </div>
    )
  })() : null

  const bannerSection = null

  // Fallback for non-strip: render below header
  const primarySection = !useStrip ? (
    <div style={{ padding: primaryPadding }}>
      {primaryFields.map((f, i) => (
        <div key={i}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: design.labelColor ?? undefined,
              opacity: design.labelColor ? 1 : 0.6,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 0,
            }}
          >
            {f.label}
          </div>
          <div
            style={{
              fontSize: primaryFontSize,
              fontWeight: 700,
              letterSpacing: design.progressStyle === "NUMBERS" ? "0.02em" : "0.08em",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {f.value}
          </div>
        </div>
      ))}
    </div>
  ) : null

  // ─── Section: Secondary Fields ───
  const secondarySection = (
    <div style={{ padding: useStrip ? "2px 16px" : "8px 16px" }}>
      <FieldSection
        fields={secondaryFields}
        textColor={design.textColor}
        labelColor={design.labelColor}
        format={format}
        small={isTicket}
      />
    </div>
  )

  // ─── Section: Auxiliary Fields ───
  const auxiliarySection = (
    <div style={{ padding: useStrip ? "2px 16px" : "4px 16px" }}>
      <FieldSection
        fields={auxiliaryFields}
        textColor={design.textColor}
        labelColor={design.labelColor}
        format={format}
        small={isTicket}
      />
    </div>
  )

  const brandingSection = null

  // ─── Section: Divider ───
  const dividerSection = (
    <div
      style={{
        margin: "0 16px",
        height: 1,
        backgroundColor: design.textColor,
        opacity: 0.12,
      }}
    />
  )

  // ─── Section: QR Code ───
  const qrBoxSize = useStrip ? 135 : 135
  const qrInnerSize = useStrip ? 120 : 120
  const qrSection = (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: useStrip ? "8px 16px 10px" : "12px 16px 14px",
      }}
    >
      <div
        style={{
          width: qrBoxSize,
          height: qrBoxSize,
          backgroundColor: "#ffffff",
          borderRadius: isApple ? 4 : 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {qrValue ? (
          <QrImage value={qrValue} size={qrInnerSize} />
        ) : (
          <QrPlaceholder size={qrInnerSize} />
        )}
      </div>
    </div>
  )

  // ─── Layout ───
  return (
    <div
      className={className}
      style={{
        width: outerW,
        height: outerH,
        flexShrink: 0,
        ...styleProp,
      }}
    >
      <div
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          borderRadius: isTicket && isApple ? "0px" : isApple ? BORDER_RADIUS : 20,
          overflow: "hidden",
          backgroundColor: design.primaryColor,
          fontFamily: SYSTEM_FONT,
          // Ticket notch: radial-gradient mask punches a semicircle from the top center
          ...(isTicket && isApple ? {
            WebkitMaskImage: "radial-gradient(ellipse 28px 14px at 50% 0, transparent 98%, black 100%)",
            maskImage: "radial-gradient(ellipse 28px 14px at 50% 0, transparent 98%, black 100%)",
          } : {}),
          color: design.textColor,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        }}
      >
        {isApple ? (
          <>
            {isTicket ? (
              <>
                {/* Ticket layout: header fields above strip, event name ON strip */}
                {headerSection}
                {/* Strip with event name overlay */}
                {useStrip ? (
                  <div style={{ position: "relative" }}>
                    {stripSection}
                    {/* Event name overlay on strip */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        padding: "0 16px",
                        zIndex: 2,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 36,
                          fontWeight: 300,
                          color: design.textColor,
                          textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                          lineHeight: 1.1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          width: "100%",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {eventName || programName}
                      </div>
                    </div>
                  </div>
                ) : (
                  primarySection
                )}
                {secondarySection}
                {auxiliarySection}
                <div style={{ flex: 1 }} />
                {qrSection}
              </>
            ) : (
              <>
                {headerSection}
                {stripSection}
                {primarySection}
                {secondarySection}
                {auxiliarySection}
                <div style={{ flex: 1 }} />
                {brandingSection}
                {qrSection}
              </>
            )}
          </>
        ) : (
          <>
            {headerSection}
            {bannerSection}
            {/* Google: program name as large heading */}
            <div style={{ padding: "6px 16px 2px" }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 400,
                  color: design.textColor,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isTicket ? (eventName || programName) : programName}
              </div>
            </div>
            {isTicket ? (
              /* Ticket Google: 2-column, 2-row grid */
              <GoogleTicketFields
                fields={[
                  resolveField("eventDate"), resolveField("eventVenue"),
                  resolveField("scanStatus"), resolveField("customerName"),
                ]}
                textColor={design.textColor}
                labelColor={design.labelColor}
              />
            ) : (
              <GoogleFieldRows
                fields={googleFields}
                textColor={design.textColor}
                labelColor={design.labelColor}
              />
            )}
            <div style={{ flex: 1 }} />
            {brandingSection}
            {qrSection}
            {/* Barcode value label (Google shows this below QR) */}
            {(
              <div
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: design.textColor,
                  opacity: 1,
                  padding: "0 16px 6px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {qrValue || "fb93c6ef-b186-4a7b-bd20-1d60384a46da"}
              </div>
            )}
            {stripSection}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Google Ticket Fields (2-column grid) ───

function GoogleFieldRows({
  fields,
  textColor,
  labelColor,
}: {
  fields: { label: string; value: string }[]
  textColor: string
  labelColor?: string | null
}) {
  // Render fields in rows of 2 (matching real Google Wallet layout)
  const rows: { label: string; value: string }[][] = []
  for (let i = 0; i < fields.length; i += 2) {
    rows.push(fields.slice(i, i + 2))
  }

  return (
    <div style={{ padding: "4px 16px" }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: 16, marginBottom: ri < rows.length - 1 ? 10 : 0 }}>
          {row.map((field, fi) => (
            <div key={fi} style={{ flex: 1, textAlign: fi === 1 ? "right" : undefined }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: labelColor ?? textColor,
                  opacity: labelColor ? 1 : 0.7,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  marginBottom: 1,
                }}
              >
                {field.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: textColor,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {field.value}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function GoogleTicketFields({
  fields,
  textColor,
  labelColor,
}: {
  fields: { label: string; value: string }[]
  textColor: string
  labelColor?: string | null
}) {
  // Render as 2-column rows
  const rows: { label: string; value: string }[][] = []
  for (let i = 0; i < fields.length; i += 2) {
    rows.push(fields.slice(i, i + 2))
  }

  return (
    <div style={{ padding: "4px 16px" }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: 16, marginBottom: ri < rows.length - 1 ? 12 : 0 }}>
          {row.map((field, fi) => (
            <div key={fi} style={{ flex: 1, textAlign: fi === 1 ? "right" : undefined }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: labelColor ?? textColor,
                  opacity: labelColor ? 1 : 0.7,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  marginBottom: 1,
                }}
              >
                {field.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: textColor,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {field.value}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Stamp Grid Overlay (CSS-based, absolutely positioned) ───

function StampGridOverlay({
  currentVisits,
  totalVisits,
  hasReward,
  config,
  primaryColor,
  secondaryColor,
  textColor,
  stripHeight = 130,
}: {
  currentVisits: number
  totalVisits: number
  hasReward: boolean
  config?: StampGridConfig
  primaryColor: string
  secondaryColor: string
  textColor: string
  stripHeight?: number
}) {
  const stampIcon = config?.stampIcon ?? "coffee"
  const customStampIconUrl = config?.customStampIconUrl ?? null
  const rewardIconId = config?.rewardIcon ?? "gift"
  const useUniformIcon = config?.useUniformIcon ?? false
  const customRewardIconUrl = useUniformIcon ? (customStampIconUrl) : (config?.customRewardIconUrl ?? null)
  const customEmptyIconUrl = useUniformIcon ? (customStampIconUrl) : (config?.customEmptyIconUrl ?? null)
  const stampShape = config?.stampShape ?? "circle"
  const filledStyle = config?.filledStyle ?? "icon"
  const iconScale = config?.stampIconScale ?? 0.6
  const totalSlots = totalVisits
  const cols = totalSlots <= 5 ? totalSlots : Math.ceil(totalSlots / 2)
  const rows = Math.ceil(totalSlots / cols)

  const gap = 12
  const pad = 8
  const slotSize = Math.floor(Math.min(
    (300 - pad * 2 - (cols - 1) * gap) / cols,
    (stripHeight - pad * 2 - (rows - 1) * gap) / rows,
  ))

  const borderRadius = stampShape === "circle" ? "50%" : stampShape === "rounded-square" ? "20%" : "0"

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${pad}px`,
        zIndex: 1,
        backgroundColor: "rgba(0,0,0,0.15)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap,
          maxWidth: cols * slotSize + (cols - 1) * gap,
        }}
      >
        {Array.from({ length: totalSlots }, (_, i) => {
          const isRewardSlot = i === totalVisits - 1
          const isFilled = i < currentVisits

          if (isRewardSlot) {
            const rewardPaths = useUniformIcon ? getStampIconPaths(stampIcon) : getRewardIconPaths(rewardIconId)
            const rewardFilled = hasReward || isFilled
            const rBg = config?.rewardSlotBg === "transparent"
              ? "transparent"
              : config?.rewardSlotBg ?? secondaryColor
            const rStroke = config?.rewardSlotColor ?? primaryColor

            if (rewardFilled) {
              // Filled reward slot — same styles as filled stamps
              if (filledStyle === "solid") {
                return (
                  <div
                    key={i}
                    style={{
                      width: slotSize,
                      height: slotSize,
                      borderRadius,
                      backgroundColor: rBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: slotSize * 0.4,
                      fontWeight: 700,
                      color: rStroke,
                    }}
                  >
                    {"\u2713"}
                  </div>
                )
              }
              return (
                <div
                  key={i}
                  style={{
                    width: slotSize,
                    height: slotSize,
                    borderRadius,
                    overflow: "hidden",
                    border: "none",
                    backgroundColor: rBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {customRewardIconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={customRewardIconUrl}
                      alt=""
                      style={{
                        width: slotSize * iconScale,
                        height: slotSize * iconScale,
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <svg
                      width={slotSize * iconScale}
                      height={slotSize * iconScale}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={rStroke}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dangerouslySetInnerHTML={{ __html: rewardPaths }}
                    />
                  )}
                </div>
              )
            }

            // Empty reward slot — same as empty slots but with reward icon
            const emptyOpacity = config?.emptySlotOpacity ?? 0.35
            return (
              <div
                key={i}
                style={{
                  width: slotSize,
                  height: slotSize,
                  borderRadius,
                  overflow: "hidden",
                  border: "none",
                  backgroundColor: config?.rewardSlotBg === "transparent" ? "transparent" : (config?.rewardSlotBg ?? `${primaryColor}25`),
                  backdropFilter: "blur(2px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: emptyOpacity,
                }}
              >
                {customRewardIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={customRewardIconUrl}
                    alt=""
                    style={{
                      width: slotSize * iconScale,
                      height: slotSize * iconScale,
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <svg
                    width={slotSize * iconScale}
                    height={slotSize * iconScale}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={config?.rewardSlotColor ?? textColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dangerouslySetInnerHTML={{ __html: rewardPaths }}
                  />
                )}
              </div>
            )
          }

          if (isFilled) {
            if (filledStyle === "solid") {
              return (
                <div
                  key={i}
                  style={{
                    width: slotSize,
                    height: slotSize,
                    borderRadius,
                    backgroundColor: secondaryColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: slotSize * 0.4,
                    fontWeight: 700,
                    color: primaryColor,
                  }}
                >
                  {"\u2713"}
                </div>
              )
            }
            return (
              <div
                key={i}
                style={{
                  width: slotSize,
                  height: slotSize,
                  borderRadius,
                  overflow: "hidden",
                  border: filledStyle === "icon-with-border" ? `2px solid ${secondaryColor}88` : "none",
                  backgroundColor: secondaryColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {customStampIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={customStampIconUrl}
                    alt=""
                    style={{
                      width: slotSize * iconScale,
                      height: slotSize * iconScale,
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <svg
                    width={slotSize * iconScale}
                    height={slotSize * iconScale}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={primaryColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dangerouslySetInnerHTML={{ __html: getStampIconPaths(stampIcon) }}
                  />
                )}
              </div>
            )
          }

          // Empty slot — frosted glass effect
          const emptyNumScale = config?.emptyNumberScale ?? 0.35
          const emptyNumColor = config?.emptyNumberColor ?? textColor
          const slotOpacity = config?.emptySlotOpacity ?? 0.35
          return (
            <div
              key={i}
              style={{
                width: slotSize,
                height: slotSize,
                borderRadius,
                overflow: "hidden",
                border: `1.5px dashed ${secondaryColor}40`,
                backgroundColor: config?.emptySlotBg === "transparent" ? "transparent" : (config?.emptySlotBg ?? `${primaryColor}25`),
                backdropFilter: "blur(2px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: slotSize * emptyNumScale,
                fontWeight: 500,
                color: emptyNumColor,
                opacity: slotOpacity,
              }}
            >
              {customEmptyIconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={customEmptyIconUrl}
                  alt=""
                  style={{
                    width: slotSize * iconScale,
                    height: slotSize * iconScale,
                    objectFit: "contain",
                  }}
                />
              ) : useUniformIcon ? (
                <svg
                  width={slotSize * iconScale}
                  height={slotSize * iconScale}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={config?.emptySlotColor ?? textColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dangerouslySetInnerHTML={{ __html: getStampIconPaths(stampIcon) }}
                />
              ) : (
                i + 1
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── QR Code (real) ─────────────────────────────────────────

function QrImage({ value, size }: { value: string; size: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size * 2, // 2x for retina
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setDataUrl).catch(() => {})
  }, [value, size])

  if (!dataUrl) return <QrPlaceholder size={size} />

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt="QR code" width={size} height={size} style={{ display: "block" }} />
  )
}

// ─── QR Placeholder ─────────────────────────────────────────

function QrPlaceholder({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Top-left finder */}
      <rect x="4" y="4" width="18" height="18" rx="2" stroke="#000" strokeWidth="3" fill="none" />
      <rect x="8" y="8" width="10" height="10" rx="1" fill="#000" />
      {/* Top-right finder */}
      <rect x="42" y="4" width="18" height="18" rx="2" stroke="#000" strokeWidth="3" fill="none" />
      <rect x="46" y="8" width="10" height="10" rx="1" fill="#000" />
      {/* Bottom-left finder */}
      <rect x="4" y="42" width="18" height="18" rx="2" stroke="#000" strokeWidth="3" fill="none" />
      <rect x="8" y="46" width="10" height="10" rx="1" fill="#000" />
      {/* Data dots */}
      <rect x="26" y="4" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="32" y="4" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="26" y="10" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="26" y="26" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="32" y="26" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="38" y="26" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="26" y="32" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="44" y="26" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="56" y="26" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="26" y="44" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="32" y="44" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="44" y="44" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="50" y="44" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="56" y="44" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="44" y="50" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
      <rect x="56" y="56" width="4" height="4" rx="0.5" fill="#000" opacity="0.4" />
    </svg>
  )
}

// ─── Pattern Fill (visual hint, not pixel-perfect) ──────────

function PatternFill({
  pattern,
  primaryColor,
  secondaryColor,
}: {
  pattern: PatternStyle
  primaryColor: string
  secondaryColor: string
}) {
  const bgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: primaryColor,
  }

  switch (pattern) {
    case "DOTS":
      return (
        <div
          style={{
            ...bgStyle,
            backgroundImage: `radial-gradient(circle, ${secondaryColor}33 1px, transparent 1px)`,
            backgroundSize: "12px 12px",
          }}
        />
      )
    case "WAVES":
      return (
        <div style={bgStyle}>
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <pattern id="waves" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
                <path d="M0 10 Q10 0 20 10 T40 10" stroke={secondaryColor} strokeWidth="1" fill="none" opacity="0.2" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#waves)" />
          </svg>
        </div>
      )
    case "GEOMETRIC":
      return (
        <div
          style={{
            ...bgStyle,
            backgroundImage: `
              linear-gradient(45deg, ${secondaryColor}15 25%, transparent 25%),
              linear-gradient(-45deg, ${secondaryColor}15 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, ${secondaryColor}15 75%),
              linear-gradient(-45deg, transparent 75%, ${secondaryColor}15 75%)
            `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />
      )
    case "CHEVRON":
      return (
        <div style={bgStyle}>
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <pattern id="chevron" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M0 12 L12 0 L24 12 M0 24 L12 12 L24 24" stroke={secondaryColor} strokeWidth="1" fill="none" opacity="0.15" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#chevron)" />
          </svg>
        </div>
      )
    case "CROSSHATCH":
      return (
        <div
          style={{
            ...bgStyle,
            backgroundImage: `
              linear-gradient(45deg, ${secondaryColor}10 1px, transparent 1px),
              linear-gradient(-45deg, ${secondaryColor}10 1px, transparent 1px)
            `,
            backgroundSize: "12px 12px",
          }}
        />
      )
    case "DIAMONDS":
      return (
        <div
          style={{
            ...bgStyle,
            backgroundImage: `
              linear-gradient(45deg, ${secondaryColor}12 25%, transparent 25%, transparent 75%, ${secondaryColor}12 75%),
              linear-gradient(45deg, ${secondaryColor}12 25%, transparent 25%, transparent 75%, ${secondaryColor}12 75%)
            `,
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 8px 8px",
          }}
        />
      )
    case "CONFETTI":
      return (
        <div style={bgStyle}>
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <pattern id="confetti" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="1.5" fill={secondaryColor} opacity="0.2" />
                <circle cx="20" cy="12" r="1" fill={secondaryColor} opacity="0.15" />
                <circle cx="10" cy="25" r="1.5" fill={secondaryColor} opacity="0.2" />
                <circle cx="25" cy="22" r="1" fill={secondaryColor} opacity="0.15" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#confetti)" />
          </svg>
        </div>
      )
    default:
      return <div style={bgStyle} />
  }
}

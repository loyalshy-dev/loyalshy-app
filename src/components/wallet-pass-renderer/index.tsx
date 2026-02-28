"use client"

import {
  formatProgressValue,
  formatLabel,
  getFieldLayout,
  type CardShape,
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
  shape: CardShape
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
  stripImagePosition?: { x: number; y: number }
  stripImageZoom?: number
}

type WalletPassRendererProps = {
  design: WalletPassDesign
  format?: PreviewFormat
  restaurantName?: string
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
}

// ─── Constants ──────────────────────────────────────────────

const SYSTEM_FONT = `-apple-system, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, sans-serif`
const CARD_WIDTH = 320
const CARD_HEIGHT = 440
const BORDER_RADIUS = 16

// ─── Component ──────────────────────────────────────────────

export function WalletPassRenderer({
  design,
  format = "apple",
  restaurantName = "Restaurant",
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
}: WalletPassRendererProps) {
  const layout = getFieldLayout(design.shape)
  const isApple = format === "apple"
  const resolvedLogo = isApple
    ? (logoAppleUrl ?? logoUrl ?? null)
    : (logoGoogleUrl ?? logoUrl ?? null)
  const useStrip = layout.apple.useStrip

  // Dimensions
  const baseW = width ?? CARD_WIDTH
  const baseH = height ?? CARD_HEIGHT

  // Scale for compact mode
  const scale = compact ? Math.min(baseW / CARD_WIDTH, baseH / CARD_HEIGHT, 1) : 1
  const outerW = compact ? baseW : CARD_WIDTH
  const outerH = compact ? baseH : CARD_HEIGHT

  // Build field values
  const progressText = formatProgressValue(
    currentVisits,
    totalVisits,
    design.progressStyle,
    hasReward,
    design.customProgressLabel ?? rewardDescription
  )

  const lbl = (text: string) => formatLabel(text, design.labelFormat)

  // Map field names to label+value pairs
  function resolveField(name: string) {
    switch (name) {
      case "restaurant":
        return { label: lbl("Restaurant"), value: restaurantName }
      case "progress":
        return { label: lbl(design.customProgressLabel || "Progress"), value: progressText }
      case "nextReward":
        return { label: lbl("Next Reward"), value: hasReward ? "Earned!" : rewardDescription }
      case "totalVisits":
        return { label: lbl("Visits"), value: `${currentVisits}/${totalVisits}` }
      case "customerName":
        return { label: lbl("Member"), value: customerName }
      case "memberSince":
        return { label: lbl("Since"), value: memberSince }
      case "memberNumber":
        return { label: lbl("Member #"), value: "0001" }
      default:
        return { label: name, value: "—" }
    }
  }

  const headerFields = layout.apple.header.map(resolveField)
  const primaryFields = layout.apple.primary.map(resolveField)
  const secondaryFields = layout.apple.secondary.map(resolveField)
  const auxiliaryFields = layout.apple.auxiliary.map(resolveField)

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
          borderRadius: BORDER_RADIUS,
          overflow: "hidden",
          backgroundColor: design.primaryColor,
          fontFamily: SYSTEM_FONT,
          color: design.textColor,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        }}
      >
        {/* ─── Header ─── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px 10px",
            flexShrink: 0,
          }}
        >
          {/* Logo — rectangular for Apple, circular for Google */}
          <div
            style={{
              width: isApple ? 48 : 36,
              height: isApple ? 15 : 36,
              borderRadius: isApple ? 3 : "50%",
              backgroundColor: isApple ? "transparent" : design.secondaryColor,
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
                  width: "100%",
                  height: "100%",
                  objectFit: isApple ? "contain" : "cover",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: isApple ? 11 : 14,
                  fontWeight: 700,
                  color: design.textColor,
                }}
              >
                {restaurantName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Restaurant name + optional header fields */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {restaurantName}
            </div>
            {headerFields.length > 1 && (
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>
                {headerFields[1].label}: {headerFields[1].value}
              </div>
            )}
          </div>

          {/* Apple Wallet logo indicator */}
          {isApple && (
            <div style={{ opacity: 0.4, fontSize: 10, fontWeight: 500 }}>
              ●●●
            </div>
          )}
        </div>

        {/* ─── Strip Image (SHOWCASE / INFO_RICH) ─── */}
        {useStrip && (() => {
          // Effective strip colors (independent from card background)
          const sc1 = design.stripColor1 ?? design.primaryColor
          const sc2 = design.stripColor2 ?? design.secondaryColor
          const isFlat = (design.stripFill ?? "gradient") === "flat"
          const pc = design.patternColor ?? sc2
          return (
          <div
            style={{
              height: 96,
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

            {/* Stamp grid overlay */}
            {design.useStampGrid && (
              <StampGridOverlay
                currentVisits={currentVisits}
                totalVisits={totalVisits}
                hasReward={hasReward}
                config={design.stampGridConfig}
                primaryColor={sc1}
                secondaryColor={sc2}
                textColor={design.textColor}
              />
            )}

            {/* SHOWCASE: progress text overlaid on strip (skip for stamp grid) */}
            {design.shape === "SHOWCASE" && !design.useStampGrid && (
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  left: 16,
                  right: 16,
                  fontSize: 22,
                  fontWeight: 700,
                  color: design.textColor,
                  textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {progressText}
              </div>
            )}
          </div>
          )
        })()}

        {/* ─── Primary Fields ─── */}
        {design.shape !== "SHOWCASE" && (
          <div style={{ padding: "12px 16px 8px" }}>
            {primaryFields.map((f, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 400,
                    opacity: 0.6,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 2,
                  }}
                >
                  {f.label}
                </div>
                <div
                  style={{
                    fontSize: 22,
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
        )}

        {/* ─── Secondary Fields ─── */}
        <div style={{ padding: "8px 16px" }}>
          <FieldSection
            fields={secondaryFields}
            textColor={design.textColor}
            compact={compact}
          />
        </div>

        {/* ─── Auxiliary Fields ─── */}
        <div style={{ padding: "4px 16px" }}>
          <FieldSection
            fields={auxiliaryFields}
            textColor={design.textColor}
            compact={compact}
          />
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ─── Divider ─── */}
        <div
          style={{
            margin: "0 16px",
            height: 1,
            backgroundColor: design.textColor,
            opacity: 0.12,
          }}
        />

        {/* ─── QR Code placeholder ─── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 16px 14px",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              backgroundColor: "#ffffff",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QrPlaceholder size={64} />
          </div>
        </div>
      </div>
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
}: {
  currentVisits: number
  totalVisits: number
  hasReward: boolean
  config?: StampGridConfig
  primaryColor: string
  secondaryColor: string
  textColor: string
}) {
  const stampIcon = config?.stampIcon ?? "coffee"
  const customStampIconUrl = config?.customStampIconUrl ?? null
  const rewardIconId = config?.rewardIcon ?? "gift"
  const stampShape = config?.stampShape ?? "circle"
  const filledStyle = config?.filledStyle ?? "icon"
  const iconScale = config?.stampIconScale ?? 0.6
  const totalSlots = totalVisits
  const cols = totalSlots <= 5 ? totalSlots : Math.ceil(totalSlots / 2)
  const rows = Math.ceil(totalSlots / cols)

  const slotSize = Math.min(
    Math.floor((320 - (cols + 1) * 4) / cols),
    Math.floor((96 - (rows + 1) * 3) / rows),
    36
  )

  const borderRadius = stampShape === "circle" ? "50%" : stampShape === "rounded-square" ? "20%" : "0"

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 8px",
        zIndex: 1,
        backgroundColor: "rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${slotSize}px)`,
          gap: 3,
        }}
      >
        {Array.from({ length: totalSlots }, (_, i) => {
          const isRewardSlot = i === totalVisits - 1
          const isFilled = i < currentVisits

          if (isRewardSlot) {
            const rewardPaths = getRewardIconPaths(rewardIconId)
            const rewardFilled = hasReward || isFilled
            return (
              <div
                key={i}
                style={{
                  width: slotSize,
                  height: slotSize,
                  borderRadius,
                  border: `2px solid ${hasReward ? "#d4a017" : secondaryColor}${rewardFilled ? "88" : "44"}`,
                  backgroundColor: hasReward ? "#d4a01720" : rewardFilled ? secondaryColor : `${primaryColor}60`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width={slotSize * iconScale}
                  height={slotSize * iconScale}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={rewardFilled ? primaryColor : textColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: rewardFilled ? 1 : 0.5 }}
                  dangerouslySetInnerHTML={{ __html: rewardPaths }}
                />
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

          // Empty slot
          return (
            <div
              key={i}
              style={{
                width: slotSize,
                height: slotSize,
                borderRadius,
                border: `1.5px solid ${secondaryColor}55`,
                backgroundColor: `${primaryColor}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: slotSize * 0.35,
                fontWeight: 500,
                color: textColor,
                opacity: 0.5,
              }}
            >
              {i + 1}
            </div>
          )
        })}
      </div>
    </div>
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

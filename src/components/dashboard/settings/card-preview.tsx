"use client"

import { useState } from "react"
import type { CardShape, PatternStyle, ProgressStyle, FontFamily, LabelFormat } from "@/lib/wallet/card-design"
import { formatProgressValue, formatLabel } from "@/lib/wallet/card-design"

// Deterministic QR placeholder pattern (avoids Math.random hydration mismatch)
const QR_PATTERN = [1,0,1,1,0,0,1,0,1,1,1,0,0,1,0,1,1,0,0,1,0,1,1,0,1]

export type CardPreviewZone = "colors" | "strip" | "progress" | "typography" | "logo"

type CardPreviewProps = {
  restaurantName: string
  logoUrl: string | null
  shape: CardShape
  primaryColor: string
  secondaryColor: string
  textColor: string
  patternStyle: PatternStyle
  progressStyle: ProgressStyle
  fontFamily: FontFamily
  labelFormat: LabelFormat
  customProgressLabel: string | null
  stripImageUrl: string | null
  customMessage: string | null
  rewardDescription?: string
  visitsRequired?: number
  hideTabSelector?: boolean
  onZoneClick?: (zone: CardPreviewZone) => void
  /** CSS background for the strip area — used by templates with gradient/image strip designs */
  stripCss?: string | null
}

type PreviewTab = "apple" | "google" | "web"

const FONT_CSS_MAP: Record<FontFamily, string> = {
  SANS: "inherit",
  SERIF: "Georgia, Cambria, 'Times New Roman', serif",
  ROUNDED: "'SF Pro Rounded', system-ui, sans-serif",
  MONO: "var(--font-geist-mono), 'Courier New', monospace",
}

export function CardPreview({
  restaurantName,
  logoUrl,
  shape,
  primaryColor,
  secondaryColor,
  textColor,
  patternStyle,
  progressStyle,
  fontFamily,
  labelFormat,
  customProgressLabel,
  stripImageUrl,
  customMessage,
  rewardDescription = "Free Coffee",
  visitsRequired = 10,
  hideTabSelector = false,
  onZoneClick,
  stripCss,
}: CardPreviewProps) {
  const [tab, setTab] = useState<PreviewTab>("apple")

  const showStrip = shape !== "CLEAN"
  const effectiveStripUrl = showStrip ? stripImageUrl : null

  const progressValue = formatProgressValue(3, visitsRequired, progressStyle, false)
  const progressLabel = customProgressLabel || "PROGRESS"

  return (
    <div className="space-y-3">
      {/* Tab selector */}
      {!hideTabSelector && (
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["apple", "google", "web"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "apple" ? "Apple" : t === "google" ? "Google" : "Web"}
            </button>
          ))}
        </div>
      )}

      {/* Preview card */}
      <div className="flex justify-center relative">
        {/* Clickable zone overlays */}
        {onZoneClick && tab !== "web" && (
          <div className="absolute inset-0 z-10">
            {/* Logo zone */}
            <button
              type="button"
              onClick={() => onZoneClick("logo")}
              aria-label="Edit logo"
              className="absolute top-3 left-3 w-10 h-10 rounded-md border-2 border-transparent hover:border-dashed hover:border-foreground/40 transition-all cursor-pointer"
              title="Logo"
            />
            {/* Colors zone — background area */}
            <button
              type="button"
              onClick={() => onZoneClick("colors")}
              aria-label="Edit colors"
              className="absolute top-0 right-0 w-1/3 h-12 rounded-md border-2 border-transparent hover:border-dashed hover:border-foreground/40 transition-all cursor-pointer"
              title="Colors"
            />
            {/* Strip zone */}
            {showStrip && (
              <button
                type="button"
                onClick={() => onZoneClick("strip")}
                aria-label="Edit strip image"
                className="absolute left-2 right-2 rounded-md border-2 border-transparent hover:border-dashed hover:border-foreground/40 transition-all cursor-pointer"
                style={{ top: "15%", height: "30%" }}
                title="Strip / Background"
              />
            )}
            {/* Progress zone */}
            <button
              type="button"
              onClick={() => onZoneClick("progress")}
              aria-label="Edit progress style"
              className="absolute left-2 right-2 rounded-md border-2 border-transparent hover:border-dashed hover:border-foreground/40 transition-all cursor-pointer"
              style={{ top: showStrip ? "48%" : "25%", height: "15%" }}
              title="Progress"
            />
            {/* Typography zone */}
            <button
              type="button"
              onClick={() => onZoneClick("typography")}
              aria-label="Edit typography"
              className="absolute left-2 right-2 rounded-md border-2 border-transparent hover:border-dashed hover:border-foreground/40 transition-all cursor-pointer"
              style={{ bottom: "18%", height: "15%" }}
              title="Typography"
            />
          </div>
        )}
        {tab === "apple" && (
          <ApplePreview
            restaurantName={restaurantName}
            logoUrl={logoUrl}
            shape={shape}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            textColor={textColor}
            patternStyle={patternStyle}
            stripImageUrl={effectiveStripUrl}
            rewardDescription={rewardDescription}
            visitsRequired={visitsRequired}
            progressStyle={progressStyle}
            progressValue={progressValue}
            progressLabel={formatLabel(progressLabel, labelFormat)}
            labelFormat={labelFormat}
            stripCss={stripCss}
          />
        )}
        {tab === "google" && (
          <GooglePreview
            restaurantName={restaurantName}
            logoUrl={logoUrl}
            shape={shape}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            textColor={textColor}
            patternStyle={patternStyle}
            stripImageUrl={effectiveStripUrl}
            rewardDescription={rewardDescription}
            visitsRequired={visitsRequired}
            progressStyle={progressStyle}
            progressValue={progressValue}
            progressLabel={formatLabel(progressLabel, labelFormat)}
            labelFormat={labelFormat}
            stripCss={stripCss}
          />
        )}
        {tab === "web" && (
          <WebPreview
            restaurantName={restaurantName}
            logoUrl={logoUrl}
            shape={shape}
            primaryColor={primaryColor}
            textColor={textColor}
            stripImageUrl={effectiveStripUrl}
            stripCss={stripCss}
            customMessage={customMessage}
            rewardDescription={rewardDescription}
            visitsRequired={visitsRequired}
            fontFamily={fontFamily}
          />
        )}
      </div>
    </div>
  )
}

// ─── Stamp Grid (physical stamp card) ───────────────────────
//
// Mimics a real loyalty stamp card:
//   - Each stamp is a circle with the visit number inside
//   - Filled stamps show the restaurant logo as a watermark + number
//   - Empty stamps are faded outlines with the number visible
//   - The last position is the reward stamp (gift icon + accent color)
//   - A slight rotation on filled stamps for a "hand-stamped" feel

// Deterministic rotation per stamp (no Math.random)
const STAMP_ROTATIONS = [2, -3, 1, -2, 3, -1, 2, -3, 1, -2, 3, -1, 2, -3, 1]

function StampGrid({
  current,
  total,
  filledColor,
  emptyColor,
  accentColor,
  logoUrl,
  size = 18,
}: {
  current: number
  total: number
  filledColor: string
  emptyColor: string
  accentColor?: string
  logoUrl?: string | null
  size?: number
}) {
  const cols = total <= 5 ? total : total <= 10 ? 5 : Math.ceil(Math.sqrt(total))
  const fontSize = size <= 20 ? Math.max(7, Math.round(size * 0.4)) : Math.round(size * 0.35)
  // Total includes N visit stamps + 1 reward stamp at the end
  const stampCount = total + 1

  return (
    <div
      className="flex flex-wrap justify-center"
      style={{ gap: Math.max(4, Math.round(size * 0.2)), maxWidth: cols * (size + Math.round(size * 0.25)) }}
    >
      {Array.from({ length: stampCount }).map((_, i) => {
        const isReward = i === total
        const filled = isReward ? current >= total : i < current
        const rotation = filled ? STAMP_ROTATIONS[i % STAMP_ROTATIONS.length] : 0
        const stampBg = isReward
          ? (filled ? (accentColor ?? filledColor) : "transparent")
          : (filled ? filledColor : "transparent")
        const borderCol = isReward ? (accentColor ?? filledColor) : filledColor

        return (
          <div
            key={i}
            className="rounded-full flex items-center justify-center shrink-0 relative overflow-hidden"
            style={{
              width: size,
              height: size,
              backgroundColor: stampBg,
              border: `1.5px ${filled ? "solid" : "dashed"} ${filled ? borderCol : emptyColor}`,
              opacity: filled ? 1 : 0.3,
              transform: filled ? `rotate(${rotation}deg)` : undefined,
            }}
          >
            {/* Logo watermark behind the number on filled visit stamps */}
            {filled && !isReward && logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.25 }}
              />
            )}

            {isReward ? (
              /* Reward stamp: gift/star icon */
              <svg
                width={size * 0.5}
                height={size * 0.5}
                viewBox="0 0 16 16"
                fill="none"
                style={{ position: "relative" }}
              >
                <path
                  d="M8 1l1.8 3.6L14 5.3l-3 2.9.7 4.1L8 10.5 4.3 12.3l.7-4.1-3-2.9 4.2-.7L8 1z"
                  fill={filled ? emptyColor : filledColor}
                  opacity={filled ? 1 : 0.5}
                />
              </svg>
            ) : (
              /* Visit stamp: number */
              <span
                style={{
                  fontSize,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: filled ? emptyColor : filledColor,
                  position: "relative",
                  textShadow: filled && logoUrl ? `0 0 2px ${filledColor}` : undefined,
                }}
              >
                {i + 1}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Apple Preview ──────────────────────────────────────────

export function ApplePreview({
  restaurantName,
  logoUrl,
  shape,
  primaryColor,
  secondaryColor,
  textColor,
  patternStyle,
  stripImageUrl,
  rewardDescription,
  visitsRequired,
  progressStyle,
  progressValue,
  progressLabel,
  labelFormat,
  stripCss,
}: {
  restaurantName: string
  logoUrl: string | null
  shape: CardShape
  primaryColor: string
  secondaryColor: string
  textColor: string
  patternStyle: PatternStyle
  stripImageUrl: string | null
  rewardDescription: string
  visitsRequired: number
  progressStyle: ProgressStyle
  progressValue: string
  progressLabel: string
  labelFormat: LabelFormat
  stripCss?: string | null
}) {
  const showStrip = shape !== "CLEAN"
  const isStamps = progressStyle === "STAMPS"

  // Stamps mode: background image behind stamp grid, solid below
  if (isStamps) {
    return (
      <div
        className="w-full max-w-[280px] rounded-xl overflow-hidden shadow-lg"
        style={{ backgroundColor: primaryColor }}
      >
        {/* Header: logo + name on left, customer name on right */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-md" style={{ backgroundColor: secondaryColor, opacity: 0.3 }} />
            )}
            <span className="text-sm font-semibold truncate" style={{ color: textColor, opacity: 0.9 }}>
              {restaurantName}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[10px]" style={{ color: textColor, opacity: 0.6 }}>{formatLabel("NAME", labelFormat)}</div>
            <div className="text-[11px] font-medium" style={{ color: textColor }}>John Doe</div>
          </div>
        </div>

        {/* Stamp zone with background image */}
        <div className="relative mx-0 overflow-hidden" style={{ minHeight: 110 }}>
          {/* Background: strip image, pattern, stripCss, or gradient */}
          <div className="absolute inset-0">
            {stripImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stripImageUrl} alt="" className="w-full h-full object-cover" />
            ) : patternStyle !== "NONE" ? (
              <PatternBackground primaryColor={primaryColor} secondaryColor={secondaryColor} pattern={patternStyle} />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: stripCss || `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 60%, ${secondaryColor}), ${primaryColor})`,
                }}
              />
            )}
          </div>
          {/* Stamp grid overlaid */}
          <div className="relative flex items-center justify-center px-3 py-4">
            <StampGrid
              current={3}
              total={visitsRequired}
              filledColor={secondaryColor}
              emptyColor={textColor}
              accentColor={secondaryColor}
              logoUrl={logoUrl}
              size={38}
            />
          </div>
        </div>

        {/* Info bar: reward + visits count — solid bg */}
        <div className="px-4 py-2.5 flex justify-between text-[10px]" style={{ borderTop: `1px solid ${textColor}15` }}>
          <div>
            <div style={{ color: textColor, opacity: 0.6 }}>{formatLabel("NEXT REWARD", labelFormat)}</div>
            <div className="mt-0.5 text-[11px] font-medium truncate max-w-[140px]" style={{ color: textColor }}>
              {rewardDescription}
            </div>
          </div>
          <div className="text-right">
            <div style={{ color: textColor, opacity: 0.6 }}>{formatLabel("TOTAL VISITS", labelFormat)}</div>
            <div className="mt-0.5 text-[11px] font-medium" style={{ color: textColor }}>15</div>
          </div>
        </div>

        {/* QR code */}
        <div className="flex justify-center pb-4 pt-1">
          <div className="w-16 h-16 rounded-md bg-white flex items-center justify-center">
            <div className="grid grid-cols-5 gap-[2px]">
              {QR_PATTERN.map((v, i) => (
                <div key={i} className="w-[4px] h-[4px] rounded-[0.5px]" style={{ backgroundColor: v ? "#000" : "#fff" }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Non-stamps: original layout
  return (
    <div
      className="w-full max-w-[280px] rounded-xl overflow-hidden shadow-lg"
      style={{ backgroundColor: primaryColor }}
    >
      {/* Logo + Name header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
        ) : (
          <div className="h-7 w-7 rounded-md" style={{ backgroundColor: secondaryColor, opacity: 0.3 }} />
        )}
        <span className="text-sm font-semibold truncate" style={{ color: textColor, opacity: 0.9 }}>
          {restaurantName}
        </span>
      </div>

      {/* Strip image area */}
      {showStrip && (
        <div className="relative h-[96px] mx-3 my-1 rounded-lg overflow-hidden">
          {stripImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stripImageUrl} alt="" className="w-full h-full object-cover" />
          ) : patternStyle !== "NONE" ? (
            <PatternBackground primaryColor={primaryColor} secondaryColor={secondaryColor} pattern={patternStyle} />
          ) : (
            <div className="w-full h-full" style={{ background: stripCss || `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }} />
          )}
          {shape === "SHOWCASE" && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
              <div className="text-center" style={{ color: "#ffffff" }}>
                <div className="text-lg font-bold leading-tight break-all px-2">{progressValue}</div>
                <div className="text-[10px] opacity-80 mt-0.5">{progressLabel}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary field */}
      {shape !== "SHOWCASE" && (
        <div className="px-4 py-3 text-center">
          <div className="text-lg font-bold leading-tight break-all" style={{ color: textColor }}>{progressValue}</div>
          <div className="text-[10px] mt-0.5" style={{ color: textColor, opacity: 0.6 }}>{progressLabel}</div>
        </div>
      )}

      {/* Secondary fields */}
      <div className="px-4 pb-2 flex justify-between text-[10px]">
        <div>
          <div style={{ color: textColor, opacity: 0.6 }}>{formatLabel("NEXT REWARD", labelFormat)}</div>
          <div className="mt-0.5 text-[11px] font-medium truncate max-w-[120px]" style={{ color: textColor }}>{rewardDescription}</div>
        </div>
        {shape !== "SHOWCASE" && (
          <div className="text-right">
            <div style={{ color: textColor, opacity: 0.6 }}>{formatLabel("TOTAL VISITS", labelFormat)}</div>
            <div className="mt-0.5 text-[11px] font-medium" style={{ color: textColor }}>15</div>
          </div>
        )}
      </div>

      {/* Auxiliary fields */}
      <div className="px-4 pb-3 flex justify-between text-[10px]">
        {shape === "INFO_RICH" && (
          <div>
            <div style={{ color: textColor, opacity: 0.6 }}>{formatLabel("MEMBER SINCE", labelFormat)}</div>
            <div className="mt-0.5 text-[11px] font-medium" style={{ color: textColor }}>Jan 2026</div>
          </div>
        )}
        <div className={shape !== "INFO_RICH" ? "" : "text-right"}>
          {shape !== "INFO_RICH" && (
            <>
              <div style={{ color: textColor, opacity: 0.6 }}>{formatLabel("MEMBER SINCE", labelFormat)}</div>
              <div className="mt-0.5 text-[11px] font-medium" style={{ color: textColor }}>Jan 2026</div>
            </>
          )}
        </div>
        <div className="text-right">
          <div style={{ color: textColor, opacity: 0.6 }}>{formatLabel("NAME", labelFormat)}</div>
          <div className="mt-0.5 text-[11px] font-medium" style={{ color: textColor }}>John Doe</div>
        </div>
      </div>

      {/* QR code placeholder */}
      <div className="flex justify-center pb-4 pt-1">
        <div className="w-16 h-16 rounded-md bg-white flex items-center justify-center">
          <div className="grid grid-cols-5 gap-[2px]">
            {QR_PATTERN.map((v, i) => (
              <div key={i} className="w-[4px] h-[4px] rounded-[0.5px]" style={{ backgroundColor: v ? "#000" : "#fff" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Google Preview ─────────────────────────────────────────

export function GooglePreview({
  restaurantName,
  logoUrl,
  shape,
  primaryColor,
  secondaryColor,
  textColor,
  patternStyle,
  stripImageUrl,
  rewardDescription,
  visitsRequired,
  progressStyle,
  progressValue,
  progressLabel,
  labelFormat,
  stripCss,
}: {
  restaurantName: string
  logoUrl: string | null
  shape: CardShape
  primaryColor: string
  secondaryColor: string
  textColor: string
  patternStyle: PatternStyle
  stripImageUrl: string | null
  rewardDescription: string
  visitsRequired: number
  progressStyle: ProgressStyle
  progressValue: string
  progressLabel: string
  labelFormat: LabelFormat
  stripCss?: string | null
}) {
  const showHero = shape !== "CLEAN"
  const isStamps = progressStyle === "STAMPS"

  // Stamps mode: background image behind stamp grid, solid below
  if (isStamps) {
    return (
      <div
        className="w-full max-w-[280px] rounded-xl overflow-hidden shadow-lg"
        style={{ backgroundColor: primaryColor }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-full" style={{ backgroundColor: textColor, opacity: 0.15 }} />
            )}
            <div>
              <div className="text-sm font-semibold" style={{ color: textColor }}>{restaurantName}</div>
              <div className="text-[10px]" style={{ color: textColor, opacity: 0.6 }}>Loyalty Card</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px]" style={{ color: textColor, opacity: 0.6 }}>{formatLabel("NAME", labelFormat)}</div>
            <div className="text-[11px] font-medium" style={{ color: textColor }}>John Doe</div>
          </div>
        </div>

        {/* Stamp zone with background image */}
        <div className="relative mx-0 overflow-hidden" style={{ minHeight: 100 }}>
          <div className="absolute inset-0">
            {stripImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stripImageUrl} alt="" className="w-full h-full object-cover" />
            ) : patternStyle !== "NONE" ? (
              <PatternBackground primaryColor={primaryColor} secondaryColor={secondaryColor} pattern={patternStyle} />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: stripCss || `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 60%, ${secondaryColor}), ${primaryColor})`,
                }}
              />
            )}
          </div>
          <div className="relative flex items-center justify-center px-3 py-4">
            <StampGrid
              current={3}
              total={visitsRequired}
              filledColor={secondaryColor}
              emptyColor={textColor}
              accentColor={secondaryColor}
              logoUrl={logoUrl}
              size={34}
            />
          </div>
        </div>

        {/* Info bar: reward + visits count — solid bg */}
        <div className="px-4 py-2.5 flex justify-between text-[10px]" style={{ borderTop: `1px solid ${textColor}15` }}>
          <div>
            <div style={{ color: textColor, opacity: 0.6 }}>{formatLabel("NEXT REWARD", labelFormat)}</div>
            <div className="mt-0.5 text-[11px] font-medium truncate max-w-[140px]" style={{ color: textColor }}>
              {rewardDescription}
            </div>
          </div>
          <div className="text-right">
            <div style={{ color: textColor, opacity: 0.6 }}>{formatLabel("TOTAL VISITS", labelFormat)}</div>
            <div className="mt-0.5 text-[11px] font-medium" style={{ color: textColor }}>15</div>
          </div>
        </div>

        {/* QR barcode */}
        <div className="flex justify-center py-3 border-t" style={{ borderColor: `${textColor}10` }}>
          <div className="w-14 h-14 rounded bg-white flex items-center justify-center">
            <div className="grid grid-cols-5 gap-[2px]">
              {QR_PATTERN.map((v, i) => (
                <div
                  key={i}
                  className="w-[3.5px] h-[3.5px] rounded-[0.5px]"
                  style={{ backgroundColor: v ? "#000" : "#fff" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Non-stamps: original layout
  return (
    <div
      className="w-full max-w-[280px] rounded-xl overflow-hidden shadow-lg"
      style={{ backgroundColor: primaryColor }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full" style={{ backgroundColor: textColor, opacity: 0.15 }} />
        )}
        <div>
          <div className="text-sm font-semibold" style={{ color: textColor }}>{restaurantName}</div>
          <div className="text-[10px]" style={{ color: textColor, opacity: 0.6 }}>Loyalty Card</div>
        </div>
      </div>

      {/* Hero image */}
      {showHero && (
        <div className="mx-3 mb-2 h-[84px] rounded-lg overflow-hidden">
          {stripImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stripImageUrl} alt="" className="w-full h-full object-cover" />
          ) : patternStyle !== "NONE" ? (
            <PatternBackground primaryColor={primaryColor} secondaryColor={secondaryColor} pattern={patternStyle} />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: stripCss || `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 60%, white))`,
              }}
            />
          )}
        </div>
      )}

      {/* Text modules */}
      <div className="px-4 pb-2">
        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          <div>
            <div className="text-[9px] tracking-wider" style={{ color: textColor, opacity: 0.5 }}>{progressLabel}</div>
            <div className="text-xs font-semibold mt-0.5 break-all" style={{ color: textColor }}>{progressValue}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] tracking-wider" style={{ color: textColor, opacity: 0.5 }}>{formatLabel("TOTAL VISITS", labelFormat)}</div>
            <div className="text-sm font-semibold mt-0.5" style={{ color: textColor }}>15</div>
          </div>
          <div>
            <div className="text-[9px] tracking-wider" style={{ color: textColor, opacity: 0.5 }}>{formatLabel("NEXT REWARD", labelFormat)}</div>
            <div className="text-xs mt-0.5 truncate" style={{ color: textColor }}>{rewardDescription}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] tracking-wider" style={{ color: textColor, opacity: 0.5 }}>{formatLabel("MEMBER SINCE", labelFormat)}</div>
            <div className="text-xs mt-0.5" style={{ color: textColor }}>Jan 2026</div>
          </div>
          {shape === "INFO_RICH" && (
            <div className="col-span-2">
              <div className="text-[9px] tracking-wider" style={{ color: textColor, opacity: 0.5 }}>{formatLabel("NAME", labelFormat)}</div>
              <div className="text-xs mt-0.5" style={{ color: textColor }}>John Doe</div>
            </div>
          )}
        </div>
      </div>

      {/* QR barcode */}
      <div className="flex justify-center py-3 border-t" style={{ borderColor: `${textColor}10` }}>
        <div className="w-14 h-14 rounded bg-white flex items-center justify-center">
          <div className="grid grid-cols-5 gap-[2px]">
            {QR_PATTERN.map((v, i) => (
              <div
                key={i}
                className="w-[3.5px] h-[3.5px] rounded-[0.5px]"
                style={{ backgroundColor: v ? "#000" : "#fff" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Web Preview ────────────────────────────────────────────

export function WebPreview({
  restaurantName,
  logoUrl,
  shape,
  primaryColor,
  textColor,
  stripImageUrl,
  stripCss,
  customMessage,
  rewardDescription,
  visitsRequired,
  fontFamily,
}: {
  restaurantName: string
  logoUrl: string | null
  shape: CardShape
  primaryColor: string
  textColor: string
  stripImageUrl: string | null
  stripCss?: string | null
  customMessage: string | null
  rewardDescription: string
  visitsRequired: number
  fontFamily: FontFamily
}) {
  const hasHeroBackground = stripImageUrl || stripCss
  return (
    <div
      className="w-full max-w-[280px] rounded-xl overflow-hidden shadow-lg bg-background border border-border"
      style={{ fontFamily: FONT_CSS_MAP[fontFamily] }}
    >
      {/* Hero area for SHOWCASE */}
      {shape === "SHOWCASE" && hasHeroBackground && (
        <div className="relative h-[100px]">
          {stripImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stripImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: stripCss || undefined }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover border border-white/20" />
            )}
            <div className="text-white font-semibold text-sm">{restaurantName}</div>
          </div>
        </div>
      )}

      {/* Standard header */}
      {(shape !== "SHOWCASE" || !hasHeroBackground) && (
        <div className="p-4 text-center space-y-2">
          {logoUrl && (
            <div className="mx-auto w-12 h-12 rounded-xl overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="text-sm font-semibold">{restaurantName}</div>
        </div>
      )}

      {/* Reward badge */}
      <div className="px-4 pb-3">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
          style={{
            backgroundColor: `color-mix(in oklch, ${primaryColor} 12%, transparent)`,
            color: primaryColor,
          }}
        >
          Earn {rewardDescription} after {visitsRequired} visits
        </div>
      </div>

      {/* Custom message for INFO_RICH */}
      {shape === "INFO_RICH" && customMessage && (
        <div className="px-4 pb-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {customMessage}
          </p>
        </div>
      )}

      {/* Form placeholder */}
      <div className="px-4 pb-4 space-y-2">
        <div className="h-8 rounded-md bg-muted" />
        <div className="h-8 rounded-md bg-muted" />
        <div
          className="h-9 rounded-md flex items-center justify-center text-[11px] font-medium"
          style={{ backgroundColor: primaryColor, color: textColor }}
        >
          Add to Wallet
        </div>
      </div>
    </div>
  )
}

// ─── Pattern Background ─────────────────────────────────────

export function PatternBackground({
  primaryColor,
  secondaryColor,
  pattern,
}: {
  primaryColor: string
  secondaryColor: string
  pattern: PatternStyle
}) {
  // Flat solid colors — no gradient, no overlay
  if (pattern === "SOLID_PRIMARY") {
    return <div className="w-full h-full" style={{ backgroundColor: primaryColor }} />
  }
  if (pattern === "SOLID_SECONDARY") {
    return <div className="w-full h-full" style={{ backgroundColor: secondaryColor }} />
  }

  return (
    <div
      className="w-full h-full relative"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 70%, ${secondaryColor}))`,
      }}
    >
      {pattern === "DOTS" && (
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle, ${secondaryColor}20 1.5px, transparent 1.5px)`,
          backgroundSize: "12px 12px",
        }} />
      )}
      {pattern === "WAVES" && (
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {[0.2, 0.4, 0.6, 0.8].map((y, i) => (
            <path
              key={i}
              d={`M0,${y * 100}% Q25%,${(y - 0.1) * 100}% 50%,${y * 100}% T100%,${y * 100}%`}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="1"
              opacity={0.15 + i * 0.05}
            />
          ))}
        </svg>
      )}
      {pattern === "GEOMETRIC" && (
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 15px, ${secondaryColor}08 15px, ${secondaryColor}08 16px)`,
        }} />
      )}
      {pattern === "CHEVRON" && (
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(60deg, transparent, transparent 12px, ${secondaryColor}15 12px, ${secondaryColor}15 13px), repeating-linear-gradient(-60deg, transparent, transparent 12px, ${secondaryColor}15 12px, ${secondaryColor}15 13px)`,
        }} />
      )}
      {pattern === "CROSSHATCH" && (
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${secondaryColor}12 10px, ${secondaryColor}12 11px), repeating-linear-gradient(-45deg, transparent, transparent 10px, ${secondaryColor}12 10px, ${secondaryColor}12 11px)`,
        }} />
      )}
      {pattern === "DIAMONDS" && (
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 14px, ${secondaryColor}18 14px, ${secondaryColor}18 15px), repeating-linear-gradient(-45deg, transparent, transparent 14px, ${secondaryColor}18 14px, ${secondaryColor}18 15px)`,
          backgroundSize: "21px 21px",
        }} />
      )}
      {pattern === "CONFETTI" && (
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle 2px, ${secondaryColor}25 100%, transparent 100%), radial-gradient(circle 1.5px, ${secondaryColor}20 100%, transparent 100%), radial-gradient(circle 2.5px, ${secondaryColor}18 100%, transparent 100%), radial-gradient(circle 1.5px, ${secondaryColor}22 100%, transparent 100%)`,
          backgroundSize: "24px 24px, 18px 32px, 30px 20px, 22px 28px",
          backgroundPosition: "0 0, 8px 12px, 16px 4px, 4px 20px",
        }} />
      )}
    </div>
  )
}

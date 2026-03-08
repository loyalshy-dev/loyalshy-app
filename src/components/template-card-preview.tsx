import { WalletPassRenderer } from "@/components/wallet-pass-renderer"
import { buildWalletPassDesign } from "@/lib/wallet/build-wallet-pass-design"
import {
  parseCouponConfig,
  parseMembershipConfig,
  formatCouponValue,
  parsePrepaidConfig,
  parseGiftCardConfig,
  parseTicketConfig,
  parseAccessConfig,
  parseTransitConfig,
  parseBusinessIdConfig,
} from "@/lib/pass-config"

// ─── Types ──────────────────────────────────────────────────

/** Minimal template shape accepted by TemplateCardPreview */
export type CardPreviewTemplate = {
  name: string
  passType: string
  config: unknown
  passDesign: {
    cardType?: string | null
    showStrip?: boolean
    primaryColor?: string | null
    secondaryColor?: string | null
    textColor?: string | null
    patternStyle?: string | null
    progressStyle?: string | null
    fontFamily?: string | null
    labelFormat?: string | null
    customProgressLabel?: string | null
    stripImageUrl?: string | null
    editorConfig?: unknown
  } | null
}

type TemplateCardPreviewProps = {
  /** Template data — name, passType, config, passDesign */
  template: CardPreviewTemplate
  /** Organization logo URL */
  logoUrl?: string | null
  /** Apple-specific logo URL */
  logoAppleUrl?: string | null
  /** Google-specific logo URL */
  logoGoogleUrl?: string | null
  /** Organization name (shown when no logo) */
  organizationName?: string
  /** Wallet format */
  format?: "apple" | "google"
  /** Compact mode (scaled down) */
  compact?: boolean
  /** Card width in px */
  width?: number
  /** Card height in px */
  height?: number
  /** CSS class */
  className?: string
  /** Inline styles */
  style?: React.CSSProperties
  // ─── Data overrides (defaults derived from template config) ──
  /** Override filled stamps/visits (default: 4 for preview) */
  currentVisits?: number
  /** Override total stamps required */
  totalVisits?: number
  /** Override reward description */
  rewardDescription?: string
  /** Customer name */
  customerName?: string
  /** Whether a reward is available */
  hasReward?: boolean
  /** QR code value */
  qrValue?: string
  /** Member since date string */
  memberSince?: string
  // ─── Prepaid overrides (for live data) ──
  /** Override remaining uses (default: totalUses from config) */
  remainingUses?: number
}

// ─── Helper: build all type-specific renderer props from config ──

function buildTypeProps(passType: string, config: unknown) {
  const props: Record<string, unknown> = {}

  switch (passType) {
    case "STAMP_CARD": {
      // stampsRequired and rewardDescription handled via totalVisits/rewardDescription defaults
      break
    }
    case "COUPON": {
      const c = parseCouponConfig(config)
      if (c) {
        props.discountText = formatCouponValue(c)
        props.couponCode = c.couponCode ?? undefined
        props.validUntil = c.validUntil
          ? new Date(c.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "No expiry"
      }
      break
    }
    case "MEMBERSHIP": {
      const c = parseMembershipConfig(config)
      if (c) {
        props.tierName = c.membershipTier
        props.benefits = c.benefits
      }
      break
    }
    case "PREPAID": {
      const c = parsePrepaidConfig(config)
      if (c) {
        props.remainingUses = c.totalUses
        props.totalUses = c.totalUses
        props.prepaidValidUntil = c.validUntil
          ? new Date(c.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "No expiry"
      }
      break
    }
    case "GIFT_CARD": {
      const c = parseGiftCardConfig(config)
      if (c) {
        const formatted = `${c.currency} ${(c.initialBalanceCents / 100).toFixed(2)}`
        props.giftBalance = formatted
        props.giftInitialValue = formatted
      }
      break
    }
    case "TICKET": {
      const c = parseTicketConfig(config)
      if (c) {
        props.eventName = c.eventName
        props.eventDate = c.eventDate
          ? new Date(c.eventDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          : undefined
        props.eventVenue = c.eventVenue
        props.scanStatus = `0 / ${c.maxScans}`
      }
      break
    }
    case "ACCESS": {
      const c = parseAccessConfig(config)
      if (c) props.accessLabel = c.accessLabel
      props.accessGranted = "0"
      break
    }
    case "TRANSIT": {
      const c = parseTransitConfig(config)
      if (c) {
        props.transitType = c.transitType?.toUpperCase()
        props.originName = c.originName
        props.destinationName = c.destinationName
      }
      props.boardingStatus = "NOT BOARDED"
      break
    }
    case "BUSINESS_ID": {
      const c = parseBusinessIdConfig(config)
      if (c) props.idLabel = c.idLabel
      props.verifications = "0"
      break
    }
  }

  return props
}

// ─── Component ──────────────────────────────────────────────

export function TemplateCardPreview({
  template,
  logoUrl,
  logoAppleUrl,
  logoGoogleUrl,
  organizationName,
  format = "apple",
  compact,
  width,
  height,
  className,
  style,
  currentVisits,
  totalVisits,
  rewardDescription,
  customerName,
  hasReward,
  qrValue,
  memberSince,
  remainingUses,
}: TemplateCardPreviewProps) {
  const design = buildWalletPassDesign(template.passDesign)
  const typeProps = buildTypeProps(template.passType, template.config)

  // Derive defaults from stamp card config
  const cfg = (template.config as Record<string, unknown> | null) ?? {}
  const defaultTotalVisits = (cfg as { stampsRequired?: number }).stampsRequired ?? 10
  const defaultRewardDescription = (cfg as { rewardDescription?: string }).rewardDescription ?? ""

  // Apply remainingUses override (for live prepaid data)
  if (remainingUses !== undefined) {
    typeProps.remainingUses = remainingUses
  }

  return (
    <WalletPassRenderer
      design={design}
      format={format}
      logoUrl={logoUrl}
      logoAppleUrl={logoAppleUrl}
      logoGoogleUrl={logoGoogleUrl}
      organizationName={organizationName}
      programName={template.name}
      currentVisits={currentVisits ?? 4}
      totalVisits={totalVisits ?? defaultTotalVisits}
      rewardDescription={rewardDescription ?? defaultRewardDescription}
      customerName={customerName}
      hasReward={hasReward}
      qrValue={qrValue}
      memberSince={memberSince}
      compact={compact}
      width={width}
      height={height}
      className={className}
      style={style}
      {...typeProps}
    />
  )
}

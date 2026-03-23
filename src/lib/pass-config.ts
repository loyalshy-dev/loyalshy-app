import { z } from "zod"
import type {
  PassType,
  StampCardConfig,
  CouponConfig,
  MembershipConfig,
  PointsConfig,
  GiftCardConfig,
  TicketConfig,
  MinigameConfig,
  PassTemplateConfig,
} from "@/types/pass-types"

// ─── Zod schemas ────────────────────────────────────────────

export const stampCardConfigSchema = z.object({
  stampsRequired: z.number().int().min(2).max(50),
  rewardDescription: z.string().min(1).max(200),
  rewardExpiryDays: z.number().int().min(0).max(365),
  minigame: z
    .object({
      enabled: z.boolean(),
      gameType: z.enum(["scratch", "slots", "wheel"]),
      prizes: z
        .array(z.object({ name: z.string().min(1).max(100), weight: z.number().int().min(1).max(10) }))
        .min(1)
        .max(8)
        .optional(),
      primaryColor: z.string().max(50).optional(),
      accentColor: z.string().max(50).optional(),
    })
    .optional(),
})

export const couponConfigSchema = z.object({
  discountType: z.enum(["percentage", "fixed", "freebie"]),
  discountValue: z.number().min(0).max(10000),
  couponCode: z.string().max(50).optional(),
  couponDescription: z.string().max(200).optional(),
  validUntil: z.string().optional(),
  redemptionLimit: z.enum(["single", "unlimited"]),
  rewardDescription: z.string().max(200).optional(),
  terms: z.string().max(5000).optional(),
  minigame: z
    .object({
      enabled: z.boolean(),
      gameType: z.enum(["scratch", "slots", "wheel"]),
      prizes: z
        .array(z.object({ name: z.string().min(1).max(100), weight: z.number().int().min(1).max(10) }))
        .min(1)
        .max(8)
        .optional(),
      primaryColor: z.string().max(50).optional(),
      accentColor: z.string().max(50).optional(),
    })
    .optional(),
})

export const membershipConfigSchema = z.object({
  membershipTier: z.string().min(1).max(50),
  benefits: z.string().max(2000),
  validDuration: z.enum(["monthly", "yearly", "lifetime", "custom"]),
  customDurationDays: z.number().int().min(1).max(3650).optional(),
  autoRenew: z.boolean().optional(),
  showHolderPhoto: z.boolean().optional(),
  holderPhotoPosition: z.enum(["left", "center", "right"]).optional(),
  terms: z.string().max(5000).optional(),
})

export const pointsCatalogItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
  pointsCost: z.number().int().min(1).max(100000),
})

export const pointsConfigSchema = z.object({
  pointsPerVisit: z.number().int().min(1).max(100),
  catalog: z.array(pointsCatalogItemSchema).min(1).max(20),
  pointsLabel: z.string().max(20).optional(),
})

export const giftCardConfigSchema = z.object({
  currency: z.string().min(1).max(3),
  initialBalanceCents: z.number().int().min(100).max(100_000_00),
  partialRedemption: z.boolean(),
  expiryMonths: z.number().int().min(1).max(120).optional(),
})

export const ticketConfigSchema = z.object({
  eventName: z.string().min(1).max(200),
  eventDate: z.string().min(1),
  eventVenue: z.string().min(1).max(200),
  barcodeType: z.enum(["qr", "code128", "pdf417", "aztec"]),
  maxScans: z.number().int().min(1).max(100),
})

export const prizeItemSchema = z.object({
  name: z.string().min(1).max(100),
  weight: z.number().int().min(1).max(10),
})

export const minigameConfigSchema = z.object({
  enabled: z.boolean(),
  gameType: z.enum(["scratch", "slots", "wheel"]),
  prizes: z.array(prizeItemSchema).min(1).max(8).optional(),
  primaryColor: z.string().max(50).optional(),
  accentColor: z.string().max(50).optional(),
})

// ─── Safe parsers ───────────────────────────────────────────

function safeParse<T>(schema: z.ZodType<T>, config: unknown): T | null {
  if (!config || typeof config !== "object") return null
  const result = schema.safeParse(config)
  return result.success ? result.data : null
}

export function parseStampCardConfig(config: unknown): StampCardConfig | null {
  return safeParse(stampCardConfigSchema, config)
}

export function parseCouponConfig(config: unknown): CouponConfig | null {
  return safeParse(couponConfigSchema, config)
}

export function parseMembershipConfig(config: unknown): MembershipConfig | null {
  return safeParse(membershipConfigSchema, config)
}

export function parsePointsConfig(config: unknown): PointsConfig | null {
  return safeParse(pointsConfigSchema, config)
}

export function parseGiftCardConfig(config: unknown): GiftCardConfig | null {
  return safeParse(giftCardConfigSchema, config)
}

export function parseTicketConfig(config: unknown): TicketConfig | null {
  return safeParse(ticketConfigSchema, config)
}

export function parseMinigameConfig(config: unknown): MinigameConfig | null {
  if (!config || typeof config !== "object") return null
  const obj = config as Record<string, unknown>
  const minigame = obj.minigame
  if (!minigame || typeof minigame !== "object") return null
  const result = minigameConfigSchema.safeParse(minigame)
  return result.success ? result.data : null
}

// ─── Type guards ────────────────────────────────────────────

export function isStampCardConfig(config: unknown): config is StampCardConfig {
  return parseStampCardConfig(config) !== null
}

export function isCouponConfig(config: unknown): config is CouponConfig {
  return parseCouponConfig(config) !== null
}

export function isMembershipConfig(config: unknown): config is MembershipConfig {
  return parseMembershipConfig(config) !== null
}

export function isPointsConfig(config: unknown): config is PointsConfig {
  return parsePointsConfig(config) !== null
}

export function isGiftCardConfig(config: unknown): config is GiftCardConfig {
  return parseGiftCardConfig(config) !== null
}

export function isTicketConfig(config: unknown): config is TicketConfig {
  return parseTicketConfig(config) !== null
}

// ─── Type-dispatch validator ────────────────────────────────

export function validateTemplateConfig(
  passType: PassType,
  config: unknown
): { success: true; data: PassTemplateConfig } | { success: false; error: string } {
  const schemaMap: Record<PassType, z.ZodType<PassTemplateConfig>> = {
    STAMP_CARD: stampCardConfigSchema as z.ZodType<PassTemplateConfig>,
    COUPON: couponConfigSchema as z.ZodType<PassTemplateConfig>,
    MEMBERSHIP: membershipConfigSchema as z.ZodType<PassTemplateConfig>,
    POINTS: pointsConfigSchema as z.ZodType<PassTemplateConfig>,
    GIFT_CARD: giftCardConfigSchema as z.ZodType<PassTemplateConfig>,
    TICKET: ticketConfigSchema as z.ZodType<PassTemplateConfig>,
  }

  const schema = schemaMap[passType]
  if (!schema) {
    return { success: false, error: "Unknown pass type" }
  }

  const result = schema.safeParse(config)
  if (!result.success) {
    return { success: false, error: result.error.issues.map((i) => i.message).join(", ") }
  }
  return { success: true, data: result.data }
}

// ─── Weighted Random Prize Selection ─────────────────────────

export function weightedRandomPrize(prizes: { name: string; weight: number }[]): string {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0)
  let rand = Math.random() * totalWeight
  for (const prize of prizes) {
    rand -= prize.weight
    if (rand <= 0) return prize.name
  }
  return prizes[prizes.length - 1].name
}

// ─── Formatters ─────────────────────────────────────────────

export function formatCouponValue(config: CouponConfig): string {
  switch (config.discountType) {
    case "percentage":
      return `${config.discountValue}% off`
    case "fixed":
      return `$${config.discountValue} off`
    case "freebie":
      return "Free item"
  }
}

export function formatMembershipDuration(config: MembershipConfig): string {
  switch (config.validDuration) {
    case "monthly":
      return "Monthly"
    case "yearly":
      return "Yearly"
    case "lifetime":
      return "Lifetime"
    case "custom":
      return config.customDurationDays ? `${config.customDurationDays} days` : "Custom"
  }
}

export function formatDuration(validDuration: string, customDurationDays?: number): string {
  switch (validDuration) {
    case "monthly":
      return "Monthly"
    case "yearly":
      return "Yearly"
    case "lifetime":
      return "Lifetime"
    case "custom":
      return customDurationDays ? `${customDurationDays} days` : "Custom"
    default:
      return validDuration
  }
}

export function formatPointsValue(config: PointsConfig): string {
  return `${config.pointsPerVisit} pts/visit`
}

export function formatGiftCardValue(config: GiftCardConfig): string {
  return `${config.currency} ${(config.initialBalanceCents / 100).toFixed(2)}`
}

export function getCheapestCatalogItem(config: PointsConfig) {
  return [...config.catalog].sort((a, b) => a.pointsCost - b.pointsCost)[0] ?? null
}

// ─── Expiry calculator ──────────────────────────────────────

export function computeDurationExpiresAt(
  validDuration: "monthly" | "yearly" | "lifetime" | "custom",
  customDurationDays?: number,
  from: Date = new Date()
): Date | null {
  switch (validDuration) {
    case "monthly": {
      const d = new Date(from)
      d.setMonth(d.getMonth() + 1)
      return d
    }
    case "yearly": {
      const d = new Date(from)
      d.setFullYear(d.getFullYear() + 1)
      return d
    }
    case "lifetime":
      return null
    case "custom": {
      if (!customDurationDays) return null
      const d = new Date(from)
      d.setDate(d.getDate() + customDurationDays)
      return d
    }
  }
}

export function computeMembershipExpiresAt(config: MembershipConfig, from: Date = new Date()): Date | null {
  return computeDurationExpiresAt(config.validDuration, config.customDurationDays, from)
}

export function getWalletRewardText(config: unknown, fallbackDescription: string): string {
  const minigame = parseMinigameConfig(config)
  if (minigame?.enabled && minigame.prizes?.length) {
    return minigame.prizes.map((p) => p.name).join(", ")
  }
  return fallbackDescription
}

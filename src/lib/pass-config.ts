import { z } from "zod"
import type {
  PassType,
  StampCardConfig,
  CouponConfig,
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

// ─── Type-dispatch validator ────────────────────────────────

export function validateTemplateConfig(
  passType: PassType,
  config: unknown
): { success: true; data: PassTemplateConfig } | { success: false; error: string } {
  const schemaMap: Record<PassType, z.ZodType<PassTemplateConfig>> = {
    STAMP_CARD: stampCardConfigSchema as z.ZodType<PassTemplateConfig>,
    COUPON: couponConfigSchema as z.ZodType<PassTemplateConfig>,
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

export function getWalletRewardText(config: unknown, fallbackDescription: string): string {
  const minigame = parseMinigameConfig(config)
  if (minigame?.enabled && minigame.prizes?.length) {
    return minigame.prizes.map((p) => p.name).join(", ")
  }
  return fallbackDescription
}

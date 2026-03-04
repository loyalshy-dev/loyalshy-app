import { z } from "zod"
import type { ProgramType, CouponConfig, MembershipConfig, MinigameConfig, PrizeItem, PointsConfig } from "@/types/program-types"

// ─── Zod schemas ────────────────────────────────────────────

export const couponConfigSchema = z.object({
  discountType: z.enum(["percentage", "fixed", "freebie"]),
  discountValue: z.number().min(0).max(10000),
  couponDescription: z.string().max(200).optional(),
  validUntil: z.string().optional(), // ISO date string
  redemptionLimit: z.enum(["single", "unlimited"]),
  couponCode: z.string().max(50).optional(),
  terms: z.string().max(5000).optional(),
})

export const membershipConfigSchema = z.object({
  membershipTier: z.string().min(1).max(50),
  benefits: z.string().max(2000),
  validDuration: z.enum(["monthly", "yearly", "lifetime", "custom"]),
  customDurationDays: z.number().int().min(1).max(3650).optional(),
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

export function parseCouponConfig(config: unknown): CouponConfig | null {
  if (!config || typeof config !== "object") return null
  const result = couponConfigSchema.safeParse(config)
  return result.success ? result.data : null
}

export function parseMembershipConfig(config: unknown): MembershipConfig | null {
  if (!config || typeof config !== "object") return null
  const result = membershipConfigSchema.safeParse(config)
  return result.success ? result.data : null
}

export function parsePointsConfig(config: unknown): PointsConfig | null {
  if (!config || typeof config !== "object") return null
  const result = pointsConfigSchema.safeParse(config)
  return result.success ? result.data : null
}

export function parseMinigameConfig(config: unknown): MinigameConfig | null {
  if (!config || typeof config !== "object") return null
  const obj = config as Record<string, unknown>
  const minigame = obj.minigame
  if (!minigame || typeof minigame !== "object") return null
  const result = minigameConfigSchema.safeParse(minigame)
  return result.success ? result.data : null
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
      return config.customDurationDays
        ? `${config.customDurationDays} days`
        : "Custom"
  }
}

export function formatPointsValue(config: PointsConfig): string {
  return `${config.pointsPerVisit} pts/visit`
}

export function getCheapestCatalogItem(config: PointsConfig) {
  return [...config.catalog].sort((a, b) => a.pointsCost - b.pointsCost)[0] ?? null
}

// ─── Type-dispatch validator ────────────────────────────────

export function validateProgramConfig(
  programType: ProgramType,
  config: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  switch (programType) {
    case "STAMP_CARD":
      return { success: true, data: {} }
    case "COUPON": {
      const result = couponConfigSchema.safeParse(config)
      if (!result.success) {
        return { success: false, error: result.error.issues.map((i) => i.message).join(", ") }
      }
      return { success: true, data: result.data }
    }
    case "MEMBERSHIP": {
      const result = membershipConfigSchema.safeParse(config)
      if (!result.success) {
        return { success: false, error: result.error.issues.map((i) => i.message).join(", ") }
      }
      return { success: true, data: result.data }
    }
    case "POINTS": {
      const result = pointsConfigSchema.safeParse(config)
      if (!result.success) {
        return { success: false, error: result.error.issues.map((i) => i.message).join(", ") }
      }
      return { success: true, data: result.data }
    }
    default:
      return { success: false, error: "Unknown program type" }
  }
}

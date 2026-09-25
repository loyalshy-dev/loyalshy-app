import "server-only"

import { db } from "@/lib/db"
import { resolveCardDesign, parseStripFilters } from "../card-design"
import { parseCouponConfig, parseTemplateAnnouncement } from "@/lib/pass-config"
import { getPassColors } from "./colors"
import {
  buildAppleFrontFields,
  resolveAppleStrip,
  type PassGenerationInput,
} from "./generate-pass"

/**
 * The front of an Apple Wallet pass as data, for the staff app to draw
 * natively. Everything here comes from the same helpers generateApplePass
 * uses (colors, field layout, strip), so the in-app card matches the pass
 * in the customer's Wallet. The strip itself is served as a PNG by the
 * `/card/strip` routes because it's rendered server-side (sharp).
 */
export type AppleCardView = {
  organizationName: string
  /** PassKit "rgb(r, g, b)" strings — React Native accepts them as-is. */
  backgroundColor: string
  foregroundColor: string
  labelColor: string
  logoUrl: string | null
  logoZoom: number
  hasStrip: boolean
  /** Strip aspect ratio (width / height) — Apple storeCard strips are 1125×432. */
  stripAspectRatio: number
  /** Changes whenever the strip image would change; append to the strip URL to bust caches. */
  stripVersion: string
  headerFields: { label: string; value: string }[]
  primaryFields: { label: string; value: string }[]
  secondaryFields: { label: string; value: string }[]
  auxiliaryFields: { label: string; value: string }[]
  /** Single-use coupon already used — Wallet greys the pass out. */
  voided: boolean
}

const STRIP_ASPECT = 1125 / 432

const templateSelect = {
  id: true,
  name: true,
  passType: true,
  config: true,
  announcement: true,
  termsAndConditions: true,
  passDesign: true,
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      logoApple: true,
      logoGoogle: true,
      brandColor: true,
      secondaryColor: true,
      phone: true,
      website: true,
    },
  },
} as const

type TemplateRow = NonNullable<Awaited<ReturnType<typeof loadTemplateRow>>>

function loadTemplateRow(templateId: string, organizationId: string) {
  return db.passTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: templateSelect,
  })
}

function baseInput(template: TemplateRow): Omit<
  PassGenerationInput,
  | "serialNumber"
  | "authenticationToken"
  | "customerName"
  | "customerEmail"
  | "currentCycleVisits"
  | "totalVisits"
  | "memberSince"
  | "hasAvailableReward"
> {
  const organization = template.organization
  const templateConfig = (template.config ?? {}) as Record<string, unknown>
  const cardDesign = resolveCardDesign(template.passDesign, organization)
  return {
    visitsRequired: (templateConfig.stampsRequired as number) ?? 10,
    rewardDescription: (templateConfig.rewardDescription as string) ?? "Free reward",
    rewardExpiryDays: (templateConfig.rewardExpiryDays as number) ?? 30,
    organizationName: organization.name,
    organizationLogo: cardDesign.logoUrl ?? organization.logo,
    organizationLogoApple: cardDesign.logoAppleUrl ?? organization.logoApple,
    organizationLogoGoogle: cardDesign.logoGoogleUrl ?? organization.logoGoogle,
    brandColor: organization.brandColor,
    secondaryColor: organization.secondaryColor,
    termsAndConditions: template.termsAndConditions,
    organizationPhone: organization.phone,
    organizationWebsite: organization.website,
    programName: template.name,
    cardDesign,
    programType: template.passType,
    programConfig: template.config,
    organizationSlug: organization.slug,
    announcement: parseTemplateAnnouncement(template.announcement),
  }
}

/**
 * Pass input for a real, issued pass — mirrors the Apple Wallet update route
 * (api/wallet/apple/v1/passes/[passTypeId]/[serialNumber]), i.e. what the
 * customer's Wallet shows after its latest refresh.
 */
export async function loadPassCardInput(
  passInstanceId: string,
  organizationId: string,
): Promise<PassGenerationInput | null> {
  const pass = await db.passInstance.findFirst({
    where: {
      OR: [{ id: passInstanceId }, { walletPassId: passInstanceId }],
      passTemplate: { organizationId },
    },
    select: {
      id: true,
      data: true,
      walletPassId: true,
      walletPassSerialNumber: true,
      issuedAt: true,
      contact: {
        select: { fullName: true, email: true, memberNumber: true },
      },
      passTemplate: { select: { id: true } },
      rewards: {
        where: { status: "AVAILABLE" },
        select: { id: true },
        take: 1,
      },
    },
  })
  if (!pass) return null
  const template = await loadTemplateRow(pass.passTemplate.id, organizationId)
  if (!template) return null

  const data = (pass.data ?? {}) as Record<string, unknown>
  const redeemedAtRaw = data.redeemedAt
  return {
    ...baseInput(template),
    serialNumber: pass.walletPassSerialNumber ?? pass.id,
    authenticationToken: pass.walletPassId ?? pass.id,
    memberNumber: pass.contact.memberNumber,
    customerName: pass.contact.fullName,
    customerEmail: pass.contact.email,
    currentCycleVisits: (data.currentCycleVisits as number) ?? 0,
    totalVisits: (data.totalVisits as number) ?? 0,
    memberSince: pass.issuedAt,
    hasAvailableReward: pass.rewards.length > 0,
    passInstanceId: pass.id,
    isRedeemed: (data.redeemed as boolean) ?? false,
    redeemedAt: typeof redeemedAtRaw === "string" ? new Date(redeemedAtRaw) : null,
  }
}

/**
 * Pass input for a program preview: what a customer who joins right now
 * would see (no stamps yet, no personal details).
 */
export async function loadTemplateCardInput(
  templateId: string,
  organizationId: string,
): Promise<PassGenerationInput | null> {
  const template = await loadTemplateRow(templateId, organizationId)
  if (!template) return null
  return {
    ...baseInput(template),
    serialNumber: template.id,
    authenticationToken: template.id,
    customerName: "—",
    customerEmail: null,
    currentCycleVisits: 0,
    totalVisits: 0,
    memberSince: new Date(),
    hasAvailableReward: false,
  }
}

export function toAppleCardView(input: PassGenerationInput): AppleCardView {
  const design = input.cardDesign
  const stripFilters = parseStripFilters(design?.editorConfig ?? null)
  const colors = getPassColors(
    design?.primaryColor ?? input.brandColor,
    design?.secondaryColor ?? input.secondaryColor,
    design?.textColor ?? null,
    stripFilters.labelColor,
  )
  const { fieldData, appleLayout } = buildAppleFrontFields(input)
  const pick = (ids: string[]) =>
    ids.flatMap((id) => {
      const f = fieldData[id]
      return f ? [{ label: f.label, value: f.value }] : []
    })

  const couponConfig = input.programType === "COUPON" ? parseCouponConfig(input.programConfig) : null
  const voided =
    input.programType === "COUPON" && input.isRedeemed === true && couponConfig?.redemptionLimit !== "unlimited"

  return {
    organizationName: input.organizationName,
    backgroundColor: colors.backgroundColor,
    foregroundColor: colors.foregroundColor,
    labelColor: colors.labelColor,
    logoUrl: input.organizationLogoApple ?? input.organizationLogo,
    logoZoom: stripFilters.logoAppleZoom,
    hasStrip: design?.showStrip ?? false,
    stripAspectRatio: STRIP_ASPECT,
    stripVersion: [
      design?.designHash ?? "",
      input.currentCycleVisits,
      input.hasAvailableReward ? 1 : 0,
    ].join("-"),
    headerFields: pick(appleLayout.header),
    primaryFields: pick(appleLayout.primary),
    secondaryFields: pick(appleLayout.secondary),
    auxiliaryFields: pick(appleLayout.auxiliary),
    voided,
  }
}

/**
 * The strip image as PNG bytes, or a URL to redirect to when the design uses
 * an unprocessed upload. Null when the design has no strip.
 */
export async function renderAppleCardStrip(
  input: PassGenerationInput,
): Promise<{ png: Buffer } | { redirect: string } | null> {
  if (!(input.cardDesign?.showStrip ?? false)) return null
  const { buffer, url } = await resolveAppleStrip(input)
  if (buffer) return { png: buffer }
  if (url) return { redirect: url }
  return null
}

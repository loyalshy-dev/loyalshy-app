import "server-only"

import { buildClassId, buildObjectId, buildProgramClassId, buildEnrollmentObjectId } from "./constants"
import { buildSaveUrl } from "./jwt-utils"
import type { CardDesignData } from "../card-design"
import { formatLabel, parseStripFilters, parseStampGridConfig, getFieldConfig, resolveCardDesign } from "../card-design"
import { generateStampGridImage, GOOGLE_HERO_WIDTH, GOOGLE_HERO_HEIGHT } from "../strip-image"
import { uploadFile } from "../../storage"
import { parseCouponConfig, getWalletRewardText, parseTemplateAnnouncement } from "../../pass-config"
import {
  createPassLocalizer,
  googleLabel,
  googleMessage,
  googleTextModule,
  localizedCouponValue,
  localizedDate,
  localizedDateTime,
  localizedMonth,
  localizedProgressValue,
  type PassLocalizer,
} from "../pass-i18n"
import { db } from "../../db"

// ─── Types ──────────────────────────────────────────────────

export type GooglePassGenerationInput = {
  contactId: string
  organizationId: string
  walletPassId: string
  contactName: string
  contactEmail: string | null
  currentCycleVisits: number
  visitsRequired: number
  totalVisits: number
  memberSince: Date
  hasAvailableReward: boolean
  organizationName: string
  organizationLogo: string | null
  organizationLogoGoogle: string | null
  brandColor: string | null
  rewardDescription: string
  rewardExpiryDays: number
  termsAndConditions: string | null
  organizationPhone: string | null
  organizationWebsite: string | null
  // Sequential member number (per organization)
  memberNumber?: number
  // Multi-template fields
  templateName?: string
  templateId?: string
  passInstanceId?: string
  // Pass design fields
  passDesign?: CardDesignData | null
  // Template lifecycle
  templateEndsAt?: Date | null
  // Pass type + config for type-specific pass content
  passType?: string
  templateConfig?: unknown
  // Prize reveal
  hasUnrevealedPrize?: boolean
  organizationSlug?: string
  // COUPON: redemption state (drives state="COMPLETED" + Last Used field +
  // TEXT_AND_NOTIFY banner). Mirrors the Apple input and the update-pass.ts
  // patch path so a re-saved pass after redemption looks the same as one
  // that was updated in-place.
  isRedeemed?: boolean
  redeemedAt?: Date | null
  // Broadcast announcement (PassTemplate.announcement). Carried on the class
  // so the issuance-path class PATCH doesn't wipe the broadcast message; the
  // deterministic id (announce-{sentAt ms}) means Google's TEXT_AND_NOTIFY
  // id-dedupe never re-notifies holders who already got the banner.
  announcement?: { message: string; sentAt: string } | null
}

// ─── Helpers ────────────────────────────────────────────────

function ensureHexColor(color: string | null, fallback: string): string {
  if (!color) return fallback
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  return fallback
}

function normalizeSocialUrl(handle: string, platform: "instagram" | "facebook" | "tiktok" | "x"): string {
  if (handle.startsWith("http://") || handle.startsWith("https://")) return handle
  const cleaned = handle.replace(/^@/, "")
  const bases: Record<string, string> = {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/@",
    x: "https://x.com/",
  }
  return `${bases[platform]}${cleaned}`
}

// ─── Build Loyalty Class (one per template or organization) ─────────────

/** The class is shared by every holder of a program, so it only reads program-level fields. */
type LoyaltyClassInput = Pick<
  GooglePassGenerationInput,
  | "organizationId"
  | "organizationName"
  | "organizationLogo"
  | "organizationLogoGoogle"
  | "organizationPhone"
  | "organizationWebsite"
  | "brandColor"
  | "termsAndConditions"
  | "templateId"
  | "templateName"
  | "passDesign"
  | "passType"
  | "announcement"
>

function buildLoyaltyClass(input: LoyaltyClassInput, loc: PassLocalizer) {
  // Use per-template class ID when templateId is available, otherwise fall back to organization
  const classId = input.templateId
    ? buildProgramClassId(input.templateId)
    : buildClassId(input.organizationId)
  const design = input.passDesign
  const hexBg = ensureHexColor(design?.primaryColor ?? input.brandColor, "#1a1a2e")
  const labelFmt = design?.labelFormat ?? "UPPERCASE"
  const stripFilters = parseStripFilters(design?.editorConfig)

  // Build card row template from user-configurable fields
  // Unified fields list, falling back to legacy header+secondary, then per-type defaults
  const fieldConfig = getFieldConfig(input.passType ?? "STAMP_CARD")
  const allConfiguredFields = stripFilters.fields
    ?? (stripFilters.headerFields || stripFilters.secondaryFields
      ? [...(stripFilters.headerFields ?? fieldConfig.defaultHeader), ...(stripFilters.secondaryFields ?? fieldConfig.defaultSecondary)]
      : null)
    ?? fieldConfig.defaultFields

  // Only exclude "progress" for stamp cards — it's the native loyaltyPoints widget
  const isStampType = !input.passType || input.passType === "STAMP_CARD"
  const googleExclude = new Set<string>()
  if (isStampType) {
    googleExclude.add("progress")
  }
  const visibleFields = allConfiguredFields.filter((id) => !googleExclude.has(id))

  // Google Wallet card layout: program name is row 1 (native programName field).
  // Text module fields fill rows as 3-then-3 pattern (max 3 per row).
  const cardRowTemplateInfos: Record<string, unknown>[] = []
  const fp = (id: string) => ({ firstValue: { fields: [{ fieldPath: `object.textModulesData['${id}']` }] } })

  if (visibleFields.length === 1) {
    cardRowTemplateInfos.push({ oneItem: { item: fp(visibleFields[0]) } })
  } else if (visibleFields.length === 2) {
    cardRowTemplateInfos.push({ twoItems: { startItem: fp(visibleFields[0]), endItem: fp(visibleFields[1]) } })
  } else if (visibleFields.length === 3) {
    cardRowTemplateInfos.push({ threeItems: { startItem: fp(visibleFields[0]), middleItem: fp(visibleFields[1]), endItem: fp(visibleFields[2]) } })
  } else if (visibleFields.length === 4) {
    cardRowTemplateInfos.push({ threeItems: { startItem: fp(visibleFields[0]), middleItem: fp(visibleFields[1]), endItem: fp(visibleFields[2]) } })
    cardRowTemplateInfos.push({ oneItem: { item: fp(visibleFields[3]) } })
  } else if (visibleFields.length === 5) {
    cardRowTemplateInfos.push({ threeItems: { startItem: fp(visibleFields[0]), middleItem: fp(visibleFields[1]), endItem: fp(visibleFields[2]) } })
    cardRowTemplateInfos.push({ twoItems: { startItem: fp(visibleFields[3]), endItem: fp(visibleFields[4]) } })
  } else if (visibleFields.length >= 6) {
    cardRowTemplateInfos.push({ threeItems: { startItem: fp(visibleFields[0]), middleItem: fp(visibleFields[1]), endItem: fp(visibleFields[2]) } })
    cardRowTemplateInfos.push({ threeItems: { startItem: fp(visibleFields[3]), middleItem: fp(visibleFields[4]), endItem: fp(visibleFields[5]) } })
  }

  // Type-aware program display name
  const programDisplayName = (() => {
    const name = input.templateName
    if (!name) return loc.t("names.googleDefault")
    return input.passType === "COUPON" ? name : loc.t("names.googleProgram", { name })
  })()

  // Prefer Google-specific logo, fall back to general
  const googleLogo = input.organizationLogoGoogle ?? input.organizationLogo

  const loyaltyClass: Record<string, unknown> = {
    id: classId,
    programName: programDisplayName,
    ...(loc.localizedIf(programDisplayName) ? { localizedProgramName: loc.localizedIf(programDisplayName) } : {}),
    issuerName: input.organizationName,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: hexBg,
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
    securityAnimation: { animationType: "FOIL_SHIMMER" },
  }

  // Program logo (required for Loyalty classes)
  const logoUrl = googleLogo ?? "https://developers.google.com/static/wallet/site-assets/images/pass-builder/pass_google_logo.jpg"
  const logoDescription = loc.localized(loc.t("names.logo", { name: input.organizationName }))
  loyaltyClass.programLogo = {
    sourceUri: { uri: logoUrl },
    contentDescription: logoDescription,
  }
  if (googleLogo) {
    loyaltyClass.wideProgramLogo = {
      sourceUri: { uri: googleLogo },
      contentDescription: logoDescription,
    }
  }

  // Card template override
  loyaltyClass.classTemplateInfo = {
    cardTemplateOverride: {
      cardRowTemplateInfos,
    },
  }

  // Homepage
  if (input.organizationWebsite) {
    loyaltyClass.homepageUri = {
      uri: input.organizationWebsite,
      description: input.organizationName,
      id: "homepage",
    }
  }

  // Links module for organization contact + socials
  const linksUris: Record<string, unknown>[] = []
  if (input.organizationWebsite) {
    linksUris.push({
      uri: input.organizationWebsite,
      description: input.organizationName,
      id: "website",
    })
  }
  if (input.organizationPhone) {
    linksUris.push({
      uri: `tel:${input.organizationPhone}`,
      description: input.organizationPhone,
      id: "phone",
    })
  }

  // Social links from card design — normalize handles to full URLs
  if (design?.socialLinks.instagram) {
    linksUris.push({
      uri: normalizeSocialUrl(design.socialLinks.instagram, "instagram"),
      description: "Instagram",
      id: "instagram",
    })
  }
  if (design?.socialLinks.facebook) {
    linksUris.push({
      uri: normalizeSocialUrl(design.socialLinks.facebook, "facebook"),
      description: "Facebook",
      id: "facebook",
    })
  }
  if (design?.socialLinks.tiktok) {
    linksUris.push({
      uri: normalizeSocialUrl(design.socialLinks.tiktok, "tiktok"),
      description: "TikTok",
      id: "tiktok",
    })
  }
  if (design?.socialLinks.x) {
    linksUris.push({
      uri: normalizeSocialUrl(design.socialLinks.x, "x"),
      description: "X",
      id: "x",
    })
  }

  // Map address link
  if (design?.mapAddress) {
    linksUris.push({
      uri: `https://maps.google.com/?q=${encodeURIComponent(design.mapAddress)}`,
      description: design.mapAddress,
      id: "map",
    })
  }

  // Contact fallback — always include at least one link
  if (linksUris.length === 0) {
    const description = loc.t("names.contactSupport")
    linksUris.push({
      uri: `mailto:support@loyalshy.com`,
      description,
      localizedDescription: loc.localized(description),
      id: "contact",
    })
  }

  loyaltyClass.linksModuleData = { uris: linksUris }

  // Text modules replace deprecated infoModuleData
  const classTextModules: Record<string, unknown>[] = []
  const classLabel = (key: string) => loc.t(`labels.${key}`, undefined, (s) => formatLabel(s, labelFmt))
  if (design?.businessHours) {
    classTextModules.push(googleTextModule(loc, "businessHours", classLabel("businessHours"), design.businessHours))
  }
  if (design?.customMessage) {
    classTextModules.push(googleTextModule(loc, "customMessage", classLabel("message"), design.customMessage))
  }
  if (input.termsAndConditions) {
    classTextModules.push(googleTextModule(loc, "terms", classLabel("terms"), input.termsAndConditions))
  }
  if (classTextModules.length > 0) {
    loyaltyClass.textModulesData = classTextModules
  }

  // Current broadcast announcement — must be re-included here because the
  // issuance path PATCHes the class (replacing `messages`); the stable id
  // keeps Google from re-firing the notification.
  if (input.announcement) {
    const sentAtMs = Date.parse(input.announcement.sentAt)
    loyaltyClass.messages = [
      {
        id: `announce-${Number.isNaN(sentAtMs) ? "0" : sentAtMs}`,
        header: input.organizationName,
        body: input.announcement.message,
        messageType: "TEXT_AND_NOTIFY",
      },
    ]
  }

  // No `locations` / proximity message: Google Wallet doesn't alert by
  // location, so "near your business" is iPhone-only (src/lib/proximity).

  return loyaltyClass
}

// ─── Build Loyalty Object (one per pass instance or contact) ────────────

async function buildLoyaltyObject(input: GooglePassGenerationInput, loc: PassLocalizer) {
  // Use pass-instance-scoped object ID when passInstanceId is available, otherwise fall back to contact
  const objectId = input.passInstanceId
    ? buildEnrollmentObjectId(input.passInstanceId)
    : buildObjectId(input.contactId)
  // Use per-template class ID when templateId is available
  const classId = input.templateId
    ? buildProgramClassId(input.templateId)
    : buildClassId(input.organizationId)
  const design = input.passDesign

  const progressStyle = design?.progressStyle ?? "NUMBERS"
  const labelFmt = design?.labelFormat ?? "UPPERCASE"
  const progressValue = localizedProgressValue(
    loc,
    input.currentCycleVisits,
    input.visitsRequired,
    progressStyle,
    input.hasAvailableReward
  )

  const memberSinceFormatted = localizedMonth(loc, input.memberSince)

  // Parse type-specific config
  const couponConfig = input.passType === "COUPON" ? parseCouponConfig(input.templateConfig) : null

  // Coupon redemption state — drives state="COMPLETED" + USED visuals on
  // single-use, "Last Used" text + per-redeem banner on unlimited. Mirrors
  // the patchGoogleWalletObject path so a re-saved pass after redemption
  // doesn't appear active.
  const isCouponRedeemed = input.passType === "COUPON" && input.isRedeemed === true
  const isSingleUseRedeemed = isCouponRedeemed && couponConfig?.redemptionLimit !== "unlimited"
  const isUnlimitedRedeemed = isCouponRedeemed && couponConfig?.redemptionLimit === "unlimited"

  // Custom field labels from editorConfig
  const objStripFilters = parseStripFilters(design?.editorConfig)
  const customLabels = objStripFilters.fieldLabels ?? {}
  const lbl = (fieldId: string, labelKey: string) => {
    const custom = customLabels[fieldId]
    return custom ? formatLabel(custom, labelFmt) : loc.t(`labels.${labelKey}`, undefined, (s) => formatLabel(s, labelFmt))
  }
  const progressLabel = design?.customProgressLabel
    ? formatLabel(design.customProgressLabel, labelFmt)
    : loc.t(`labels.${input.hasAvailableReward ? "status" : "progress"}`, undefined, (s) => formatLabel(s, labelFmt))

  // Coupon texts (prize names are merchant text; the coupon value is ours).
  const couponValue = couponConfig ? localizedCouponValue(loc, couponConfig) : ""
  const prizeText = couponConfig ? getWalletRewardText(input.templateConfig, couponValue) : ""
  const hasPrizes = couponConfig ? prizeText !== couponValue : false
  const usedPrizeText = loc.t("values.prizeUsed", { prize: prizeText }, (s) => s.trim())
  const validUntilText = couponConfig?.validUntil ? localizedDate(loc, new Date(couponConfig.validUntil)) : loc.t("values.noExpiry")
  const redeemedText = loc.t("values.redeemed")
  const discountLabel = lbl("discount", isSingleUseRedeemed ? "redeemed" : (hasPrizes ? "prizes" : "discount"))
  const validUntilLabel = lbl("validUntil", isSingleUseRedeemed ? "status" : "validUntil")

  // All field data as textModulesData entries — IDs match field IDs from getFieldConfig
  const allFieldData: Record<string, { id: string; header: string; body: string }> = {
    organization: { id: "organization", header: lbl("organization", "org"), body: input.organizationName },
    memberNumber: { id: "memberNumber", header: lbl("memberNumber", "memberNumber"), body: `${input.memberNumber ?? "—"}` },
    nextReward: { id: "nextReward", header: lbl("nextReward", "nextReward"), body: getWalletRewardText(input.templateConfig, input.rewardDescription) },
    totalVisits: { id: "totalVisits", header: lbl("totalVisits", "totalVisits"), body: `${input.totalVisits}` },
    memberSince: { id: "memberSince", header: lbl("memberSince", "since"), body: memberSinceFormatted },
    registeredAt: { id: "registeredAt", header: lbl("registeredAt", "registered"), body: memberSinceFormatted },
    customerName: { id: "customerName", header: lbl("customerName", "name"), body: input.contactName },
    // COUPON. Single-use redeemed flips visuals to USED + "Redeemed" status —
    // same shape patchGoogleWalletObject produces on the update path.
    discount: {
      id: "discount",
      header: discountLabel,
      body: isSingleUseRedeemed ? usedPrizeText : prizeText,
    },
    validUntil: {
      id: "validUntil",
      header: validUntilLabel,
      body: isSingleUseRedeemed ? redeemedText : validUntilText,
    },
    couponCode: { id: "couponCode", header: lbl("couponCode", "code"), body: couponConfig?.couponCode ?? "" },
    address: { id: "address", header: lbl("address", "address"), body: design?.mapAddress ?? "" },
  }

  // Build textModulesData from user-configured unified fields
  const googleFieldConfig = getFieldConfig(input.passType ?? "STAMP_CARD")
  const allObjFields = objStripFilters.fields
    ?? (objStripFilters.headerFields || objStripFilters.secondaryFields
      ? [...(objStripFilters.headerFields ?? googleFieldConfig.defaultHeader), ...(objStripFilters.secondaryFields ?? googleFieldConfig.defaultSecondary)]
      : null)
    ?? googleFieldConfig.defaultFields
  // Only exclude "progress" for stamp cards — it's the native loyaltyPoints widget
  const googleExcludeObj = new Set<string>()
  const isStampTypeObj = !input.passType || input.passType === "STAMP_CARD"
  if (isStampTypeObj) {
    googleExcludeObj.add("progress")
  }
  const textModulesFieldIds = allObjFields.filter((id) => !googleExcludeObj.has(id))
  const textModulesData: Record<string, unknown>[] = textModulesFieldIds
    .map((id) => allFieldData[id])
    .filter((f): f is { id: string; header: string; body: string } => f != null && f.body !== "")
    .map((f) => googleTextModule(loc, f.id, f.header, f.body))

  // Type-specific loyalty points (native Google Wallet points widget — not affected by field config)
  let loyaltyPoints: Record<string, unknown>
  let secondaryLoyaltyPoints: Record<string, unknown>

  // balance.string has no localized form in the Google Wallet API, so the
  // points values stay in English; their labels are translated.
  if (input.passType === "COUPON" && couponConfig) {
    loyaltyPoints = {
      ...googleLabel(loc, discountLabel),
      balance: { string: isSingleUseRedeemed ? usedPrizeText : prizeText },
    }
    secondaryLoyaltyPoints = {
      ...googleLabel(loc, validUntilLabel),
      balance: { string: isSingleUseRedeemed ? redeemedText : validUntilText },
    }
  } else {
    // STAMP_CARD (default)
    loyaltyPoints = {
      ...googleLabel(loc, progressLabel),
      balance: { string: progressValue },
    }
    secondaryLoyaltyPoints = {
      ...googleLabel(loc, lbl("totalVisits", "totalVisits")),
      balance: { int: input.totalVisits },
    }
  }

  // Unlimited coupons: surface the most recent redemption timestamp so each
  // re-save reflects the latest use. Same shape patchGoogleWalletObject
  // produces, so a re-saved pass after redemption matches the in-place update.
  if (isUnlimitedRedeemed && input.redeemedAt) {
    const ts = localizedDateTime(loc, input.redeemedAt)
    textModulesData.push(googleTextModule(loc, "couponLastUsed", lbl("couponLastUsed", "lastUsed"), ts))
  }

  const loyaltyObject: Record<string, unknown> = {
    id: objectId,
    classId,
    // Single-use redeemed → COMPLETED (Google's voided equivalent — adds
    // a "Completed" badge and greys out the pass).
    state: isSingleUseRedeemed ? "COMPLETED" : "ACTIVE",
    accountId: input.walletPassId,
    accountName: input.contactName,
    loyaltyPoints,
    secondaryLoyaltyPoints,
    barcode: {
      type: "QR_CODE",
      value: input.walletPassId,
    },
    textModulesData,
    // Group passes from the same organization together
    groupingInfo: { groupingId: input.organizationId },
  }

  // Per-redemption banner — TEXT_AND_NOTIFY deduped by id derived from the
  // redeemedAt timestamp. Same pattern as patchGoogleWalletObject, so a pass
  // that gets re-saved before its first PATCH still surfaces the banner.
  if (isCouponRedeemed && input.redeemedAt) {
    const ts = localizedDateTime(loc, input.redeemedAt)
    const body = isSingleUseRedeemed ? loc.t("notify.couponRedeemedBody") : loc.t("notify.usedAt", { time: ts })
    loyaltyObject.messages = [
      googleMessage(loc, `redeem-${input.redeemedAt.getTime()}`, loc.t("notify.couponRedeemedTitle"), body),
    ]
  }

  // Add reveal link if there's an unrevealed prize
  if (input.hasUnrevealedPrize && input.passInstanceId && input.organizationSlug) {
    const { signCardAccess } = await import("../../card-access")
    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"
    const sig = signCardAccess(input.passInstanceId)
    loyaltyObject.linksModuleData = {
      uris: [{
        uri: `${baseUrl}/join/${input.organizationSlug}/card/${input.passInstanceId}?sig=${sig}`,
        description: loc.t("names.revealPrize"),
        localizedDescription: loc.localized(loc.t("names.revealPrize")),
        id: "revealLink",
      }],
    }
  }

  // Valid time interval for time-bound programs
  if (input.templateEndsAt) {
    loyaltyObject.validTimeInterval = {
      end: { date: input.templateEndsAt.toISOString() },
    }
  }

  // Hero image (on object — shows as banner strip on the pass).
  // Derive stamp-vs-coupon from input.passType (template-level,
  // authoritative). design.cardType is unset on programs created
  // outside the studio and would silently break the hero rendering.
  const googleLogo = input.organizationLogoGoogle ?? input.organizationLogo
  const showStrip = design?.showStrip ?? false
  const isStampType = !input.passType || input.passType === "STAMP_CARD"
  let heroImageUrl: string | null = null
  if (showStrip) {
    const stripFiltersG = parseStripFilters(design?.editorConfig)
    if (isStampType && (stripFiltersG.useStampGrid || design?.patternStyle === "STAMP_GRID") && input.passInstanceId) {
      // Generate stamp grid PNG and upload to R2 so Google can access it
      heroImageUrl = await generateAndUploadStampGrid(input, design, stripFiltersG)
    } else {
      heroImageUrl = design?.stripImageGoogle ?? design?.generatedStripGoogle ?? googleLogo
    }
  } else if (isStampType) {
    // Only use logo as hero for stamp cards — for coupon it looks oversized
    heroImageUrl = googleLogo
  }

  // Google validates image URLs server-side — skip non-HTTPS URLs (local dev, private IPs)
  if (heroImageUrl && !/^https:\/\//.test(heroImageUrl)) {
    heroImageUrl = null
  }

  if (heroImageUrl) {
    loyaltyObject.heroImage = {
      sourceUri: { uri: heroImageUrl },
      contentDescription: {
        defaultValue: { language: "en", value: input.organizationName },
      },
    }
  }

  return loyaltyObject
}

// ─── Stamp Grid → R2 Upload ─────────────────────────────────

async function generateAndUploadStampGrid(
  input: GooglePassGenerationInput,
  design: CardDesignData | null | undefined,
  stripFilters: ReturnType<typeof parseStripFilters>,
): Promise<string | null> {
  try {
    const config = parseStampGridConfig(design?.editorConfig)
    const stripPrimary = stripFilters.stripColor1 ?? design?.primaryColor ?? "#1a1a2e"
    const stripSecondary = stripFilters.stripColor2 ?? design?.secondaryColor ?? "#ffffff"

    const buffer = await generateStampGridImage({
      currentVisits: input.currentCycleVisits,
      totalVisits: input.visitsRequired,
      hasReward: input.hasAvailableReward,
      config,
      primaryColor: stripPrimary,
      secondaryColor: stripFilters.stampFilledColor ?? stripSecondary,
      textColor: design?.textColor ?? "#ffffff",
      width: GOOGLE_HERO_WIDTH,
      height: GOOGLE_HERO_HEIGHT,
      stripImageUrl: design?.stripImageGoogle,
      stripOpacity: stripFilters.stripOpacity,
      stripGrayscale: stripFilters.stripGrayscale,
    })

    const key = `strip-images/${input.templateId ?? input.organizationId}/google-stamp-grid-${input.passInstanceId}.png`
    return await uploadFile(buffer, key, "image/png")
  } catch {
    // Fall back to static strip or logo
    const googleLogo = input.organizationLogoGoogle ?? input.organizationLogo
    return design?.stripImageGoogle ?? design?.generatedStripGoogle ?? googleLogo
  }
}

// ─── Generate Save-to-Wallet URL ────────────────────────────

/**
 * Generates a "Save to Google Wallet" URL containing the loyalty class
 * and object definitions in a signed JWT. When the user taps
 * the link, Google creates/updates the class and object automatically.
 */
export async function generateGoogleWalletSaveUrl(
  input: GooglePassGenerationInput
): Promise<string> {
  const loc = await createPassLocalizer()
  const loyaltyClass = buildLoyaltyClass(input, loc)
  const loyaltyObject = await buildLoyaltyObject(input, loc)

  // Also PATCH the class via REST API to ensure updates (like logo changes)
  // are applied to existing classes that Google may have cached
  patchLoyaltyClass(loyaltyClass).catch(() => {})

  return buildSaveUrl([loyaltyClass], [loyaltyObject])
}

/**
 * Rebuilds a program's loyalty class from the current DB state and PATCHes it.
 *
 * Class-level fields (logo, colors, card row template, links, locations) are
 * shared by every holder, and the per-holder update path only PATCHes
 * objects — so without this, existing Google holders only saw a design
 * change once someone new generated a save URL for the program.
 */
export async function syncGoogleLoyaltyClass(templateId: string): Promise<void> {
  const template = await db.passTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
      passType: true,
      announcement: true,
      termsAndConditions: true,
      passDesign: true,
      organization: {
        select: {
          id: true,
          name: true,
          logo: true,
          logoGoogle: true,
          brandColor: true,
          secondaryColor: true,
          phone: true,
          website: true,
        },
      },
    },
  })
  if (!template) return

  const organization = template.organization
  const passDesign = resolveCardDesign(template.passDesign, organization)

  const loc = await createPassLocalizer()
  await patchLoyaltyClass(buildLoyaltyClass({
    organizationId: organization.id,
    organizationName: organization.name,
    organizationLogo: passDesign.logoUrl ?? organization.logo,
    organizationLogoGoogle: passDesign.logoGoogleUrl ?? organization.logoGoogle,
    organizationPhone: organization.phone,
    organizationWebsite: organization.website,
    brandColor: organization.brandColor,
    termsAndConditions: template.termsAndConditions,
    templateId: template.id,
    templateName: template.name,
    passDesign,
    passType: template.passType,
    announcement: parseTemplateAnnouncement(template.announcement),
  }, loc))
}

/**
 * Org-level fields (name, logo, phone, website) feed every program's class,
 * so re-sync each program that has ever had a Google pass saved.
 */
export async function syncGoogleLoyaltyClassesForOrganization(organizationId: string): Promise<void> {
  const templates = await db.passTemplate.findMany({
    where: { organizationId, passInstances: { some: { walletProvider: "GOOGLE" } } },
    select: { id: true },
  })
  await Promise.allSettled(templates.map((t) => syncGoogleLoyaltyClass(t.id)))
}

/**
 * Best-effort PATCH of the loyalty class via REST API.
 * Ensures class-level changes (logo, colors, template) propagate
 * even when Google has cached an older version from a previous JWT.
 */
async function patchLoyaltyClass(loyaltyClass: Record<string, unknown>): Promise<void> {
  try {
    const { getAccessToken } = await import("./credentials")
    const { GOOGLE_WALLET_API_BASE, GOOGLE_WALLET_ISSUER_ID } = await import("./constants")
    if (!GOOGLE_WALLET_ISSUER_ID) return

    const token = await getAccessToken()
    const classId = loyaltyClass.id as string

    // Must include reviewStatus when updating an approved class
    const patchBody = { ...loyaltyClass, reviewStatus: "UNDER_REVIEW" }

    const response = await fetch(
      `${GOOGLE_WALLET_API_BASE}/loyaltyClass/${encodeURIComponent(classId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchBody),
      }
    )

    if (!response.ok && response.status !== 404) {
      // 404 is expected for new programs — class is created when user saves the JWT
      const errorText = await response.text().catch(() => "")
      console.error(`Loyalty class PATCH failed (${response.status}):`, errorText.slice(0, 200))
    }
  } catch {
    // Best-effort — don't block pass generation
  }
}

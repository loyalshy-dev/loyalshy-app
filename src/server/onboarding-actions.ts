"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { headers } from "next/headers"
import { db, getNextMemberNumber } from "@/lib/db"
import { sanitizeText } from "@/lib/sanitize"
import { publicFormLimiter, joinPassLimiter } from "@/lib/rate-limit"
import { generateApplePass } from "@/lib/wallet/apple/generate-pass"
import { generateGoogleWalletSaveUrl } from "@/lib/wallet/google/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"
import { buildCardUrl } from "@/lib/card-access"
import { parseCouponConfig, parseMembershipConfig, computeMembershipExpiresAt, parseMinigameConfig, weightedRandomPrize } from "@/lib/pass-config"
import { verifyCardSignature } from "@/lib/card-access"
import type { PublicTemplateInfo } from "@/types/pass-instance"
import type { MinigameConfig } from "@/types/pass-types"

// ─── Types ──────────────────────────────────────────────────

export type OrganizationPublicInfo = {
  id: string
  name: string
  slug: string
  logo: string | null
  logoApple: string | null
  logoGoogle: string | null
  brandColor: string | null
  secondaryColor: string | null
  templates: PublicTemplateInfo[]
}

export type OnboardingResult = {
  success: boolean
  platform?: "apple" | "google"
  passBuffer?: string // base64 for Apple
  saveUrl?: string // for Google
  contactName?: string
  isReturning?: boolean
  error?: string
}

export type JoinResult = {
  success: boolean
  passInstanceId?: string
  contactName?: string
  isReturning?: boolean
  currentCycleVisits?: number
  totalInteractions?: number
  hasAvailableReward?: boolean
  cardUrl?: string
  error?: string
}

// ─── Validation ─────────────────────────────────────────────

const joinSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").max(255).min(1, "Email is required"),
  organizationSlug: z.string().min(1),
  templateId: z.string().min(1),
})

const passRequestSchema = z.object({
  passInstanceId: z.string().min(1),
  organizationSlug: z.string().min(1),
  platform: z.enum(["apple", "google"]),
})

// ─── Get Organization by Slug (Public) ──────────────────────

export async function getOrganizationBySlug(
  slug: string
): Promise<OrganizationPublicInfo | null> {
  const organization = await db.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      logoApple: true,
      logoGoogle: true,
      brandColor: true,
      secondaryColor: true,
      passTemplates: {
        where: { status: "ACTIVE", joinMode: "OPEN" },
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          passDesign: {
            select: {
              cardType: true,
              showStrip: true,
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              stripImageUrl: true,
              patternStyle: true,
              progressStyle: true,
              fontFamily: true,
              labelFormat: true,
              customProgressLabel: true,
              customMessage: true,
              editorConfig: true,
              logoUrl: true,
              logoAppleUrl: true,
              logoGoogleUrl: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!organization) return null

  // Must have at least one active template
  if (organization.passTemplates.length === 0) return null

  // Extract visitsRequired and rewardDescription from config
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo,
    logoApple: organization.logoApple ?? null,
    logoGoogle: organization.logoGoogle ?? null,
    brandColor: organization.brandColor,
    secondaryColor: organization.secondaryColor,
    templates: organization.passTemplates.map((t) => {
      return {
        id: t.id,
        name: t.name,
        passType: t.passType,
        description: null,
        config: t.config,
        passDesign: t.passDesign
          ? {
              cardType: t.passDesign.cardType,
              showStrip: t.passDesign.showStrip,
              primaryColor: t.passDesign.primaryColor,
              secondaryColor: t.passDesign.secondaryColor,
              textColor: t.passDesign.textColor,
              stripImageUrl: t.passDesign.stripImageUrl,
              patternStyle: t.passDesign.patternStyle,
              progressStyle: t.passDesign.progressStyle,
              fontFamily: t.passDesign.fontFamily,
              labelFormat: t.passDesign.labelFormat,
              customProgressLabel: t.passDesign.customProgressLabel,
              customMessage: t.passDesign.customMessage,
              editorConfig: t.passDesign.editorConfig,
              logoUrl: t.passDesign.logoUrl,
              logoAppleUrl: t.passDesign.logoAppleUrl,
              logoGoogleUrl: t.passDesign.logoGoogleUrl,
            }
          : null,
      }
    }),
  }
}

// ─── Get Pass Instance Card Data (for persistent card page) ──

export type PassInstanceCardData = {
  passInstanceId: string
  walletPassId: string | null
  contactName: string
  memberNumber: number | null
  currentCycleVisits: number
  totalInteractions: number
  hasAvailableReward: boolean
  earnedRewardDescription: string | null
  remainingUses: number
  passInstanceStatus: "ACTIVE" | "COMPLETED" | "SUSPENDED" | "EXPIRED" | "REVOKED" | "VOIDED"
  organization: {
    name: string
    slug: string
    logo: string | null
    brandColor: string | null
  }
  template: {
    name: string
    visitsRequired: number
    rewardDescription: string
    passType: string
    config: unknown
    passDesign: PublicTemplateInfo["passDesign"]
  }
  holderPhotoUrl: string | null
  unrevealedReward: { rewardId: string; description: string } | null
  minigameConfig: MinigameConfig | null
}

export async function getPassInstanceCardData(
  passInstanceId: string,
  organizationSlug: string
): Promise<PassInstanceCardData | null> {
  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    select: {
      id: true,
      walletPassId: true,
      data: true,
      status: true,
      rewards: {
        where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
        select: { id: true, status: true, revealedAt: true, description: true },
      },
      contact: {
        select: { fullName: true, memberNumber: true },
      },
      passTemplate: {
        select: {
          name: true,
          status: true,
          passType: true,
          config: true,
          passDesign: {
            select: {
              cardType: true,
              showStrip: true,
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              stripImageUrl: true,
              patternStyle: true,
              progressStyle: true,
              fontFamily: true,
              labelFormat: true,
              customProgressLabel: true,
              customMessage: true,
              editorConfig: true,
              logoUrl: true,
              logoAppleUrl: true,
              logoGoogleUrl: true,
            },
          },
          organization: {
            select: {
              name: true,
              slug: true,
              logo: true,
              brandColor: true,
            },
          },
        },
      },
    },
  })

  if (!passInstance) return null

  // Verify the pass instance belongs to the organization with the given slug
  if (passInstance.passTemplate.organization.slug !== organizationSlug) return null

  // Only show cards for active templates
  if (passInstance.passTemplate.status !== "ACTIVE") return null

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const currentCycleVisits = (instanceData.currentCycleVisits as number) ?? 0
  const totalInteractions = (instanceData.totalInteractions as number) ?? 0
  const remainingUses = (instanceData.remainingUses as number) ?? 0

  const templateConfig = (passInstance.passTemplate.config as Record<string, unknown>) ?? {}
  const visitsRequired = (templateConfig.stampsRequired as number) ?? 10
  const rewardDescription = (templateConfig.rewardDescription as string) ?? "Free reward"

  const pd = passInstance.passTemplate.passDesign

  // Find first unrevealed reward (has description, revealedAt is null)
  const unrevealed = passInstance.rewards.find(
    (r) => r.revealedAt === null && r.description != null
  )

  // Find the most recent available reward description (for display after reveal)
  const availableReward = passInstance.rewards.find((r) => r.status === "AVAILABLE")
  const earnedRewardDescription = availableReward?.description ?? null

  const mgConfig = parseMinigameConfig(passInstance.passTemplate.config)

  return {
    passInstanceId: passInstance.id,
    walletPassId: passInstance.walletPassId,
    contactName: passInstance.contact.fullName,
    memberNumber: passInstance.contact.memberNumber,
    currentCycleVisits,
    totalInteractions,
    remainingUses,
    hasAvailableReward: passInstance.rewards.some((r) => r.status === "AVAILABLE"),
    earnedRewardDescription,
    passInstanceStatus: passInstance.status,
    organization: passInstance.passTemplate.organization,
    template: {
      name: passInstance.passTemplate.name,
      visitsRequired,
      rewardDescription,
      passType: passInstance.passTemplate.passType,
      config: passInstance.passTemplate.config,
      passDesign: pd
        ? {
            cardType: pd.cardType,
            showStrip: pd.showStrip,
            primaryColor: pd.primaryColor,
            secondaryColor: pd.secondaryColor,
            textColor: pd.textColor,
            stripImageUrl: pd.stripImageUrl,
            patternStyle: pd.patternStyle,
            progressStyle: pd.progressStyle,
            fontFamily: pd.fontFamily,
            labelFormat: pd.labelFormat,
            customProgressLabel: pd.customProgressLabel,
            customMessage: pd.customMessage,
            editorConfig: pd.editorConfig,
            logoUrl: pd.logoUrl,
            logoAppleUrl: pd.logoAppleUrl,
            logoGoogleUrl: pd.logoGoogleUrl,
          }
        : null,
    },
    holderPhotoUrl: typeof instanceData.holderPhotoUrl === "string" ? instanceData.holderPhotoUrl : null,
    unrevealedReward: unrevealed
      ? { rewardId: unrevealed.id, description: unrevealed.description! }
      : null,
    minigameConfig: mgConfig,
  }
}

// ─── Join Template (pass instance creation, no wallet pass) ──

export async function joinTemplate(
  formData: FormData
): Promise<JoinResult> {
  // Rate limit by IP — tight limit to prevent bulk pass creation abuse
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { success: rateLimitOk } = joinPassLimiter.check(`join:${ip}`)
  if (!rateLimitOk) {
    return { success: false, error: "Too many requests. Please try again in a while." }
  }

  const raw = {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    organizationSlug: formData.get("organizationSlug") as string,
    templateId: formData.get("templateId") as string,
  }

  const parsed = joinSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const { organizationSlug, templateId } = parsed.data
  const fullName = sanitizeText(parsed.data.fullName, 100)
  const cleanEmail = sanitizeText(parsed.data.email, 255)

  if (!cleanEmail) {
    return { success: false, error: "Valid email address is required." }
  }

  // Fetch organization
  const organization = await db.organization.findUnique({
    where: { slug: organizationSlug },
    select: { id: true },
  })

  if (!organization) {
    return { success: false, error: "Organization not found" }
  }

  // Fetch the specific template
  const template = await db.passTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: organization.id,
      status: "ACTIVE",
    },
    select: { id: true, passType: true, config: true, joinMode: true },
  })

  if (!template) {
    return { success: false, error: "No active pass template found" }
  }

  // Reject self-join for invite-only programs
  if (template.joinMode === "INVITE_ONLY") {
    return { success: false, error: "This program is invite-only. Please contact the business to get a pass." }
  }

  const templateConfig = (template.config as Record<string, unknown>) ?? {}
  const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 90

  // ── Find or create contact ──
  let contact = await db.contact.findUnique({
    where: {
      organizationId_email: { organizationId: organization.id, email: cleanEmail },
    },
    select: {
      id: true,
      fullName: true,
      createdAt: true,
      email: true,
    },
  })

  const isReturningContact = !!contact

  // Create new contact if not found
  if (!contact) {
    const memberNumber = await getNextMemberNumber(organization.id)
    contact = await db.contact.create({
      data: {
        organizationId: organization.id,
        fullName,
        email: cleanEmail,
        memberNumber,
      },
      select: {
        id: true,
        fullName: true,
        createdAt: true,
        email: true,
      },
    })
  }

  // ── Find or create pass instance for this template ──
  type PassInstanceShape = {
    id: string
    data: import("@prisma/client").Prisma.JsonValue
    status: import("@prisma/client").PassInstanceStatus
    walletPassId: string | null
    rewards: { id: string }[]
  }
  let passInstance: PassInstanceShape | null = await db.passInstance.findUnique({
    where: {
      contactId_passTemplateId: {
        contactId: contact.id,
        passTemplateId: template.id,
      },
    },
    select: {
      id: true,
      data: true,
      status: true,
      walletPassId: true,
      rewards: {
        where: { status: "AVAILABLE" },
        select: { id: true },
        take: 1,
      },
    },
  })

  const isReturningInstance = !!passInstance

  // Ensure returning instances have a walletPassId for the browser card QR
  if (passInstance && !passInstance.walletPassId) {
    const walletPassId = randomUUID()
    await db.passInstance.update({
      where: { id: passInstance.id },
      data: { walletPassId },
    })
    passInstance = { ...passInstance, walletPassId } as PassInstanceShape
  }

  if (!passInstance) {
    // Generate walletPassId upfront so the browser card page has a scannable QR
    const walletPassId = randomUUID()

    // Type-specific instance data
    const membershipConfig = template.passType === "MEMBERSHIP" ? parseMembershipConfig(template.config) : null

    const instanceDataObj: Record<string, unknown> = {
      currentCycleVisits: 0,
      totalInteractions: 0,
    }

    passInstance = await db.passInstance.create({
      data: {
        contactId: contact.id,
        passTemplateId: template.id,
        walletPassId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: instanceDataObj as any,
        ...(membershipConfig ? { expiresAt: computeMembershipExpiresAt(membershipConfig) } : {}),
      },
      select: {
        id: true,
        data: true,
        status: true,
        walletPassId: true,
        rewards: {
          where: { status: "AVAILABLE" },
          select: { id: true },
          take: 1,
        },
      },
    }) as PassInstanceShape

    // Auto-create coupon reward for new COUPON pass instances
    if (template.passType === "COUPON") {
      const couponConfig = parseCouponConfig(template.config)
      const expiresAt = couponConfig?.validUntil
        ? new Date(couponConfig.validUntil)
        : rewardExpiryDays > 0
          ? new Date(Date.now() + rewardExpiryDays * 86_400_000)
          : new Date(Date.now() + 365 * 86_400_000) // default 1 year

      // If minigame is enabled, assign a random prize immediately so contact can play the game
      const mgConfig = parseMinigameConfig(template.config)
      const hasPrizes = mgConfig?.enabled && mgConfig.prizes?.length
      const selectedPrize = hasPrizes ? weightedRandomPrize(mgConfig.prizes!) : null

      await db.reward.create({
        data: {
          contactId: contact.id,
          organizationId: organization.id,
          passTemplateId: template.id,
          passInstanceId: passInstance.id,
          status: "AVAILABLE",
          expiresAt,
          ...(selectedPrize ? { description: selectedPrize, revealedAt: null } : {}),
        },
      })

      // Update instance's rewards cache for return value
      passInstance = { ...passInstance!, rewards: [{ id: "auto-created" }] }
    }
  }

  // At this point passInstance is always non-null (either existing or just created)
  const finalPassInstance = passInstance!
  const piData = (finalPassInstance.data as Record<string, unknown>) ?? {}

  return {
    success: true,
    passInstanceId: finalPassInstance.id,
    contactName: contact.fullName,
    isReturning: isReturningContact || isReturningInstance,
    currentCycleVisits: (piData.currentCycleVisits as number) ?? 0,
    totalInteractions: (piData.totalInteractions as number) ?? 0,
    hasAvailableReward: finalPassInstance.rewards.length > 0,
    cardUrl: buildCardUrl(organizationSlug, finalPassInstance.id),
  }
}

// ─── Request Wallet Pass (separate from pass instance creation) ──

export async function requestWalletPass(
  passInstanceId: string,
  organizationSlug: string,
  platform: "apple" | "google"
): Promise<OnboardingResult> {
  // Rate limit by IP
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { success: rateLimitOk } = publicFormLimiter.check(`pass:${ip}`)
  if (!rateLimitOk) {
    return { success: false, error: "Too many requests. Please try again later." }
  }

  const parsed = passRequestSchema.safeParse({ passInstanceId, organizationSlug, platform })
  if (!parsed.success) {
    return { success: false, error: "Invalid request" }
  }

  // Fetch pass instance with linked data
  const passInstance = await db.passInstance.findUnique({
    where: { id: parsed.data.passInstanceId },
    select: {
      id: true,
      data: true,
      walletPassId: true,
      walletPassSerialNumber: true,
      walletProvider: true,
      status: true,
      rewards: {
        where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
        select: { id: true, revealedAt: true, description: true },
        take: 5,
      },
      contact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          memberNumber: true,
          createdAt: true,
        },
      },
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          termsAndConditions: true,
          endsAt: true,
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
        },
      },
    },
  })

  if (!passInstance) {
    return { success: false, error: "Pass instance not found" }
  }

  // Verify the pass instance belongs to the organization with the given slug
  if (passInstance.passTemplate.organization.slug !== parsed.data.organizationSlug) {
    return { success: false, error: "Pass instance not found" }
  }

  const organization = passInstance.passTemplate.organization
  const template = passInstance.passTemplate
  const contact = passInstance.contact
  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const templateConfig = (template.config as Record<string, unknown>) ?? {}

  // Resolve card design for pass generation
  const cardDesign = resolveCardDesign(template.passDesign, organization)

  return issuePassForInstance(
    {
      passInstanceId: passInstance.id,
      contactId: contact.id,
      contactName: contact.fullName,
      contactEmail: contact.email,
      memberNumber: contact.memberNumber,
      contactCreatedAt: contact.createdAt,
      currentCycleVisits: (instanceData.currentCycleVisits as number) ?? 0,
      totalInteractions: (instanceData.totalInteractions as number) ?? 0,
      pointsBalance: (instanceData.pointsBalance as number) ?? 0,
      walletPassId: passInstance.walletPassId,
      walletPassSerialNumber: passInstance.walletPassSerialNumber,
      walletProvider: passInstance.walletProvider,
      hasAvailableReward: passInstance.rewards.length > 0,
      hasUnrevealedPrize: passInstance.rewards.some(
        (r) => r.revealedAt === null && r.description != null
      ),
      holderPhotoUrl: (instanceData.holderPhotoUrl as string) ?? undefined,
    },
    organization,
    {
      id: template.id,
      name: template.name,
      passType: template.passType,
      config: template.config,
      visitsRequired: (templateConfig.stampsRequired as number) ?? 10,
      rewardDescription: (templateConfig.rewardDescription as string) ?? "Free reward",
      rewardExpiryDays: (templateConfig.rewardExpiryDays as number) ?? 90,
      termsAndConditions: template.termsAndConditions,
      endsAt: template.endsAt,
    },
    parsed.data.platform,
    true, // requesting a pass after instance creation is always a "returning" action
    cardDesign,
  )
}

// ─── Issue Pass (shared between new and returning) ──────────

type InstancePassData = {
  passInstanceId: string
  contactId: string
  contactName: string
  contactEmail: string | null
  contactCreatedAt: Date
  memberNumber: number
  currentCycleVisits: number
  totalInteractions: number
  pointsBalance?: number
  walletPassId: string | null
  walletPassSerialNumber: string | null
  walletProvider: string
  hasAvailableReward: boolean
  hasUnrevealedPrize?: boolean
  holderPhotoUrl?: string | null
}

async function issuePassForInstance(
  instance: InstancePassData,
  organization: {
    id: string
    name: string
    slug: string
    logo: string | null
    logoApple: string | null
    logoGoogle: string | null
    brandColor: string | null
    secondaryColor: string | null
    phone: string | null
    website: string | null
  },
  template: {
    id: string
    name: string
    passType: string
    config: unknown
    visitsRequired: number
    rewardDescription: string
    rewardExpiryDays: number
    termsAndConditions: string | null
    endsAt: Date | null
  },
  platform: "apple" | "google",
  isReturning: boolean,
  cardDesign?: import("@/lib/wallet/card-design").CardDesignData | null,
): Promise<OnboardingResult> {
  if (platform === "apple") {
    const serialNumber = instance.walletPassSerialNumber ?? randomUUID()
    const walletPassId = instance.walletPassId ?? randomUUID()

    try {
      const passBuffer = await generateApplePass({
        serialNumber,
        authenticationToken: walletPassId,
        memberNumber: instance.memberNumber,
        customerName: instance.contactName,
        customerEmail: instance.contactEmail,
        currentCycleVisits: instance.currentCycleVisits,
        visitsRequired: template.visitsRequired,
        totalVisits: instance.totalInteractions,
        memberSince: instance.contactCreatedAt,
        hasAvailableReward: instance.hasAvailableReward,
        organizationName: organization.name,
        organizationLogo: cardDesign?.logoUrl ?? organization.logo,
        organizationLogoApple: cardDesign?.logoAppleUrl ?? organization.logoApple,
        organizationLogoGoogle: cardDesign?.logoGoogleUrl ?? organization.logoGoogle,
        brandColor: organization.brandColor,
        secondaryColor: organization.secondaryColor,
        rewardDescription: template.rewardDescription,
        rewardExpiryDays: template.rewardExpiryDays,
        termsAndConditions: template.termsAndConditions,
        organizationPhone: organization.phone,
        organizationWebsite: organization.website,
        cardDesign,
        programType: template.passType,
        programConfig: template.config,
        pointsBalance: instance.pointsBalance ?? 0,
        hasUnrevealedPrize: instance.hasUnrevealedPrize ?? false,
        holderPhotoUrl: instance.holderPhotoUrl ?? undefined,
        passInstanceId: instance.passInstanceId,
        organizationSlug: organization.slug,
      })

      // Store wallet fields on PassInstance
      await db.passInstance.update({
        where: { id: instance.passInstanceId },
        data: {
          walletPassSerialNumber: serialNumber,
          walletPassId: walletPassId,
          walletProvider: "APPLE",
        },
      })

      await db.walletPassLog.create({
        data: {
          passInstanceId: instance.passInstanceId,
          contactId: instance.contactId,
          action: "CREATED",
          details: {
            source: "onboarding",
            isReturning,
            serialNumber,
            templateId: template.id,
          },
        },
      })

      return {
        success: true,
        platform: "apple",
        passBuffer: passBuffer.toString("base64"),
        contactName: instance.contactName,
        isReturning,
      }
    } catch (error) {
      console.error("Failed to generate Apple pass during onboarding:", error instanceof Error ? error.message : "Unknown error")
      return {
        success: false,
        error: "Failed to generate your wallet pass. Please try again.",
      }
    }
  }

  // Google Wallet
  const walletPassId = instance.walletPassId ?? randomUUID()

  try {
    // Check if coupon has minigame with unrevealed prize
    const mgConfig = parseMinigameConfig(template.config)
    const hasUnrevealedPrize = template.passType === "COUPON" && !!mgConfig?.enabled && !!(mgConfig.prizes?.length)

    const saveUrl = await generateGoogleWalletSaveUrl({
      contactId: instance.contactId,
      organizationId: organization.id,
      walletPassId,
      memberNumber: instance.memberNumber,
      contactName: instance.contactName,
      contactEmail: instance.contactEmail,
      currentCycleVisits: instance.currentCycleVisits,
      visitsRequired: template.visitsRequired,
      totalVisits: instance.totalInteractions,
      memberSince: instance.contactCreatedAt,
      hasAvailableReward: instance.hasAvailableReward,
      organizationName: organization.name,
      organizationLogo: cardDesign?.logoUrl ?? organization.logo,
      organizationLogoGoogle: cardDesign?.logoGoogleUrl ?? organization.logoGoogle,
      brandColor: organization.brandColor,
      rewardDescription: template.rewardDescription,
      rewardExpiryDays: template.rewardExpiryDays,
      termsAndConditions: template.termsAndConditions,
      organizationPhone: organization.phone,
      organizationWebsite: organization.website,
      templateName: template.name,
      templateId: template.id,
      passInstanceId: instance.passInstanceId,
      passDesign: cardDesign,
      templateEndsAt: template.endsAt,
      passType: template.passType,
      templateConfig: template.config,
      pointsBalance: instance.pointsBalance ?? 0,
      holderPhotoUrl: instance.holderPhotoUrl ?? undefined,
      hasUnrevealedPrize,
      organizationSlug: organization.slug,
    })

    // Store wallet fields on PassInstance
    await db.passInstance.update({
      where: { id: instance.passInstanceId },
      data: {
        walletPassId,
        walletProvider: "GOOGLE",
      },
    })

    await db.walletPassLog.create({
      data: {
        passInstanceId: instance.passInstanceId,
        contactId: instance.contactId,
        action: "CREATED",
        details: {
          source: "onboarding",
          isReturning,
          platform: "google",
          templateId: template.id,
        },
      },
    })

    return {
      success: true,
      platform: "google",
      saveUrl,
      contactName: instance.contactName,
      isReturning,
    }
  } catch (error) {
    console.error("Failed to generate Google pass during onboarding:", error instanceof Error ? error.message : "Unknown error")
    return {
      success: false,
      error: "Failed to generate your wallet pass. Please try again.",
    }
  }
}

// ─── Reveal Prize (public, HMAC-protected) ──────────────────

const revealPrizeSchema = z.object({
  rewardId: z.string().min(1),
  passInstanceId: z.string().min(1),
  signature: z.string().min(1),
})

export async function revealPrize(
  rewardId: string,
  passInstanceId: string,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  const parsed = revealPrizeSchema.safeParse({ rewardId, passInstanceId, signature })
  if (!parsed.success) {
    return { success: false, error: "Invalid request" }
  }

  // Verify HMAC signature (same as card page access)
  if (!verifyCardSignature(passInstanceId, signature)) {
    return { success: false, error: "Access denied" }
  }

  // Find the unrevealed reward (AVAILABLE for stamp cards, REDEEMED for coupons)
  const reward = await db.reward.findFirst({
    where: {
      id: rewardId,
      passInstanceId,
      status: { in: ["AVAILABLE", "REDEEMED"] },
      revealedAt: null,
    },
    select: { id: true, passInstanceId: true },
  })

  if (!reward) {
    return { success: false, error: "Reward not found or already revealed" }
  }

  // Mark as revealed
  await db.reward.update({
    where: { id: reward.id },
    data: { revealedAt: new Date() },
  })

  // Trigger wallet pass update to refresh pass content
  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    select: { walletProvider: true },
  })

  if (passInstance && passInstance.walletProvider !== "NONE") {
    if (process.env.TRIGGER_SECRET_KEY) {
      import("@trigger.dev/sdk")
        .then(({ tasks }) =>
          tasks.trigger("update-wallet-pass", {
            passInstanceId,
            updateType: "REWARD_EARNED" as const,
          })
        )
        .catch((err: unknown) =>
          console.error("Wallet pass update after reveal failed:", err instanceof Error ? err.message : "Unknown error")
        )
    } else if (passInstance.walletProvider === "GOOGLE") {
      import("@/lib/wallet/google/update-pass")
        .then(({ notifyGooglePassUpdate }) => notifyGooglePassUpdate(passInstanceId))
        .catch((err: unknown) =>
          console.error("Direct Google pass update after reveal failed:", err instanceof Error ? err.message : "Unknown error")
        )
    } else if (passInstance.walletProvider === "APPLE") {
      import("@/lib/wallet/apple/update-pass")
        .then(({ notifyApplePassUpdate }) => notifyApplePassUpdate(passInstanceId))
        .catch((err: unknown) =>
          console.error("Direct Apple pass update after reveal failed:", err instanceof Error ? err.message : "Unknown error")
        )
    }
  }

  return { success: true }
}

"use server"

import { db } from "@/lib/db"
import { assertOrganizationAccess, assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"
import type { TemplateWithDesign } from "@/server/org-settings-actions"
import type { PatternStyle, ProgressStyle, LabelFormat, SocialLinks } from "@/lib/wallet/card-design"
import type { DesignCardType } from "@/types/pass-types"

// ─── Types ─────────────────────────────────────────────────

export type TemplateListItem = {
  id: string
  name: string
  passType: string
  status: string
  config: unknown
  startsAt: Date
  endsAt: Date | null
  createdAt: Date
  passInstanceCount: number
  passDesign: {
    cardType: string
    showStrip: boolean
    primaryColor: string | null
    secondaryColor: string | null
    textColor: string | null
    patternStyle: string
    progressStyle: string
    labelFormat: string
    customProgressLabel: string | null
    stripImageUrl: string | null
    editorConfig: unknown
    logoUrl: string | null
    logoAppleUrl: string | null
    logoGoogleUrl: string | null
  } | null
}

export type TemplateDetail = {
  id: string
  name: string
  passType: string
  status: string
  config: unknown
  termsAndConditions: string | null
  startsAt: Date
  endsAt: Date | null
  createdAt: Date
  passInstanceCount: number
  activePassInstanceCount: number
  totalInteractions: number
  availableRewards: number
  redeemedRewards: number
  // Convenience fields extracted from config for display
  stampsRequired: number | null
  rewardDescription: string | null
  rewardExpiryDays: number | null
}

// ─── Get Templates List ─────────────────────────────────────

export async function getTemplatesList(): Promise<TemplateListItem[]> {
  const organization = await getOrganizationForUser()
  if (!organization) return []

  await assertOrganizationAccess(organization.id)

  const templates = await db.passTemplate.findMany({
    where: { organizationId: organization.id },
    include: {
      _count: {
        select: { passInstances: true },
      },
      passDesign: {
        select: {
          cardType: true,
          showStrip: true,
          primaryColor: true,
          secondaryColor: true,
          textColor: true,
          patternStyle: true,
          progressStyle: true,
          labelFormat: true,
          customProgressLabel: true,
          stripImageUrl: true,
          editorConfig: true,
          logoUrl: true,
          logoAppleUrl: true,
          logoGoogleUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Sort: ACTIVE first, then DRAFT, then ARCHIVED, then by createdAt
  const statusOrder: Record<string, number> = { ACTIVE: 0, DRAFT: 1, ARCHIVED: 2 }

  return templates
    .map((t) => ({
      id: t.id,
      name: t.name,
      passType: t.passType,
      status: t.status,
      config: t.config,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      createdAt: t.createdAt,
      passInstanceCount: t._count.passInstances,
      passDesign: t.passDesign,
    }))
    .sort((a, b) => {
      const sa = statusOrder[a.status] ?? 3
      const sb = statusOrder[b.status] ?? 3
      if (sa !== sb) return sa - sb
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
}

// ─── Get Template Detail ────────────────────────────────────

export async function getTemplateDetail(templateId: string): Promise<TemplateDetail | null> {
  const organization = await getOrganizationForUser()
  if (!organization) return null

  await assertOrganizationAccess(organization.id)

  const template = await db.passTemplate.findFirst({
    where: { id: templateId, organizationId: organization.id },
    include: {
      _count: {
        select: { passInstances: true },
      },
    },
  })

  if (!template) return null

  // Fetch additional stats in parallel
  const [activePassInstances, totalInteractions, availableRewards, redeemedRewards] = await Promise.all([
    db.passInstance.count({
      where: { passTemplateId: templateId, status: "ACTIVE" },
    }),
    db.interaction.count({
      where: { passInstance: { passTemplateId: templateId } },
    }),
    db.reward.count({
      where: { passInstance: { passTemplateId: templateId }, status: "AVAILABLE" },
    }),
    db.reward.count({
      where: { passInstance: { passTemplateId: templateId }, status: "REDEEMED" },
    }),
  ])

  // Extract convenience fields from config JSON
  const cfg = template.config as Record<string, unknown> | null
  const stampsRequired = cfg && typeof cfg.stampsRequired === "number" ? cfg.stampsRequired : null
  const rewardDescription = cfg && typeof cfg.rewardDescription === "string" ? cfg.rewardDescription : null
  const rewardExpiryDays = cfg && typeof cfg.rewardExpiryDays === "number" ? cfg.rewardExpiryDays : null

  return {
    id: template.id,
    name: template.name,
    passType: template.passType,
    status: template.status,
    config: template.config,
    termsAndConditions: template.termsAndConditions,
    startsAt: template.startsAt,
    endsAt: template.endsAt,
    createdAt: template.createdAt,
    passInstanceCount: template._count.passInstances,
    activePassInstanceCount: activePassInstances,
    totalInteractions,
    availableRewards,
    redeemedRewards,
    stampsRequired,
    rewardDescription,
    rewardExpiryDays,
  }
}

// ─── Get Template Pass Instances ────────────────────────────

export type PassInstanceListItem = {
  id: string
  status: string
  walletProvider: string
  data: unknown
  issuedAt: Date
  expiresAt: Date | null
  contact: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
    memberNumber: number
  }
  interactionCount: number
  rewardCount: number
}

export async function getTemplatePassInstances(
  templateId: string,
  opts: {
    page?: number
    perPage?: number
    search?: string
    status?: string
  } = {}
): Promise<{ items: PassInstanceListItem[]; total: number; page: number; perPage: number }> {
  const organization = await getOrganizationForUser()
  if (!organization) return { items: [], total: 0, page: 1, perPage: 20 }

  await assertOrganizationAccess(organization.id)

  const page = opts.page ?? 1
  const perPage = opts.perPage ?? 20
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {
    passTemplateId: templateId,
    passTemplate: { organizationId: organization.id },
  }

  if (opts.status && opts.status !== "all") {
    where.status = opts.status
  }

  if (opts.search) {
    where.contact = {
      OR: [
        { fullName: { contains: opts.search, mode: "insensitive" } },
        { email: { contains: opts.search, mode: "insensitive" } },
        { phone: { contains: opts.search, mode: "insensitive" } },
      ],
    }
  }

  const [items, total] = await Promise.all([
    db.passInstance.findMany({
      where,
      include: {
        contact: {
          select: { id: true, fullName: true, email: true, phone: true, memberNumber: true },
        },
        _count: {
          select: { interactions: true, rewards: true },
        },
      },
      orderBy: { issuedAt: "desc" },
      skip,
      take: perPage,
    }),
    db.passInstance.count({ where }),
  ])

  return {
    items: items.map((pi) => ({
      id: pi.id,
      status: pi.status,
      walletProvider: pi.walletProvider,
      data: pi.data,
      issuedAt: pi.issuedAt,
      expiresAt: pi.expiresAt,
      contact: pi.contact,
      interactionCount: pi._count.interactions,
      rewardCount: pi._count.rewards,
    })),
    total,
    page,
    perPage,
  }
}

// ─── Pass Instance Stats (aggregated per template) ──────────

export type PassInstanceStats = {
  total: number
  active: number
  completed: number
  suspended: number
  expired: number
  revoked: number
  withWallet: number
}

export async function getTemplatePassStats(templateId: string): Promise<PassInstanceStats> {
  const organization = await getOrganizationForUser()
  if (!organization) return { total: 0, active: 0, completed: 0, suspended: 0, expired: 0, revoked: 0, withWallet: 0 }

  await assertOrganizationAccess(organization.id)

  const [total, active, completed, suspended, expired, revoked, withWallet] = await Promise.all([
    db.passInstance.count({ where: { passTemplateId: templateId, passTemplate: { organizationId: organization.id } } }),
    db.passInstance.count({ where: { passTemplateId: templateId, passTemplate: { organizationId: organization.id }, status: "ACTIVE" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, passTemplate: { organizationId: organization.id }, status: "COMPLETED" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, passTemplate: { organizationId: organization.id }, status: "SUSPENDED" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, passTemplate: { organizationId: organization.id }, status: "EXPIRED" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, passTemplate: { organizationId: organization.id }, status: "REVOKED" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, passTemplate: { organizationId: organization.id }, walletProvider: { not: "NONE" } } }),
  ])

  return { total, active, completed, suspended, expired, revoked, withWallet }
}

// ─── Update Pass Instance Status ──────────────────────────────

export async function updatePassInstanceStatus(
  passInstanceId: string,
  newStatus: "ACTIVE" | "SUSPENDED" | "REVOKED"
): Promise<{ success: true } | { error: string }> {
  const organization = await getOrganizationForUser()
  if (!organization) return { error: "Organization not found" }

  await assertOrganizationRole(organization.id, "owner")

  const passInstance = await db.passInstance.findFirst({
    where: {
      id: passInstanceId,
      passTemplate: { organizationId: organization.id },
    },
    select: { id: true, status: true },
  })

  if (!passInstance) return { error: "Pass not found" }

  const now = new Date()
  const updateData: Record<string, unknown> = { status: newStatus }

  if (newStatus === "SUSPENDED") {
    updateData.suspendedAt = now
  } else if (newStatus === "REVOKED") {
    updateData.revokedAt = now
  } else if (newStatus === "ACTIVE") {
    updateData.suspendedAt = null
  }

  await db.passInstance.update({
    where: { id: passInstanceId },
    data: updateData,
  })

  return { success: true }
}

// ─── Get Template For Settings (owner only) ─────────────────

export async function getTemplateForSettings(templateId: string): Promise<TemplateWithDesign | null> {
  const organization = await getOrganizationForUser()
  if (!organization) return null

  await assertOrganizationRole(organization.id, "owner")

  const template = await db.passTemplate.findFirst({
    where: { id: templateId, organizationId: organization.id },
    include: {
      passDesign: true,
      _count: {
        select: { passInstances: true },
      },
    },
  })

  if (!template) return null

  return {
    id: template.id,
    name: template.name,
    passType: template.passType,
    joinMode: template.joinMode,
    config: template.config,
    termsAndConditions: template.termsAndConditions,
    status: template.status,
    startsAt: template.startsAt,
    endsAt: template.endsAt,
    createdAt: template.createdAt,
    passInstanceCount: template._count.passInstances,
    passDesign: template.passDesign
      ? {
          cardType: template.passDesign.cardType as DesignCardType,
          showStrip: template.passDesign.showStrip,
          primaryColor: template.passDesign.primaryColor,
          secondaryColor: template.passDesign.secondaryColor,
          textColor: template.passDesign.textColor,
          stripImageUrl: template.passDesign.stripImageUrl,
          stripImageApple: template.passDesign.stripImageApple,
          stripImageGoogle: template.passDesign.stripImageGoogle,
          patternStyle: template.passDesign.patternStyle as PatternStyle,
          progressStyle: template.passDesign.progressStyle as ProgressStyle,
          labelFormat: template.passDesign.labelFormat as LabelFormat,
          customProgressLabel: template.passDesign.customProgressLabel,
          generatedStripApple: template.passDesign.generatedStripApple,
          generatedStripGoogle: template.passDesign.generatedStripGoogle,
          palettePreset: template.passDesign.palettePreset,
          templateId: template.passDesign.templateId,
          businessHours: template.passDesign.businessHours,
          mapAddress: template.passDesign.mapAddress,
          mapLatitude: template.passDesign.mapLatitude,
          mapLongitude: template.passDesign.mapLongitude,
          socialLinks: template.passDesign.socialLinks as SocialLinks,
          customMessage: template.passDesign.customMessage,
          designHash: template.passDesign.designHash,
        }
      : null,
  }
}

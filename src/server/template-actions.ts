"use server"

import { db } from "@/lib/db"
import { assertOrganizationAccess, assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"
import type { TemplateWithDesign } from "@/server/org-settings-actions"
import type { PatternStyle, ProgressStyle, FontFamily, LabelFormat, SocialLinks } from "@/lib/wallet/card-design"
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
          fontFamily: template.passDesign.fontFamily as FontFamily,
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

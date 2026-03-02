"use server"

import { db } from "@/lib/db"
import { assertRestaurantAccess, assertRestaurantRole, getRestaurantForUser } from "@/lib/dal"
import type { ProgramWithDesign } from "@/server/settings-actions"
import type { CardType, PatternStyle, ProgressStyle, FontFamily, LabelFormat, SocialLinks } from "@/lib/wallet/card-design"

// ─── Types ─────────────────────────────────────────────────

export type ProgramListItem = {
  id: string
  name: string
  programType: string
  status: string
  visitsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
  config: unknown
  startsAt: Date
  endsAt: Date | null
  createdAt: Date
  enrollmentCount: number
  cardDesign: {
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

export type ProgramDetail = {
  id: string
  name: string
  programType: string
  status: string
  visitsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
  config: unknown
  termsAndConditions: string | null
  startsAt: Date
  endsAt: Date | null
  createdAt: Date
  enrollmentCount: number
  activeEnrollmentCount: number
  totalVisits: number
  availableRewards: number
  redeemedRewards: number
}

// ─── Get Programs List ─────────────────────────────────────

export async function getProgramsList(): Promise<ProgramListItem[]> {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) return []

  await assertRestaurantAccess(restaurant.id)

  const programs = await db.loyaltyProgram.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      _count: {
        select: { enrollments: true },
      },
      cardDesign: {
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

  return programs
    .map((p) => ({
      id: p.id,
      name: p.name,
      programType: p.programType,
      status: p.status,
      visitsRequired: p.visitsRequired,
      rewardDescription: p.rewardDescription,
      rewardExpiryDays: p.rewardExpiryDays,
      config: p.config,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      createdAt: p.createdAt,
      enrollmentCount: p._count.enrollments,
      cardDesign: p.cardDesign,
    }))
    .sort((a, b) => {
      const sa = statusOrder[a.status] ?? 3
      const sb = statusOrder[b.status] ?? 3
      if (sa !== sb) return sa - sb
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
}

// ─── Get Program Detail ────────────────────────────────────

export async function getProgramDetail(programId: string): Promise<ProgramDetail | null> {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) return null

  await assertRestaurantAccess(restaurant.id)

  const program = await db.loyaltyProgram.findFirst({
    where: { id: programId, restaurantId: restaurant.id },
    include: {
      _count: {
        select: { enrollments: true },
      },
    },
  })

  if (!program) return null

  // Fetch additional stats in parallel
  const [activeEnrollments, totalVisits, availableRewards, redeemedRewards] = await Promise.all([
    db.enrollment.count({
      where: { loyaltyProgramId: programId, status: "ACTIVE" },
    }),
    db.visit.count({
      where: { enrollment: { loyaltyProgramId: programId } },
    }),
    db.reward.count({
      where: { enrollment: { loyaltyProgramId: programId }, status: "AVAILABLE" },
    }),
    db.reward.count({
      where: { enrollment: { loyaltyProgramId: programId }, status: "REDEEMED" },
    }),
  ])

  return {
    id: program.id,
    name: program.name,
    programType: program.programType,
    status: program.status,
    visitsRequired: program.visitsRequired,
    rewardDescription: program.rewardDescription,
    rewardExpiryDays: program.rewardExpiryDays,
    config: program.config,
    termsAndConditions: program.termsAndConditions,
    startsAt: program.startsAt,
    endsAt: program.endsAt,
    createdAt: program.createdAt,
    enrollmentCount: program._count.enrollments,
    activeEnrollmentCount: activeEnrollments,
    totalVisits,
    availableRewards,
    redeemedRewards,
  }
}

// ─── Get Program For Settings (owner only) ─────────────────

export async function getProgramForSettings(programId: string): Promise<ProgramWithDesign | null> {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) return null

  await assertRestaurantRole(restaurant.id, "owner")

  const program = await db.loyaltyProgram.findFirst({
    where: { id: programId, restaurantId: restaurant.id },
    include: {
      cardDesign: true,
      _count: {
        select: { enrollments: true },
      },
    },
  })

  if (!program) return null

  return {
    id: program.id,
    name: program.name,
    programType: program.programType,
    visitsRequired: program.visitsRequired,
    rewardDescription: program.rewardDescription,
    rewardExpiryDays: program.rewardExpiryDays,
    config: program.config,
    termsAndConditions: program.termsAndConditions,
    status: program.status,
    startsAt: program.startsAt,
    endsAt: program.endsAt,
    createdAt: program.createdAt,
    enrollmentCount: program._count.enrollments,
    cardDesign: program.cardDesign
      ? {
          cardType: program.cardDesign.cardType as CardType,
          showStrip: program.cardDesign.showStrip,
          primaryColor: program.cardDesign.primaryColor,
          secondaryColor: program.cardDesign.secondaryColor,
          textColor: program.cardDesign.textColor,
          stripImageUrl: program.cardDesign.stripImageUrl,
          stripImageApple: program.cardDesign.stripImageApple,
          stripImageGoogle: program.cardDesign.stripImageGoogle,
          patternStyle: program.cardDesign.patternStyle as PatternStyle,
          progressStyle: program.cardDesign.progressStyle as ProgressStyle,
          fontFamily: program.cardDesign.fontFamily as FontFamily,
          labelFormat: program.cardDesign.labelFormat as LabelFormat,
          customProgressLabel: program.cardDesign.customProgressLabel,
          generatedStripApple: program.cardDesign.generatedStripApple,
          generatedStripGoogle: program.cardDesign.generatedStripGoogle,
          palettePreset: program.cardDesign.palettePreset,
          templateId: program.cardDesign.templateId,
          businessHours: program.cardDesign.businessHours,
          mapAddress: program.cardDesign.mapAddress,
          mapLatitude: program.cardDesign.mapLatitude,
          mapLongitude: program.cardDesign.mapLongitude,
          socialLinks: program.cardDesign.socialLinks as SocialLinks,
          customMessage: program.cardDesign.customMessage,
          designHash: program.cardDesign.designHash,
        }
      : null,
  }
}

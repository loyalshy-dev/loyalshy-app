"use server"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationAccess } from "@/lib/dal"
import { generateApplePass } from "@/lib/wallet/apple/generate-pass"
import { generateGoogleWalletSaveUrl } from "@/lib/wallet/google/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"
import { revalidatePath } from "next/cache"

// ─── Types ──────────────────────────────────────────────────

export type IssueAppleWalletPassResult = {
  success: boolean
  passBuffer?: string // base64
  error?: string
}

export type IssueGoogleWalletPassResult = {
  success: boolean
  saveUrl?: string
  error?: string
}

// ─── Issue Apple Wallet Pass ────────────────────────────────

export async function issueAppleWalletPass(
  passInstanceId: string
): Promise<IssueAppleWalletPassResult> {
  const session = await assertAuthenticated()
  const organization = await getOrganizationForUser()

  if (!organization) {
    return { success: false, error: "No organization found" }
  }

  await assertOrganizationAccess(organization.id)

  // Fetch pass instance with contact, template, and pass design
  const passInstance = await db.passInstance.findFirst({
    where: { id: passInstanceId },
    select: {
      id: true,
      data: true,
      walletPassSerialNumber: true,
      walletPassId: true,
      walletProvider: true,
      issuedAt: true,
      contact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          memberNumber: true,
          organizationId: true,
        },
      },
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          termsAndConditions: true,
          organizationId: true,
          passDesign: true,
        },
      },
      rewards: {
        where: { status: "AVAILABLE" },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!passInstance) {
    return { success: false, error: "Pass instance not found" }
  }

  // Verify the pass instance belongs to this organization
  if (passInstance.contact.organizationId !== organization.id) {
    return { success: false, error: "Pass instance not found" }
  }

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const templateConfig = (passInstance.passTemplate.config as Record<string, unknown>) ?? {}

  // Reuse existing serial/token or generate new ones
  const serialNumber = passInstance.walletPassSerialNumber ?? randomUUID()
  const walletPassId = passInstance.walletPassId ?? randomUUID()
  const hasAvailableReward = passInstance.rewards.length > 0

  // Resolve card design from the template's passDesign
  const cardDesign = resolveCardDesign(
    passInstance.passTemplate.passDesign,
    organization
  )

  try {
    const passBuffer = await generateApplePass({
      serialNumber,
      authenticationToken: walletPassId,
      memberNumber: passInstance.contact.memberNumber,
      customerName: passInstance.contact.fullName,
      customerEmail: passInstance.contact.email,
      currentCycleVisits: (instanceData.currentCycleVisits as number) ?? 0,
      visitsRequired: (templateConfig.stampsRequired as number) ?? 10,
      totalVisits: (instanceData.totalInteractions as number) ?? 0,
      memberSince: passInstance.issuedAt,
      hasAvailableReward,
      organizationName: organization.name,
      organizationLogo: cardDesign.logoUrl ?? organization.logo,
      organizationLogoApple: cardDesign.logoAppleUrl ?? organization.logoApple,
      organizationLogoGoogle: cardDesign.logoGoogleUrl ?? organization.logoGoogle,
      brandColor: organization.brandColor,
      secondaryColor: organization.secondaryColor,
      rewardDescription: (templateConfig.rewardDescription as string) ?? "Free reward",
      rewardExpiryDays: (templateConfig.rewardExpiryDays as number) ?? 90,
      termsAndConditions: passInstance.passTemplate.termsAndConditions,
      organizationPhone: organization.phone,
      organizationWebsite: organization.website,
      programName: passInstance.passTemplate.name,
      cardDesign,
      programType: passInstance.passTemplate.passType,
      programConfig: passInstance.passTemplate.config,
      pointsBalance: (instanceData.pointsBalance as number) ?? 0,
      remainingUses: (instanceData.remainingUses as number) ?? 0,
      giftBalanceCents: (instanceData.balanceCents as number) ?? undefined,
      giftCurrency: (instanceData.currency as string) ?? undefined,
      ticketScanCount: (instanceData.scanCount as number) ?? 0,
      accessTotalGranted: (instanceData.totalGranted as number) ?? 0,
      transitIsBoarded: (instanceData.isBoarded as boolean) ?? false,
      businessIdVerifications: (instanceData.totalVerifications as number) ?? 0,
    })

    // Update pass instance with wallet pass fields
    await db.passInstance.update({
      where: { id: passInstance.id },
      data: {
        walletPassSerialNumber: serialNumber,
        walletPassId: walletPassId,
        walletProvider: "APPLE",
      },
    })

    // Log pass creation
    await db.walletPassLog.create({
      data: {
        passInstanceId: passInstance.id,
        action: "CREATED",
        details: {
          issuedBy: session.user.id,
          serialNumber,
        },
      },
    })

    revalidatePath("/dashboard/contacts")

    return {
      success: true,
      passBuffer: passBuffer.toString("base64"),
    }
  } catch (error) {
    console.error("Failed to generate Apple Wallet pass:", error instanceof Error ? error.message : "Unknown error")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate pass",
    }
  }
}

// ─── Issue Google Wallet Pass ───────────────────────────────

export async function issueGoogleWalletPass(
  passInstanceId: string
): Promise<IssueGoogleWalletPassResult> {
  const session = await assertAuthenticated()
  const organization = await getOrganizationForUser()

  if (!organization) {
    return { success: false, error: "No organization found" }
  }

  await assertOrganizationAccess(organization.id)

  // Fetch pass instance with contact, template, and pass design
  const passInstance = await db.passInstance.findFirst({
    where: { id: passInstanceId },
    select: {
      id: true,
      data: true,
      walletPassId: true,
      walletProvider: true,
      issuedAt: true,
      contact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          memberNumber: true,
          organizationId: true,
        },
      },
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          termsAndConditions: true,
          organizationId: true,
          endsAt: true,
          passDesign: true,
        },
      },
      rewards: {
        where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
        select: { id: true, revealedAt: true, description: true },
        take: 5,
      },
    },
  })

  if (!passInstance) {
    return { success: false, error: "Pass instance not found" }
  }

  // Verify the pass instance belongs to this organization
  if (passInstance.contact.organizationId !== organization.id) {
    return { success: false, error: "Pass instance not found" }
  }

  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const templateConfig = (passInstance.passTemplate.config as Record<string, unknown>) ?? {}

  // Reuse existing walletPassId or generate a new one
  const walletPassId = passInstance.walletPassId ?? randomUUID()
  const hasAvailableReward = passInstance.rewards.length > 0
  const hasUnrevealedPrize = passInstance.rewards.some(
    (r: { revealedAt: Date | null; description: string | null }) => r.revealedAt === null && r.description != null
  )

  // Resolve card design from the template's passDesign
  const cardDesign = resolveCardDesign(
    passInstance.passTemplate.passDesign,
    organization
  )

  try {
    const saveUrl = await generateGoogleWalletSaveUrl({
      contactId: passInstance.contact.id,
      organizationId: organization.id,
      walletPassId,
      memberNumber: passInstance.contact.memberNumber,
      contactName: passInstance.contact.fullName,
      contactEmail: passInstance.contact.email,
      currentCycleVisits: (instanceData.currentCycleVisits as number) ?? 0,
      visitsRequired: (templateConfig.stampsRequired as number) ?? 10,
      totalVisits: (instanceData.totalInteractions as number) ?? 0,
      memberSince: passInstance.issuedAt,
      hasAvailableReward,
      organizationName: organization.name,
      organizationLogo: cardDesign.logoUrl ?? organization.logo,
      organizationLogoGoogle: cardDesign.logoGoogleUrl ?? organization.logoGoogle,
      brandColor: organization.brandColor,
      rewardDescription: (templateConfig.rewardDescription as string) ?? "Free reward",
      rewardExpiryDays: (templateConfig.rewardExpiryDays as number) ?? 90,
      termsAndConditions: passInstance.passTemplate.termsAndConditions,
      organizationPhone: organization.phone,
      organizationWebsite: organization.website,
      templateName: passInstance.passTemplate.name,
      templateId: passInstance.passTemplate.id,
      passInstanceId: passInstance.id,
      passDesign: cardDesign,
      templateEndsAt: passInstance.passTemplate.endsAt,
      passType: passInstance.passTemplate.passType,
      templateConfig: passInstance.passTemplate.config,
      pointsBalance: (instanceData.pointsBalance as number) ?? 0,
      remainingUses: (instanceData.remainingUses as number) ?? 0,
      giftBalanceCents: (instanceData.balanceCents as number) ?? undefined,
      giftCurrency: (instanceData.currency as string) ?? undefined,
      ticketScanCount: (instanceData.scanCount as number) ?? 0,
      accessTotalGranted: (instanceData.totalGranted as number) ?? 0,
      transitIsBoarded: (instanceData.isBoarded as boolean) ?? false,
      businessIdVerifications: (instanceData.totalVerifications as number) ?? 0,
      hasUnrevealedPrize,
      organizationSlug: organization.slug,
    })

    // Update pass instance with wallet pass fields
    await db.passInstance.update({
      where: { id: passInstance.id },
      data: {
        walletPassId,
        walletProvider: "GOOGLE",
      },
    })

    // Log pass creation
    await db.walletPassLog.create({
      data: {
        passInstanceId: passInstance.id,
        action: "CREATED",
        details: {
          issuedBy: session.user.id,
          platform: "google",
        },
      },
    })

    revalidatePath("/dashboard/contacts")

    return { success: true, saveUrl }
  } catch (error) {
    console.error("Failed to generate Google Wallet pass:", error instanceof Error ? error.message : "Unknown error")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate pass",
    }
  }
}

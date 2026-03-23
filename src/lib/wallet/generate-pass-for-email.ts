import "server-only"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { generateApplePass } from "@/lib/wallet/apple/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"
import { uploadFile } from "@/lib/storage"

/**
 * Generate an Apple Wallet .pkpass, upload it to R2, and return the public URL.
 * iOS Safari opens .pkpass URLs with the native "Add to Apple Wallet" dialog.
 * Returns the public URL + serialNumber, or null if generation fails.
 */
export async function generateApplePassForEmail(
  passInstanceId: string
): Promise<{ url: string; serialNumber: string } | null> {
  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    select: {
      id: true,
      data: true,
      status: true,
      walletPassId: true,
      walletPassSerialNumber: true,
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
      rewards: {
        where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
        select: { id: true, status: true },
        take: 1,
      },
    },
  })

  if (!passInstance || passInstance.status === "REVOKED" || passInstance.status === "VOIDED") {
    return null
  }

  const template = passInstance.passTemplate
  const organization = template.organization
  const contact = passInstance.contact

  const instanceData = (passInstance.data ?? {}) as Record<string, unknown>
  const currentCycleVisits = (instanceData.currentCycleVisits as number) ?? 0
  const totalInteractions = (instanceData.totalVisits as number) ?? (instanceData.totalInteractions as number) ?? 0
  const pointsBalance = (instanceData.pointsBalance as number) ?? 0
  const remainingUses = (instanceData.remainingUses as number) ?? 0

  const templateConfig = (template.config ?? {}) as Record<string, unknown>
  const visitsRequired = (templateConfig.stampsRequired as number) ?? 10
  const rewardDescription = (templateConfig.rewardDescription as string) ?? "Free reward"
  const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 90

  const cardDesign = resolveCardDesign(template.passDesign, organization)

  const walletPassId = passInstance.walletPassId ?? randomUUID()
  const serialNumber = passInstance.walletPassSerialNumber ?? randomUUID()

  try {
    const passBuffer = await generateApplePass({
      serialNumber,
      authenticationToken: walletPassId,
      memberNumber: contact.memberNumber,
      customerName: contact.fullName,
      customerEmail: contact.email,
      currentCycleVisits,
      visitsRequired,
      totalVisits: totalInteractions,
      memberSince: contact.createdAt,
      hasAvailableReward: passInstance.rewards.some((r) => r.status === "AVAILABLE"),
      organizationName: organization.name,
      organizationLogo: cardDesign.logoUrl ?? organization.logo,
      organizationLogoApple: cardDesign.logoAppleUrl ?? organization.logoApple,
      organizationLogoGoogle: cardDesign.logoGoogleUrl ?? organization.logoGoogle,
      brandColor: organization.brandColor,
      secondaryColor: organization.secondaryColor,
      rewardDescription,
      rewardExpiryDays,
      termsAndConditions: template.termsAndConditions,
      organizationPhone: organization.phone,
      organizationWebsite: organization.website,
      programName: template.name,
      cardDesign,
      programType: template.passType,
      programConfig: template.config,
      pointsBalance,
      remainingUses,
      holderPhotoUrl: (instanceData.holderPhotoUrl as string) ?? undefined,
      passInstanceId: passInstance.id,
      organizationSlug: organization.slug,
    })

    // Upload .pkpass to R2 — iOS Safari opens these URLs with native wallet dialog
    const url = await uploadFile(
      Buffer.from(passBuffer),
      `passes/${passInstanceId}.pkpass`,
      "application/vnd.apple.pkpass"
    )

    // Update pass instance with wallet details
    await db.passInstance.update({
      where: { id: passInstance.id },
      data: {
        walletPassSerialNumber: serialNumber,
        walletPassId,
        walletProvider: "APPLE",
      },
    })

    await db.walletPassLog.create({
      data: {
        passInstanceId: passInstance.id,
        contactId: contact.id,
        action: "CREATED",
        details: { source: "email-r2", platform: "apple", serialNumber },
      },
    })

    return { url, serialNumber }
  } catch (error) {
    console.error(
      "Failed to generate Apple pass for email:",
      error instanceof Error ? error.message : "Unknown error"
    )
    return null
  }
}

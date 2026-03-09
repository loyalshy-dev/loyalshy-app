import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { verifyCardSignature } from "@/lib/card-access"
import { generateApplePass } from "@/lib/wallet/apple/generate-pass"
import { generateGoogleWalletSaveUrl } from "@/lib/wallet/google/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"
import { parseMinigameConfig } from "@/lib/pass-config"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ passInstanceId: string }> }
) {
  const { passInstanceId } = await params
  const url = new URL(request.url)
  const sig = url.searchParams.get("sig")
  const platform = url.searchParams.get("platform")

  if (!sig || !platform || !["apple", "google"].includes(platform)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Verify HMAC signature
  if (!verifyCardSignature(passInstanceId, sig)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    select: {
      id: true,
      data: true,
      status: true,
      walletPassId: true,
      walletPassSerialNumber: true,
      walletProvider: true,
      issuedAt: true,
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
      rewards: {
        where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
        select: { id: true, revealedAt: true, status: true },
        take: 1,
      },
    },
  })

  if (!passInstance || passInstance.status === "REVOKED" || passInstance.status === "VOIDED") {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 })
  }

  const template = passInstance.passTemplate
  const organization = template.organization
  const contact = passInstance.contact

  const instanceData = (passInstance.data ?? {}) as Record<string, unknown>
  const currentCycleVisits = (instanceData.currentCycleVisits as number) ?? 0
  const totalInteractions = (instanceData.totalInteractions as number) ?? 0
  const pointsBalance = (instanceData.pointsBalance as number) ?? 0
  const remainingUses = (instanceData.remainingUses as number) ?? 0

  const templateConfig = (template.config ?? {}) as Record<string, unknown>
  const visitsRequired = (templateConfig.stampsRequired as number) ?? 10
  const rewardDescription = (templateConfig.rewardDescription as string) ?? "Free reward"
  const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 90

  const cardDesign = resolveCardDesign(template.passDesign, organization)

  // Ensure walletPassId exists
  const walletPassId = passInstance.walletPassId ?? randomUUID()
  const serialNumber = passInstance.walletPassSerialNumber ?? randomUUID()

  if (platform === "apple") {
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
        organizationLogo: organization.logo,
        organizationLogoApple: organization.logoApple,
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
        passInstanceId: passInstance.id,
        organizationSlug: organization.slug,
      })

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
          details: { source: "email-download", platform: "apple", serialNumber },
        },
      })

      return new NextResponse(new Uint8Array(passBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="${serialNumber}.pkpass"`,
        },
      })
    } catch (error) {
      console.error("Failed to generate Apple pass from email:", error instanceof Error ? error.message : "Unknown error")
      return NextResponse.json({ error: "Failed to generate pass" }, { status: 500 })
    }
  }

  // Google Wallet — redirect to save URL
  try {
    const mgConfig = parseMinigameConfig(template.config)
    const hasUnrevealedPrize = template.passType === "COUPON" && !!mgConfig?.enabled && !!(mgConfig.prizes?.length)

    const saveUrl = await generateGoogleWalletSaveUrl({
      contactId: contact.id,
      organizationId: organization.id,
      walletPassId,
      memberNumber: contact.memberNumber,
      contactName: contact.fullName,
      contactEmail: contact.email,
      currentCycleVisits,
      visitsRequired,
      totalVisits: totalInteractions,
      memberSince: contact.createdAt,
      hasAvailableReward: passInstance.rewards.some((r) => r.status === "AVAILABLE"),
      organizationName: organization.name,
      organizationLogo: organization.logo,
      organizationLogoGoogle: organization.logoGoogle,
      brandColor: organization.brandColor,
      rewardDescription,
      rewardExpiryDays,
      termsAndConditions: template.termsAndConditions,
      organizationPhone: organization.phone,
      organizationWebsite: organization.website,
      templateName: template.name,
      templateId: template.id,
      passInstanceId: passInstance.id,
      passDesign: cardDesign,
      templateEndsAt: template.endsAt,
      passType: template.passType,
      templateConfig: template.config,
      pointsBalance,
      remainingUses,
      hasUnrevealedPrize,
      organizationSlug: organization.slug,
    })

    // Update pass instance
    await db.passInstance.update({
      where: { id: passInstance.id },
      data: { walletPassId, walletProvider: "GOOGLE" },
    })

    await db.walletPassLog.create({
      data: {
        passInstanceId: passInstance.id,
        contactId: contact.id,
        action: "CREATED",
        details: { source: "email-download", platform: "google" },
      },
    })

    return NextResponse.redirect(saveUrl)
  } catch (error) {
    console.error("Failed to generate Google pass from email:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json({ error: "Failed to generate pass" }, { status: 500 })
  }
}

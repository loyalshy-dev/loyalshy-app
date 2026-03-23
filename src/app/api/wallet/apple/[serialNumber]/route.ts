import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyCardSignature } from "@/lib/card-access"
import { generateApplePass } from "@/lib/wallet/apple/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serialNumber: string }> }
) {
  const { serialNumber } = await params

  // Verify HMAC signature
  const url = new URL(request.url)
  const sig = url.searchParams.get("sig")
  if (!sig || !verifyCardSignature(serialNumber, sig)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  // Query PassInstance by walletPassSerialNumber
  const passInstance = await db.passInstance.findUnique({
    where: { walletPassSerialNumber: serialNumber },
    select: {
      id: true,
      data: true,
      walletPassSerialNumber: true,
      walletPassId: true,
      issuedAt: true,
      contact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          memberNumber: true,
        },
      },
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          termsAndConditions: true,
          organization: {
            select: {
              name: true,
              logo: true,
              logoApple: true,
              logoGoogle: true,
              brandColor: true,
              secondaryColor: true,
              phone: true,
              website: true,
            },
          },
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

  if (!passInstance || !passInstance.walletPassSerialNumber || !passInstance.walletPassId) {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 })
  }

  const template = passInstance.passTemplate
  const organization = template.organization

  // Extract data from the PassInstance.data JSON
  const instanceData = (passInstance.data ?? {}) as Record<string, unknown>
  const currentCycleVisits = (instanceData.currentCycleVisits as number) ?? 0
  const totalVisits = (instanceData.totalVisits as number) ?? 0
  const pointsBalance = (instanceData.pointsBalance as number) ?? 0
  const remainingUses = (instanceData.remainingUses as number) ?? 0

  // Extract config values from PassTemplate.config JSON
  const templateConfig = (template.config ?? {}) as Record<string, unknown>
  const visitsRequired = (templateConfig.stampsRequired as number) ?? 10
  const rewardDescription = (templateConfig.rewardDescription as string) ?? "Free reward"
  const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 30

  const passDesign = resolveCardDesign(
    template.passDesign,
    organization
  )

  try {
    const passBuffer = await generateApplePass({
      serialNumber: passInstance.walletPassSerialNumber,
      authenticationToken: passInstance.walletPassId,
      memberNumber: passInstance.contact.memberNumber,
      customerName: passInstance.contact.fullName,
      customerEmail: passInstance.contact.email,
      currentCycleVisits,
      visitsRequired,
      totalVisits,
      memberSince: passInstance.issuedAt,
      hasAvailableReward: passInstance.rewards.length > 0,
      organizationName: organization.name,
      organizationLogo: passDesign.logoUrl ?? organization.logo,
      organizationLogoApple: passDesign.logoAppleUrl ?? organization.logoApple,
      organizationLogoGoogle: passDesign.logoGoogleUrl ?? organization.logoGoogle,
      brandColor: organization.brandColor,
      secondaryColor: organization.secondaryColor,
      rewardDescription,
      rewardExpiryDays,
      termsAndConditions: template.termsAndConditions,
      organizationPhone: organization.phone,
      organizationWebsite: organization.website,
      programName: template.name,
      cardDesign: passDesign,
      programType: template.passType,
      programConfig: template.config,
      pointsBalance,
      remainingUses,
      holderPhotoUrl: (instanceData.holderPhotoUrl as string) ?? undefined,
    })

    return new NextResponse(new Uint8Array(passBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${serialNumber}.pkpass"`,
      },
    })
  } catch (error) {
    console.error("Failed to generate pass for download:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json(
      { error: "Failed to generate pass" },
      { status: 500 }
    )
  }
}

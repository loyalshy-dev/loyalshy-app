import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/dal"
import { generateGoogleWalletSaveUrl } from "@/lib/wallet/google/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"
import { apiRouteLimiter } from "@/lib/rate-limit"

/**
 * POST /api/wallet/google/save-url
 *
 * Generates a "Save to Google Wallet" URL for a pass instance.
 * Requires authentication — the pass instance must belong to the user's organization.
 *
 * Body: { passInstanceId: string }
 * Returns: { saveUrl: string }
 */
export async function POST(request: Request) {
  try {
    // Auth check
    const session = await getCurrentUser()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limit by session user ID
    const { success: rateLimitOk } = apiRouteLimiter.check(`save-url:${session.user.id}`)
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      )
    }

    const body = (await request.json()) as { passInstanceId?: string }
    const { passInstanceId } = body

    if (!passInstanceId) {
      return NextResponse.json(
        { error: "passInstanceId is required" },
        { status: 400 }
      )
    }

    // Scope pass instance lookup to the user's active organization
    const organizationId = session.session.activeOrganizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: "No organization associated with your session" },
        { status: 403 }
      )
    }

    const passInstance = await db.passInstance.findFirst({
      where: {
        id: passInstanceId,
        contact: { organizationId, deletedAt: null },
      },
      select: {
        id: true,
        data: true,
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
            endsAt: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
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
          where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
          select: { id: true, revealedAt: true, description: true },
          take: 5,
        },
      },
    })

    if (!passInstance) {
      return NextResponse.json(
        { error: "Pass instance not found" },
        { status: 404 }
      )
    }

    const template = passInstance.passTemplate
    const organization = template.organization

    const walletPassId = passInstance.walletPassId
    if (!walletPassId) {
      return NextResponse.json(
        { error: "Pass instance wallet pass not initialized. Issue pass from dashboard first." },
        { status: 400 }
      )
    }

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

    const hasUnrevealedPrize = passInstance.rewards.some(
      (r: { revealedAt: Date | null; description: string | null }) => r.revealedAt === null && r.description != null
    )

    const saveUrl = await generateGoogleWalletSaveUrl({
      contactId: passInstance.contact.id,
      organizationId: organization.id,
      walletPassId,
      memberNumber: passInstance.contact.memberNumber,
      contactName: passInstance.contact.fullName,
      contactEmail: passInstance.contact.email,
      currentCycleVisits,
      visitsRequired,
      totalVisits,
      memberSince: passInstance.issuedAt,
      hasAvailableReward: passInstance.rewards.length > 0,
      organizationName: organization.name,
      organizationLogo: passDesign.logoUrl ?? organization.logo,
      organizationLogoGoogle: passDesign.logoGoogleUrl ?? organization.logoGoogle,
      brandColor: organization.brandColor,
      rewardDescription,
      rewardExpiryDays,
      termsAndConditions: template.termsAndConditions,
      organizationPhone: organization.phone,
      organizationWebsite: organization.website,
      templateName: template.name,
      templateId: template.id,
      passInstanceId: passInstance.id,
      passDesign: passDesign,
      templateEndsAt: template.endsAt,
      passType: template.passType,
      templateConfig: template.config,
      pointsBalance,
      remainingUses,
      hasUnrevealedPrize,
      organizationSlug: organization.slug,
    })

    return NextResponse.json({ saveUrl })
  } catch (error) {
    console.error("Failed to generate Google Wallet save URL:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json(
      { error: "Failed to generate save URL" },
      { status: 500 }
    )
  }
}

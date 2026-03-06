import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/dal"
import { generateGoogleWalletSaveUrl } from "@/lib/wallet/google/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"
import { apiRouteLimiter } from "@/lib/rate-limit"

/**
 * POST /api/wallet/google/save-url
 *
 * Generates a "Save to Google Wallet" URL for an enrollment.
 * Requires authentication — the enrollment must belong to the user's restaurant.
 *
 * Body: { enrollmentId: string }
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

    const body = (await request.json()) as { enrollmentId?: string }
    const { enrollmentId } = body

    if (!enrollmentId) {
      return NextResponse.json(
        { error: "enrollmentId is required" },
        { status: 400 }
      )
    }

    // Scope enrollment lookup to the user's restaurant
    const restaurantId = session.user.restaurantId
    if (!restaurantId) {
      return NextResponse.json(
        { error: "No restaurant associated with your account" },
        { status: 403 }
      )
    }

    const enrollment = await db.enrollment.findFirst({
      where: {
        id: enrollmentId,
        customer: { restaurantId, deletedAt: null },
      },
      select: {
        id: true,
        currentCycleVisits: true,
        totalVisits: true,
        pointsBalance: true,
        remainingUses: true,
        walletPassId: true,
        enrolledAt: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        loyaltyProgram: {
          select: {
            id: true,
            name: true,
            programType: true,
            config: true,
            visitsRequired: true,
            rewardDescription: true,
            rewardExpiryDays: true,
            termsAndConditions: true,
            endsAt: true,
            restaurant: {
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
            cardDesign: true,
          },
        },
        rewards: {
          where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
          select: { id: true, revealedAt: true, description: true },
          take: 5,
        },
      },
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      )
    }

    const program = enrollment.loyaltyProgram
    const restaurant = program.restaurant

    const walletPassId = enrollment.walletPassId
    if (!walletPassId) {
      return NextResponse.json(
        { error: "Enrollment wallet pass not initialized. Issue pass from dashboard first." },
        { status: 400 }
      )
    }

    const cardDesign = resolveCardDesign(
      program.cardDesign,
      restaurant
    )

    const hasUnrevealedPrize = enrollment.rewards.some(
      (r: { revealedAt: Date | null; description: string | null }) => r.revealedAt === null && r.description != null
    )

    const saveUrl = await generateGoogleWalletSaveUrl({
      customerId: enrollment.customer.id,
      restaurantId: restaurant.id,
      walletPassId,
      customerName: enrollment.customer.fullName,
      customerEmail: enrollment.customer.email,
      currentCycleVisits: enrollment.currentCycleVisits,
      visitsRequired: program.visitsRequired,
      totalVisits: enrollment.totalVisits,
      memberSince: enrollment.enrolledAt,
      hasAvailableReward: enrollment.rewards.length > 0,
      restaurantName: restaurant.name,
      restaurantLogo: restaurant.logo,
      restaurantLogoGoogle: restaurant.logoGoogle,
      brandColor: restaurant.brandColor,
      rewardDescription: program.rewardDescription,
      rewardExpiryDays: program.rewardExpiryDays,
      termsAndConditions: program.termsAndConditions,
      restaurantPhone: restaurant.phone,
      restaurantWebsite: restaurant.website,
      programName: program.name,
      programId: program.id,
      enrollmentId: enrollment.id,
      cardDesign,
      programEndsAt: program.endsAt,
      programType: program.programType,
      programConfig: program.config,
      pointsBalance: enrollment.pointsBalance ?? 0,
      remainingUses: enrollment.remainingUses ?? 0,
      hasUnrevealedPrize,
      restaurantSlug: restaurant.slug,
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

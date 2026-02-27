import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateApplePass } from "@/lib/wallet/apple/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ serialNumber: string }> }
) {
  const { serialNumber } = await params

  // Query Enrollment by walletPassSerialNumber instead of Customer
  const enrollment = await db.enrollment.findUnique({
    where: { walletPassSerialNumber: serialNumber },
    select: {
      id: true,
      currentCycleVisits: true,
      totalVisits: true,
      walletPassSerialNumber: true,
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
          visitsRequired: true,
          rewardDescription: true,
          rewardExpiryDays: true,
          termsAndConditions: true,
          restaurant: {
            select: {
              name: true,
              logo: true,
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
        where: { status: "AVAILABLE" },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!enrollment || !enrollment.walletPassSerialNumber || !enrollment.walletPassId) {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 })
  }

  const program = enrollment.loyaltyProgram
  const restaurant = program.restaurant

  const cardDesign = resolveCardDesign(
    program.cardDesign,
    restaurant
  )

  try {
    const passBuffer = await generateApplePass({
      serialNumber: enrollment.walletPassSerialNumber,
      authenticationToken: enrollment.walletPassId,
      customerName: enrollment.customer.fullName,
      customerEmail: enrollment.customer.email,
      currentCycleVisits: enrollment.currentCycleVisits,
      visitsRequired: program.visitsRequired,
      totalVisits: enrollment.totalVisits,
      memberSince: enrollment.enrolledAt,
      hasAvailableReward: enrollment.rewards.length > 0,
      restaurantName: restaurant.name,
      restaurantLogo: restaurant.logo,
      brandColor: restaurant.brandColor,
      secondaryColor: restaurant.secondaryColor,
      rewardDescription: program.rewardDescription,
      rewardExpiryDays: program.rewardExpiryDays,
      termsAndConditions: program.termsAndConditions,
      restaurantPhone: restaurant.phone,
      restaurantWebsite: restaurant.website,
      programName: program.name,
      cardDesign,
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

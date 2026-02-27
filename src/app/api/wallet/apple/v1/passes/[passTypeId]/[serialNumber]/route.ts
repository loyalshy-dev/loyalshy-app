import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateApplePassAuth } from "@/lib/wallet/apple/auth"
import { generateApplePass } from "@/lib/wallet/apple/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"

type Params = Promise<{
  passTypeId: string
  serialNumber: string
}>

// ── GET: Serve the latest pass to Apple Wallet ──

export async function GET(request: Request, { params }: { params: Params }) {
  const { serialNumber } = await params

  const { valid, enrollmentId } = await validateApplePassAuth(
    request,
    serialNumber
  )
  if (!valid || !enrollmentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      currentCycleVisits: true,
      totalVisits: true,
      walletPassSerialNumber: true,
      walletPassId: true,
      enrolledAt: true,
      updatedAt: true,
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

  // If-Modified-Since support: return 304 if the pass hasn't changed
  const ifModifiedSince = request.headers.get("If-Modified-Since")
  if (ifModifiedSince) {
    const sinceDate = new Date(ifModifiedSince)
    if (enrollment.updatedAt <= sinceDate) {
      return new NextResponse(null, { status: 304 })
    }
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

    // Log update
    await db.walletPassLog.create({
      data: {
        enrollmentId: enrollment.id,
        action: "UPDATED",
        details: { trigger: "apple_wallet_fetch" },
      },
    })

    return new NextResponse(new Uint8Array(passBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": enrollment.updatedAt.toUTCString(),
      },
    })
  } catch (error) {
    console.error("Failed to serve updated pass:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json(
      { error: "Failed to generate pass" },
      { status: 500 }
    )
  }
}

"use server"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantAccess } from "@/lib/dal"
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
  enrollmentId: string
): Promise<IssueAppleWalletPassResult> {
  const session = await assertAuthenticated()
  const restaurant = await getRestaurantForUser()

  if (!restaurant) {
    return { success: false, error: "No restaurant found" }
  }

  await assertRestaurantAccess(restaurant.id)

  // Fetch enrollment with customer, program, and card design
  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentId },
    select: {
      id: true,
      currentCycleVisits: true,
      totalVisits: true,
      walletPassSerialNumber: true,
      walletPassId: true,
      walletPassType: true,
      enrolledAt: true,
      customer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          restaurantId: true,
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
          restaurantId: true,
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

  if (!enrollment) {
    return { success: false, error: "Enrollment not found" }
  }

  // Verify the enrollment belongs to this restaurant
  if (enrollment.customer.restaurantId !== restaurant.id) {
    return { success: false, error: "Enrollment not found" }
  }

  // Reuse existing serial/token or generate new ones
  const serialNumber = enrollment.walletPassSerialNumber ?? randomUUID()
  const walletPassId = enrollment.walletPassId ?? randomUUID()
  const hasAvailableReward = enrollment.rewards.length > 0

  // Resolve card design from the program's cardDesign
  const cardDesign = resolveCardDesign(
    enrollment.loyaltyProgram.cardDesign,
    restaurant
  )

  try {
    const passBuffer = await generateApplePass({
      serialNumber,
      authenticationToken: walletPassId,
      customerName: enrollment.customer.fullName,
      customerEmail: enrollment.customer.email,
      currentCycleVisits: enrollment.currentCycleVisits,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
      totalVisits: enrollment.totalVisits,
      memberSince: enrollment.enrolledAt,
      hasAvailableReward,
      restaurantName: restaurant.name,
      restaurantLogo: restaurant.logo,
      restaurantLogoApple: restaurant.logoApple,
      brandColor: restaurant.brandColor,
      secondaryColor: restaurant.secondaryColor,
      rewardDescription: enrollment.loyaltyProgram.rewardDescription,
      rewardExpiryDays: enrollment.loyaltyProgram.rewardExpiryDays,
      termsAndConditions: enrollment.loyaltyProgram.termsAndConditions,
      restaurantPhone: restaurant.phone,
      restaurantWebsite: restaurant.website,
      programName: enrollment.loyaltyProgram.name,
      cardDesign,
    })

    // Update enrollment with wallet pass fields
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: {
        walletPassSerialNumber: serialNumber,
        walletPassId: walletPassId,
        walletPassType: "APPLE",
      },
    })

    // Log pass creation
    await db.walletPassLog.create({
      data: {
        enrollmentId: enrollment.id,
        action: "CREATED",
        details: {
          issuedBy: session.user.id,
          serialNumber,
        },
      },
    })

    revalidatePath("/dashboard/customers")

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
  enrollmentId: string
): Promise<IssueGoogleWalletPassResult> {
  const session = await assertAuthenticated()
  const restaurant = await getRestaurantForUser()

  if (!restaurant) {
    return { success: false, error: "No restaurant found" }
  }

  await assertRestaurantAccess(restaurant.id)

  // Fetch enrollment with customer, program, and card design
  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentId },
    select: {
      id: true,
      currentCycleVisits: true,
      totalVisits: true,
      walletPassId: true,
      walletPassType: true,
      enrolledAt: true,
      customer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          restaurantId: true,
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
          restaurantId: true,
          endsAt: true,
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

  if (!enrollment) {
    return { success: false, error: "Enrollment not found" }
  }

  // Verify the enrollment belongs to this restaurant
  if (enrollment.customer.restaurantId !== restaurant.id) {
    return { success: false, error: "Enrollment not found" }
  }

  // Reuse existing walletPassId or generate a new one
  const walletPassId = enrollment.walletPassId ?? randomUUID()
  const hasAvailableReward = enrollment.rewards.length > 0

  // Resolve card design from the program's cardDesign
  const cardDesign = resolveCardDesign(
    enrollment.loyaltyProgram.cardDesign,
    restaurant
  )

  try {
    const saveUrl = generateGoogleWalletSaveUrl({
      customerId: enrollment.customer.id,
      restaurantId: restaurant.id,
      walletPassId,
      customerName: enrollment.customer.fullName,
      customerEmail: enrollment.customer.email,
      currentCycleVisits: enrollment.currentCycleVisits,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
      totalVisits: enrollment.totalVisits,
      memberSince: enrollment.enrolledAt,
      hasAvailableReward,
      restaurantName: restaurant.name,
      restaurantLogo: restaurant.logo,
      restaurantLogoGoogle: restaurant.logoGoogle,
      brandColor: restaurant.brandColor,
      rewardDescription: enrollment.loyaltyProgram.rewardDescription,
      rewardExpiryDays: enrollment.loyaltyProgram.rewardExpiryDays,
      termsAndConditions: enrollment.loyaltyProgram.termsAndConditions,
      restaurantPhone: restaurant.phone,
      restaurantWebsite: restaurant.website,
      programName: enrollment.loyaltyProgram.name,
      programId: enrollment.loyaltyProgram.id,
      enrollmentId: enrollment.id,
      cardDesign,
      programEndsAt: enrollment.loyaltyProgram.endsAt,
    })

    // Update enrollment with wallet pass fields
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: {
        walletPassId,
        walletPassType: "GOOGLE",
      },
    })

    // Log pass creation
    await db.walletPassLog.create({
      data: {
        enrollmentId: enrollment.id,
        action: "CREATED",
        details: {
          issuedBy: session.user.id,
          platform: "google",
        },
      },
    })

    revalidatePath("/dashboard/customers")

    return { success: true, saveUrl }
  } catch (error) {
    console.error("Failed to generate Google Wallet pass:", error instanceof Error ? error.message : "Unknown error")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate pass",
    }
  }
}

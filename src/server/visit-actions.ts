"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantAccess } from "@/lib/dal"
import { parseCouponConfig, formatCouponValue, parsePointsConfig, parseMinigameConfig } from "@/lib/program-config"
import type { EnrollmentSummary } from "@/types/enrollment"

// ─── Types ──────────────────────────────────────────────────

export type VisitSearchResult = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  totalVisits: number
  lastVisitAt: Date | null
  enrollments: EnrollmentSummary[]
}

export type RegisterVisitResult = {
  success: boolean
  error?: string
  wasRewardEarned: boolean
  rewardDescription?: string
  newCycleVisits: number
  newTotalVisits: number
  visitsRequired: number
  programName?: string
}

export type RedeemCouponResult = {
  success: boolean
  error?: string
  couponDescription?: string
  discountText?: string
  selectedPrize?: string
  redemptionLimit?: "single" | "unlimited"
  programName?: string
}

export type CheckInResult = {
  success: boolean
  error?: string
  totalCheckIns?: number
  memberSince?: Date
  programName?: string
}

export type EarnPointsResult = {
  success: boolean
  error?: string
  pointsEarned?: number
  newBalance?: number
  totalVisits?: number
  programName?: string
}

export type RedeemPointsResult = {
  success: boolean
  error?: string
  itemName?: string
  pointsSpent?: number
  newBalance?: number
  programName?: string
}

// ─── QR Scan Lookup ──────────────────────────────────────────

export type ScanLookupResult = {
  success: boolean
  error?: string
  errorType?: "NOT_FOUND" | "FROZEN" | "COMPLETED" | "MARKETING_QR" | "INVALID_FORMAT"
  customer?: VisitSearchResult
  enrollment?: EnrollmentSummary
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function lookupEnrollmentByWalletPassId(
  walletPassId: string
): Promise<ScanLookupResult> {
  await assertAuthenticated()
  const restaurant = await getRestaurantForUser()
  if (!restaurant) {
    return { success: false, error: "No restaurant found", errorType: "NOT_FOUND" }
  }

  // Reject URLs (marketing QR codes)
  if (walletPassId.startsWith("http://") || walletPassId.startsWith("https://")) {
    return {
      success: false,
      error: "This is a join link, not a wallet pass. Scan the QR code on the customer's wallet.",
      errorType: "MARKETING_QR",
    }
  }

  // Validate UUID format
  if (!UUID_RE.test(walletPassId.trim())) {
    return {
      success: false,
      error: "Unrecognized QR code. Please scan a wallet pass.",
      errorType: "INVALID_FORMAT",
    }
  }

  const enrollment = await db.enrollment.findUnique({
    where: { walletPassId: walletPassId.trim() },
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          totalVisits: true,
          lastVisitAt: true,
          restaurantId: true,
          deletedAt: true,
        },
      },
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          programType: true,
          visitsRequired: true,
          status: true,
          config: true,
          cardDesign: {
            select: {
              cardType: true,
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              showStrip: true,
              patternStyle: true,
              progressStyle: true,
              labelFormat: true,
              customProgressLabel: true,
              stripImageUrl: true,
              editorConfig: true,
            },
          },
        },
      },
    },
  })

  if (!enrollment) {
    return {
      success: false,
      error: "Card not recognized. The customer may need to re-add their wallet pass.",
      errorType: "NOT_FOUND",
    }
  }

  // Cross-tenant check — don't leak data
  if (enrollment.customer.restaurantId !== restaurant.id) {
    return {
      success: false,
      error: "Card not recognized. The customer may need to re-add their wallet pass.",
      errorType: "NOT_FOUND",
    }
  }

  // Soft-deleted customer
  if (enrollment.customer.deletedAt) {
    return {
      success: false,
      error: "Card not recognized. The customer may need to re-add their wallet pass.",
      errorType: "NOT_FOUND",
    }
  }

  // Frozen enrollment
  if (enrollment.status === "FROZEN") {
    return {
      success: false,
      error: "This loyalty card is frozen. The program may have ended.",
      errorType: "FROZEN",
    }
  }

  // Completed enrollment
  if (enrollment.status === "COMPLETED") {
    return {
      success: false,
      error: "This loyalty program is complete.",
      errorType: "COMPLETED",
    }
  }

  // Fetch all active enrollments for this customer (needed for VisitSearchResult)
  const allEnrollments = await db.enrollment.findMany({
    where: {
      customerId: enrollment.customer.id,
      status: "ACTIVE",
      loyaltyProgram: { status: "ACTIVE" },
    },
    select: {
      id: true,
      currentCycleVisits: true,
      totalVisits: true,
      pointsBalance: true,
      walletPassType: true,
      status: true,
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          programType: true,
          visitsRequired: true,
          config: true,
          cardDesign: {
            select: {
              cardType: true,
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              showStrip: true,
              patternStyle: true,
              progressStyle: true,
              labelFormat: true,
              customProgressLabel: true,
              stripImageUrl: true,
              editorConfig: true,
            },
          },
        },
      },
    },
  })

  const customer: VisitSearchResult = {
    id: enrollment.customer.id,
    fullName: enrollment.customer.fullName,
    email: enrollment.customer.email,
    phone: enrollment.customer.phone,
    totalVisits: enrollment.customer.totalVisits,
    lastVisitAt: enrollment.customer.lastVisitAt,
    enrollments: allEnrollments.map((e) => ({
      enrollmentId: e.id,
      programId: e.loyaltyProgram.id,
      programName: e.loyaltyProgram.name,
      programType: e.loyaltyProgram.programType,
      currentCycleVisits: e.currentCycleVisits,
      visitsRequired: e.loyaltyProgram.visitsRequired,
      totalVisits: e.totalVisits,
      pointsBalance: e.pointsBalance,
      programConfig: e.loyaltyProgram.config,
      status: e.status,
      walletPassType: e.walletPassType,
      cardDesign: e.loyaltyProgram.cardDesign
        ? {
            cardType: e.loyaltyProgram.cardDesign.cardType,
            primaryColor: e.loyaltyProgram.cardDesign.primaryColor,
            secondaryColor: e.loyaltyProgram.cardDesign.secondaryColor,
            textColor: e.loyaltyProgram.cardDesign.textColor,
            showStrip: e.loyaltyProgram.cardDesign.showStrip,
            patternStyle: e.loyaltyProgram.cardDesign.patternStyle,
            progressStyle: e.loyaltyProgram.cardDesign.progressStyle,
            labelFormat: e.loyaltyProgram.cardDesign.labelFormat,
            customProgressLabel: e.loyaltyProgram.cardDesign.customProgressLabel,
            stripImageUrl: e.loyaltyProgram.cardDesign.stripImageUrl,
          }
        : null,
      minigameConfig: parseMinigameConfig(e.loyaltyProgram.config),
    })),
  }

  const enrollmentSummary: EnrollmentSummary = {
    enrollmentId: enrollment.id,
    programId: enrollment.loyaltyProgram.id,
    programName: enrollment.loyaltyProgram.name,
    programType: enrollment.loyaltyProgram.programType,
    currentCycleVisits: enrollment.currentCycleVisits,
    visitsRequired: enrollment.loyaltyProgram.visitsRequired,
    totalVisits: enrollment.totalVisits,
    pointsBalance: enrollment.pointsBalance,
    programConfig: enrollment.loyaltyProgram.config,
    status: enrollment.status,
    walletPassType: enrollment.walletPassType,
    cardDesign: enrollment.loyaltyProgram.cardDesign
      ? {
          cardType: enrollment.loyaltyProgram.cardDesign.cardType,
          primaryColor: enrollment.loyaltyProgram.cardDesign.primaryColor,
          secondaryColor: enrollment.loyaltyProgram.cardDesign.secondaryColor,
          textColor: enrollment.loyaltyProgram.cardDesign.textColor,
          showStrip: enrollment.loyaltyProgram.cardDesign.showStrip,
          patternStyle: enrollment.loyaltyProgram.cardDesign.patternStyle,
          progressStyle: enrollment.loyaltyProgram.cardDesign.progressStyle,
          labelFormat: enrollment.loyaltyProgram.cardDesign.labelFormat,
          customProgressLabel: enrollment.loyaltyProgram.cardDesign.customProgressLabel,
          stripImageUrl: enrollment.loyaltyProgram.cardDesign.stripImageUrl,
        }
      : null,
    minigameConfig: parseMinigameConfig(enrollment.loyaltyProgram.config),
  }

  return {
    success: true,
    customer,
    enrollment: enrollmentSummary,
  }
}

// ─── Search Customers for Visit Registration ────────────────

export type VisitSearchResponse = {
  customers: VisitSearchResult[]
}

export async function searchCustomersForVisit(
  query: string
): Promise<VisitSearchResponse> {
  await assertAuthenticated()
  const restaurant = await getRestaurantForUser()
  if (!restaurant) return { customers: [] }

  const search = query.trim()
  if (!search) return { customers: [] }

  const customers = await db.customer.findMany({
    where: {
      restaurantId: restaurant.id,
      deletedAt: null,
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      totalVisits: true,
      lastVisitAt: true,
      enrollments: {
        where: {
          status: "ACTIVE",
          loyaltyProgram: { status: "ACTIVE" },
        },
        select: {
          id: true,
          currentCycleVisits: true,
          totalVisits: true,
          pointsBalance: true,
          walletPassType: true,
          status: true,
          loyaltyProgram: {
            select: {
              id: true,
              name: true,
              programType: true,
              visitsRequired: true,
              config: true,
              cardDesign: {
                select: {
                  cardType: true,
                  primaryColor: true,
                  secondaryColor: true,
                  textColor: true,
                  showStrip: true,
                  patternStyle: true,
                  progressStyle: true,
                  labelFormat: true,
                  customProgressLabel: true,
                  stripImageUrl: true,
                  editorConfig: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { fullName: "asc" },
    take: 10,
  })

  return {
    customers: customers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      totalVisits: c.totalVisits,
      lastVisitAt: c.lastVisitAt,
      enrollments: c.enrollments.map((e) => ({
        enrollmentId: e.id,
        programId: e.loyaltyProgram.id,
        programName: e.loyaltyProgram.name,
        programType: e.loyaltyProgram.programType,
        currentCycleVisits: e.currentCycleVisits,
        visitsRequired: e.loyaltyProgram.visitsRequired,
        totalVisits: e.totalVisits,
        pointsBalance: e.pointsBalance,
        programConfig: e.loyaltyProgram.config,
        status: e.status,
        walletPassType: e.walletPassType,
        cardDesign: e.loyaltyProgram.cardDesign
          ? {
              cardType: e.loyaltyProgram.cardDesign.cardType,
              primaryColor: e.loyaltyProgram.cardDesign.primaryColor,
              secondaryColor: e.loyaltyProgram.cardDesign.secondaryColor,
              textColor: e.loyaltyProgram.cardDesign.textColor,
              showStrip: e.loyaltyProgram.cardDesign.showStrip,
              patternStyle: e.loyaltyProgram.cardDesign.patternStyle,
              progressStyle: e.loyaltyProgram.cardDesign.progressStyle,
              labelFormat: e.loyaltyProgram.cardDesign.labelFormat,
              customProgressLabel: e.loyaltyProgram.cardDesign.customProgressLabel,
              stripImageUrl: e.loyaltyProgram.cardDesign.stripImageUrl,
            }
          : null,
        minigameConfig: parseMinigameConfig(e.loyaltyProgram.config),
      })),
    })),
  }
}

// ─── Weighted Random Prize Selection ─────────────────────────

function weightedRandomPrize(prizes: { name: string; weight: number }[]): string {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0)
  let rand = Math.random() * totalWeight
  for (const prize of prizes) {
    rand -= prize.weight
    if (rand <= 0) return prize.name
  }
  return prizes[prizes.length - 1].name
}

// ─── Register Visit ─────────────────────────────────────────

export async function registerVisit(
  enrollmentId: string
): Promise<RegisterVisitResult> {
  const session = await assertAuthenticated()
  const restaurant = await getRestaurantForUser()

  if (!restaurant) {
    return {
      success: false,
      error: "No restaurant found",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalVisits: 0,
      visitsRequired: 0,
    }
  }

  // Verify staff has access to this restaurant
  await assertRestaurantAccess(restaurant.id)

  // Fetch enrollment with program and customer
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      customer: {
        select: {
          id: true,
          restaurantId: true,
          deletedAt: true,
          totalVisits: true,
          fullName: true,
        },
      },
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          programType: true,
          visitsRequired: true,
          rewardDescription: true,
          rewardExpiryDays: true,
          config: true,
          status: true,
          endsAt: true,
        },
      },
    },
  })

  if (!enrollment) {
    return {
      success: false,
      error: "Enrollment not found",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalVisits: 0,
      visitsRequired: 0,
    }
  }

  // Validate enrollment belongs to this restaurant
  if (enrollment.customer.restaurantId !== restaurant.id) {
    return {
      success: false,
      error: "Enrollment not found",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalVisits: 0,
      visitsRequired: 0,
    }
  }

  // Check customer not soft-deleted
  if (enrollment.customer.deletedAt) {
    return {
      success: false,
      error: "Customer has been deleted",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalVisits: 0,
      visitsRequired: 0,
    }
  }

  // Check enrollment is ACTIVE
  if (enrollment.status !== "ACTIVE") {
    return {
      success: false,
      error: `This enrollment is ${enrollment.status.toLowerCase()}`,
      wasRewardEarned: false,
      newCycleVisits: enrollment.currentCycleVisits,
      newTotalVisits: enrollment.totalVisits,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
    }
  }

  // Check program is ACTIVE
  if (enrollment.loyaltyProgram.status !== "ACTIVE") {
    return {
      success: false,
      error: "This loyalty program is no longer active",
      wasRewardEarned: false,
      newCycleVisits: enrollment.currentCycleVisits,
      newTotalVisits: enrollment.totalVisits,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
    }
  }

  // Only stamp card programs support visit registration
  if (enrollment.loyaltyProgram.programType !== "STAMP_CARD") {
    return {
      success: false,
      error: "Visit registration is only available for stamp card programs",
      wasRewardEarned: false,
      newCycleVisits: enrollment.currentCycleVisits,
      newTotalVisits: enrollment.totalVisits,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
    }
  }

  // Check program hasn't expired
  if (enrollment.loyaltyProgram.endsAt && enrollment.loyaltyProgram.endsAt < new Date()) {
    return {
      success: false,
      error: "This loyalty program has expired",
      wasRewardEarned: false,
      newCycleVisits: enrollment.currentCycleVisits,
      newTotalVisits: enrollment.totalVisits,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
    }
  }

  const program = enrollment.loyaltyProgram

  // Prevent double-registration within 1 minute
  const oneMinuteAgo = new Date(Date.now() - 60_000)
  const recentVisit = await db.visit.findFirst({
    where: {
      enrollmentId: enrollment.id,
      createdAt: { gte: oneMinuteAgo },
    },
    select: { id: true },
  })

  if (recentVisit) {
    return {
      success: false,
      error: "A visit was already registered for this enrollment less than a minute ago",
      wasRewardEarned: false,
      newCycleVisits: enrollment.currentCycleVisits,
      newTotalVisits: enrollment.totalVisits,
      visitsRequired: program.visitsRequired,
    }
  }

  // Calculate new visit counts
  const newCycleVisits = enrollment.currentCycleVisits + 1
  const newEnrollmentTotalVisits = enrollment.totalVisits + 1
  const newCustomerTotalVisits = enrollment.customer.totalVisits + 1
  const wasRewardEarned = newCycleVisits >= program.visitsRequired

  // Pick a weighted random prize if minigame has prizes configured
  let selectedPrize: string | undefined
  if (wasRewardEarned) {
    const mgConfig = parseMinigameConfig(program.config)
    if (mgConfig?.enabled && mgConfig.prizes?.length) {
      selectedPrize = weightedRandomPrize(mgConfig.prizes)
    }
  }

  // Run everything in a transaction
  await db.$transaction(async (tx) => {
    // Create Visit record
    await tx.visit.create({
      data: {
        customerId: enrollment.customer.id,
        restaurantId: restaurant.id,
        loyaltyProgramId: program.id,
        enrollmentId: enrollment.id,
        registeredById: session.user.id,
        visitNumber: newCycleVisits,
      },
    })

    if (wasRewardEarned) {
      // Reset cycle on enrollment and create reward
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          currentCycleVisits: 0,
          totalVisits: newEnrollmentTotalVisits,
        },
      })

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + program.rewardExpiryDays)

      await tx.reward.create({
        data: {
          customerId: enrollment.customer.id,
          restaurantId: restaurant.id,
          loyaltyProgramId: program.id,
          enrollmentId: enrollment.id,
          status: "AVAILABLE",
          expiresAt,
          description: selectedPrize ?? null,
          revealedAt: (selectedPrize && parseMinigameConfig(program.config)?.enabled) ? null : new Date(),
        },
      })
    } else {
      // Just increment enrollment visits
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          currentCycleVisits: newCycleVisits,
          totalVisits: newEnrollmentTotalVisits,
        },
      })
    }

    // Always update Customer denormalized counters
    await tx.customer.update({
      where: { id: enrollment.customer.id },
      data: {
        totalVisits: newCustomerTotalVisits,
        lastVisitAt: new Date(),
      },
    })
  })

  // Dispatch wallet pass update via Trigger.dev (async background job)
  if (enrollment.walletPassType !== "NONE") {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-wallet-pass", {
          enrollmentId: enrollment.id,
          updateType: wasRewardEarned ? "REWARD_EARNED" : "VISIT",
        })
      )
      .catch((err: unknown) => console.error("Wallet pass update dispatch failed:", err instanceof Error ? err.message : "Unknown error"))
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")

  return {
    success: true,
    wasRewardEarned,
    rewardDescription: wasRewardEarned ? (selectedPrize ?? program.rewardDescription) : undefined,
    newCycleVisits: wasRewardEarned ? 0 : newCycleVisits,
    newTotalVisits: newEnrollmentTotalVisits,
    visitsRequired: program.visitsRequired,
    programName: program.name,
  }
}

// ─── Redeem Coupon ──────────────────────────────────────────

export async function redeemCoupon(
  enrollmentId: string
): Promise<RedeemCouponResult> {
  const session = await assertAuthenticated()
  const restaurant = await getRestaurantForUser()

  if (!restaurant) {
    return { success: false, error: "No restaurant found" }
  }

  await assertRestaurantAccess(restaurant.id)

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      customer: {
        select: {
          id: true,
          restaurantId: true,
          deletedAt: true,
          fullName: true,
        },
      },
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          programType: true,
          config: true,
          rewardDescription: true,
          rewardExpiryDays: true,
          status: true,
        },
      },
    },
  })

  if (!enrollment) {
    return { success: false, error: "Enrollment not found" }
  }

  if (enrollment.customer.restaurantId !== restaurant.id) {
    return { success: false, error: "Enrollment not found" }
  }

  if (enrollment.customer.deletedAt) {
    return { success: false, error: "Customer has been deleted" }
  }

  if (enrollment.status !== "ACTIVE") {
    return {
      success: false,
      error: `This enrollment is ${enrollment.status.toLowerCase()}`,
    }
  }

  if (enrollment.loyaltyProgram.status !== "ACTIVE") {
    return { success: false, error: "This loyalty program is no longer active" }
  }

  if (enrollment.loyaltyProgram.programType !== "COUPON") {
    return { success: false, error: "This is not a coupon program" }
  }

  const program = enrollment.loyaltyProgram
  const couponConfig = parseCouponConfig(program.config)

  // Find an available reward to redeem
  const reward = await db.reward.findFirst({
    where: { enrollmentId: enrollment.id, status: "AVAILABLE" },
    select: { id: true },
  })

  if (!reward) {
    return { success: false, error: "No available coupon to redeem" }
  }

  const redemptionLimit = couponConfig?.redemptionLimit ?? "single"

  // Pick a weighted random prize if minigame has prizes configured
  let selectedPrize: string | undefined
  const mgConfig = parseMinigameConfig(program.config)
  if (mgConfig?.enabled && mgConfig.prizes?.length) {
    selectedPrize = weightedRandomPrize(mgConfig.prizes)
  }

  await db.$transaction(async (tx) => {
    // Mark reward as redeemed
    await tx.reward.update({
      where: { id: reward.id },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedById: session.user.id,
        ...(selectedPrize ? { description: selectedPrize } : {}),
        revealedAt: (selectedPrize && mgConfig?.enabled) ? null : new Date(),
      },
    })

    // Increment total rewards redeemed on enrollment
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        totalRewardsRedeemed: { increment: 1 },
        ...(redemptionLimit === "single" ? { status: "COMPLETED" } : {}),
      },
    })

    // For unlimited coupons, auto-create a new available reward
    if (redemptionLimit === "unlimited") {
      const expiresAt = couponConfig?.validUntil
        ? new Date(couponConfig.validUntil)
        : program.rewardExpiryDays > 0
          ? new Date(Date.now() + program.rewardExpiryDays * 86_400_000)
          : new Date(Date.now() + 365 * 86_400_000) // default 1 year

      await tx.reward.create({
        data: {
          customerId: enrollment.customer.id,
          restaurantId: restaurant.id,
          loyaltyProgramId: program.id,
          enrollmentId: enrollment.id,
          status: "AVAILABLE",
          expiresAt,
        },
      })
    }
  })

  // Dispatch wallet pass update
  if (enrollment.walletPassType !== "NONE") {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-wallet-pass", {
          enrollmentId: enrollment.id,
          updateType: "REWARD_REDEEMED",
        })
      )
      .catch((err: unknown) => console.error("Wallet pass update dispatch failed:", err instanceof Error ? err.message : "Unknown error"))
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/programs")

  const discountText = couponConfig ? formatCouponValue(couponConfig) : program.rewardDescription

  return {
    success: true,
    couponDescription: couponConfig?.couponDescription ?? program.rewardDescription,
    discountText,
    selectedPrize,
    redemptionLimit,
    programName: program.name,
  }
}

// ─── Check In Member ────────────────────────────────────────

export async function checkInMember(
  enrollmentId: string
): Promise<CheckInResult> {
  const session = await assertAuthenticated()
  const restaurant = await getRestaurantForUser()

  if (!restaurant) {
    return { success: false, error: "No restaurant found" }
  }

  await assertRestaurantAccess(restaurant.id)

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      customer: {
        select: {
          id: true,
          restaurantId: true,
          deletedAt: true,
          totalVisits: true,
          fullName: true,
        },
      },
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          programType: true,
          config: true,
          status: true,
          endsAt: true,
        },
      },
    },
  })

  if (!enrollment) {
    return { success: false, error: "Enrollment not found" }
  }

  if (enrollment.customer.restaurantId !== restaurant.id) {
    return { success: false, error: "Enrollment not found" }
  }

  if (enrollment.customer.deletedAt) {
    return { success: false, error: "Customer has been deleted" }
  }

  if (enrollment.status !== "ACTIVE") {
    return {
      success: false,
      error: `This enrollment is ${enrollment.status.toLowerCase()}`,
    }
  }

  if (enrollment.loyaltyProgram.status !== "ACTIVE") {
    return { success: false, error: "This loyalty program is no longer active" }
  }

  if (enrollment.loyaltyProgram.programType !== "MEMBERSHIP") {
    return { success: false, error: "Check-in is only available for membership programs" }
  }

  // Prevent double check-in within 1 minute
  const oneMinuteAgo = new Date(Date.now() - 60_000)
  const recentVisit = await db.visit.findFirst({
    where: {
      enrollmentId: enrollment.id,
      createdAt: { gte: oneMinuteAgo },
    },
    select: { id: true },
  })

  if (recentVisit) {
    return {
      success: false,
      error: "A check-in was already recorded for this membership less than a minute ago",
    }
  }

  const program = enrollment.loyaltyProgram
  const newEnrollmentTotalVisits = enrollment.totalVisits + 1
  const newCustomerTotalVisits = enrollment.customer.totalVisits + 1

  await db.$transaction(async (tx) => {
    // Create Visit record
    await tx.visit.create({
      data: {
        customerId: enrollment.customer.id,
        restaurantId: restaurant.id,
        loyaltyProgramId: program.id,
        enrollmentId: enrollment.id,
        registeredById: session.user.id,
        visitNumber: newEnrollmentTotalVisits,
      },
    })

    // Increment enrollment totalVisits only (no currentCycleVisits, no rewards)
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        totalVisits: newEnrollmentTotalVisits,
      },
    })

    // Update customer denormalized counters
    await tx.customer.update({
      where: { id: enrollment.customer.id },
      data: {
        totalVisits: newCustomerTotalVisits,
        lastVisitAt: new Date(),
      },
    })
  })

  // Dispatch wallet pass update via Trigger.dev
  if (enrollment.walletPassType !== "NONE") {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-wallet-pass", {
          enrollmentId: enrollment.id,
          updateType: "CHECK_IN",
        })
      )
      .catch((err: unknown) => console.error("Wallet pass update dispatch failed:", err instanceof Error ? err.message : "Unknown error"))
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/programs")

  return {
    success: true,
    totalCheckIns: newEnrollmentTotalVisits,
    memberSince: enrollment.enrolledAt,
    programName: program.name,
  }
}

// ─── Earn Points ──────────────────────────────────────────────

export async function earnPoints(
  enrollmentId: string
): Promise<EarnPointsResult> {
  const session = await assertAuthenticated()
  const restaurant = await getRestaurantForUser()

  if (!restaurant) {
    return { success: false, error: "No restaurant found" }
  }

  await assertRestaurantAccess(restaurant.id)

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      customer: {
        select: {
          id: true,
          restaurantId: true,
          deletedAt: true,
          totalVisits: true,
          fullName: true,
        },
      },
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          programType: true,
          config: true,
          status: true,
          endsAt: true,
        },
      },
    },
  })

  if (!enrollment) {
    return { success: false, error: "Enrollment not found" }
  }

  if (enrollment.customer.restaurantId !== restaurant.id) {
    return { success: false, error: "Enrollment not found" }
  }

  if (enrollment.customer.deletedAt) {
    return { success: false, error: "Customer has been deleted" }
  }

  if (enrollment.status !== "ACTIVE") {
    return {
      success: false,
      error: `This enrollment is ${enrollment.status.toLowerCase()}`,
    }
  }

  if (enrollment.loyaltyProgram.status !== "ACTIVE") {
    return { success: false, error: "This loyalty program is no longer active" }
  }

  if (enrollment.loyaltyProgram.programType !== "POINTS") {
    return { success: false, error: "Earning points is only available for points programs" }
  }

  const program = enrollment.loyaltyProgram
  const pointsConfig = parsePointsConfig(program.config)

  if (!pointsConfig) {
    return { success: false, error: "Invalid points program configuration" }
  }

  // Prevent double earn within 1 minute
  const oneMinuteAgo = new Date(Date.now() - 60_000)
  const recentVisit = await db.visit.findFirst({
    where: {
      enrollmentId: enrollment.id,
      createdAt: { gte: oneMinuteAgo },
    },
    select: { id: true },
  })

  if (recentVisit) {
    return {
      success: false,
      error: "Points were already earned for this enrollment less than a minute ago",
    }
  }

  const pointsEarned = pointsConfig.pointsPerVisit
  const newBalance = enrollment.pointsBalance + pointsEarned
  const newEnrollmentTotalVisits = enrollment.totalVisits + 1
  const newCustomerTotalVisits = enrollment.customer.totalVisits + 1

  await db.$transaction(async (tx) => {
    await tx.visit.create({
      data: {
        customerId: enrollment.customer.id,
        restaurantId: restaurant.id,
        loyaltyProgramId: program.id,
        enrollmentId: enrollment.id,
        registeredById: session.user.id,
        visitNumber: newEnrollmentTotalVisits,
      },
    })

    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        pointsBalance: newBalance,
        totalVisits: newEnrollmentTotalVisits,
      },
    })

    await tx.customer.update({
      where: { id: enrollment.customer.id },
      data: {
        totalVisits: newCustomerTotalVisits,
        lastVisitAt: new Date(),
      },
    })
  })

  // Dispatch wallet pass update
  if (enrollment.walletPassType !== "NONE") {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-wallet-pass", {
          enrollmentId: enrollment.id,
          updateType: "POINTS_EARNED",
        })
      )
      .catch((err: unknown) => console.error("Wallet pass update dispatch failed:", err instanceof Error ? err.message : "Unknown error"))
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/programs")

  return {
    success: true,
    pointsEarned,
    newBalance,
    totalVisits: newEnrollmentTotalVisits,
    programName: program.name,
  }
}

// ─── Redeem Points ────────────────────────────────────────────

export async function redeemPoints(
  enrollmentId: string,
  catalogItemId: string
): Promise<RedeemPointsResult> {
  const session = await assertAuthenticated()
  const restaurant = await getRestaurantForUser()

  if (!restaurant) {
    return { success: false, error: "No restaurant found" }
  }

  await assertRestaurantAccess(restaurant.id)

  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      customer: {
        select: {
          id: true,
          restaurantId: true,
          deletedAt: true,
          fullName: true,
        },
      },
      loyaltyProgram: {
        select: {
          id: true,
          name: true,
          programType: true,
          config: true,
          rewardExpiryDays: true,
          status: true,
        },
      },
    },
  })

  if (!enrollment) {
    return { success: false, error: "Enrollment not found" }
  }

  if (enrollment.customer.restaurantId !== restaurant.id) {
    return { success: false, error: "Enrollment not found" }
  }

  if (enrollment.customer.deletedAt) {
    return { success: false, error: "Customer has been deleted" }
  }

  if (enrollment.status !== "ACTIVE") {
    return {
      success: false,
      error: `This enrollment is ${enrollment.status.toLowerCase()}`,
    }
  }

  if (enrollment.loyaltyProgram.programType !== "POINTS") {
    return { success: false, error: "This is not a points program" }
  }

  const program = enrollment.loyaltyProgram
  const pointsConfig = parsePointsConfig(program.config)

  if (!pointsConfig) {
    return { success: false, error: "Invalid points program configuration" }
  }

  const catalogItem = pointsConfig.catalog.find((item) => item.id === catalogItemId)
  if (!catalogItem) {
    return { success: false, error: "Catalog item not found" }
  }

  if (enrollment.pointsBalance < catalogItem.pointsCost) {
    return { success: false, error: "Insufficient points balance" }
  }

  const newBalance = enrollment.pointsBalance - catalogItem.pointsCost
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (program.rewardExpiryDays || 90))

  await db.$transaction(async (tx) => {
    await tx.reward.create({
      data: {
        customerId: enrollment.customer.id,
        restaurantId: restaurant.id,
        loyaltyProgramId: program.id,
        enrollmentId: enrollment.id,
        status: "REDEEMED",
        redeemedAt: new Date(),
        redeemedById: session.user.id,
        expiresAt,
        description: catalogItem.name,
        pointsCost: catalogItem.pointsCost,
      },
    })

    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        pointsBalance: newBalance,
        totalRewardsRedeemed: { increment: 1 },
      },
    })
  })

  // Dispatch wallet pass update
  if (enrollment.walletPassType !== "NONE") {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-wallet-pass", {
          enrollmentId: enrollment.id,
          updateType: "POINTS_REDEEMED",
        })
      )
      .catch((err: unknown) => console.error("Wallet pass update dispatch failed:", err instanceof Error ? err.message : "Unknown error"))
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard/programs")

  return {
    success: true,
    itemName: catalogItem.name,
    pointsSpent: catalogItem.pointsCost,
    newBalance,
    programName: program.name,
  }
}

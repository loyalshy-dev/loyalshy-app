"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { sanitizeText } from "@/lib/sanitize"
import { publicFormLimiter } from "@/lib/rate-limit"
import { generateApplePass } from "@/lib/wallet/apple/generate-pass"
import { generateGoogleWalletSaveUrl } from "@/lib/wallet/google/generate-pass"
import { resolveCardDesign } from "@/lib/wallet/card-design"
import { buildCardUrl } from "@/lib/card-access"
import { parseCouponConfig, parseMinigameConfig, weightedRandomPrize } from "@/lib/program-config"
import { verifyCardSignature } from "@/lib/card-access"
import type { PublicProgramInfo } from "@/types/enrollment"
import type { MinigameConfig } from "@/types/program-types"

// ─── Types ──────────────────────────────────────────────────

export type RestaurantPublicInfo = {
  id: string
  name: string
  slug: string
  logo: string | null
  brandColor: string | null
  secondaryColor: string | null
  programs: PublicProgramInfo[]
}

export type OnboardingResult = {
  success: boolean
  platform?: "apple" | "google"
  passBuffer?: string // base64 for Apple
  saveUrl?: string // for Google
  customerName?: string
  isReturning?: boolean
  error?: string
}

export type JoinResult = {
  success: boolean
  enrollmentId?: string
  customerName?: string
  isReturning?: boolean
  currentCycleVisits?: number
  totalVisits?: number
  hasAvailableReward?: boolean
  cardUrl?: string
  error?: string
}

// ─── Validation ─────────────────────────────────────────────

const joinSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100),
  email: z
    .string()
    .email("Invalid email")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal("")),
  restaurantSlug: z.string().min(1),
  programId: z.string().min(1),
})

const passRequestSchema = z.object({
  enrollmentId: z.string().min(1),
  restaurantSlug: z.string().min(1),
  platform: z.enum(["apple", "google"]),
})

// ─── Get Restaurant by Slug (Public) ────────────────────────

export async function getRestaurantBySlug(
  slug: string
): Promise<RestaurantPublicInfo | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      brandColor: true,
      secondaryColor: true,
      loyaltyPrograms: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          programType: true,
          visitsRequired: true,
          rewardDescription: true,
          config: true,
          cardDesign: {
            select: {
              cardType: true,
              showStrip: true,
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              stripImageUrl: true,
              patternStyle: true,
              progressStyle: true,
              fontFamily: true,
              labelFormat: true,
              customProgressLabel: true,
              customMessage: true,
              editorConfig: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!restaurant) return null

  // Must have at least one active program
  if (restaurant.loyaltyPrograms.length === 0) return null

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    logo: restaurant.logo,
    brandColor: restaurant.brandColor,
    secondaryColor: restaurant.secondaryColor,
    programs: restaurant.loyaltyPrograms.map((p) => ({
      id: p.id,
      name: p.name,
      programType: p.programType,
      visitsRequired: p.visitsRequired,
      rewardDescription: p.rewardDescription,
      config: p.config,
      cardDesign: p.cardDesign
        ? {
            cardType: p.cardDesign.cardType,
            showStrip: p.cardDesign.showStrip,
            primaryColor: p.cardDesign.primaryColor,
            secondaryColor: p.cardDesign.secondaryColor,
            textColor: p.cardDesign.textColor,
            stripImageUrl: p.cardDesign.stripImageUrl,
            patternStyle: p.cardDesign.patternStyle,
            progressStyle: p.cardDesign.progressStyle,
            fontFamily: p.cardDesign.fontFamily,
            labelFormat: p.cardDesign.labelFormat,
            customProgressLabel: p.cardDesign.customProgressLabel,
            customMessage: p.cardDesign.customMessage,
            editorConfig: p.cardDesign.editorConfig,
          }
        : null,
    })),
  }
}

// ─── Get Enrollment Card Data (for persistent card page) ────

export type EnrollmentCardData = {
  enrollmentId: string
  walletPassId: string | null
  customerName: string
  currentCycleVisits: number
  totalVisits: number
  hasAvailableReward: boolean
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "FROZEN"
  restaurant: {
    name: string
    slug: string
    logo: string | null
    brandColor: string | null
  }
  program: {
    name: string
    visitsRequired: number
    rewardDescription: string
    programType: "STAMP_CARD" | "COUPON" | "MEMBERSHIP" | "POINTS"
    config: unknown
    cardDesign: PublicProgramInfo["cardDesign"]
  }
  unrevealedReward: { rewardId: string; description: string } | null
  minigameConfig: MinigameConfig | null
}

export async function getEnrollmentCardData(
  enrollmentId: string,
  restaurantSlug: string
): Promise<EnrollmentCardData | null> {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      walletPassId: true,
      currentCycleVisits: true,
      totalVisits: true,
      status: true,
      rewards: {
        where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
        select: { id: true, status: true, revealedAt: true, description: true },
      },
      customer: {
        select: { fullName: true },
      },
      loyaltyProgram: {
        select: {
          name: true,
          visitsRequired: true,
          rewardDescription: true,
          status: true,
          programType: true,
          config: true,
          cardDesign: {
            select: {
              cardType: true,
              showStrip: true,
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              stripImageUrl: true,
              patternStyle: true,
              progressStyle: true,
              fontFamily: true,
              labelFormat: true,
              customProgressLabel: true,
              customMessage: true,
              editorConfig: true,
            },
          },
          restaurant: {
            select: {
              name: true,
              slug: true,
              logo: true,
              brandColor: true,
            },
          },
        },
      },
    },
  })

  if (!enrollment) return null

  // Verify the enrollment belongs to the restaurant with the given slug
  if (enrollment.loyaltyProgram.restaurant.slug !== restaurantSlug) return null

  // Only show cards for active programs
  if (enrollment.loyaltyProgram.status !== "ACTIVE") return null

  const cd = enrollment.loyaltyProgram.cardDesign

  // Find first unrevealed reward (has description, revealedAt is null)
  const unrevealed = enrollment.rewards.find(
    (r) => r.revealedAt === null && r.description != null
  )

  const mgConfig = parseMinigameConfig(enrollment.loyaltyProgram.config)

  return {
    enrollmentId: enrollment.id,
    walletPassId: enrollment.walletPassId,
    customerName: enrollment.customer.fullName,
    currentCycleVisits: enrollment.currentCycleVisits,
    totalVisits: enrollment.totalVisits,
    hasAvailableReward: enrollment.rewards.some((r) => r.status === "AVAILABLE"),
    enrollmentStatus: enrollment.status,
    restaurant: enrollment.loyaltyProgram.restaurant,
    program: {
      name: enrollment.loyaltyProgram.name,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
      rewardDescription: enrollment.loyaltyProgram.rewardDescription,
      programType: enrollment.loyaltyProgram.programType,
      config: enrollment.loyaltyProgram.config,
      cardDesign: cd
        ? {
            cardType: cd.cardType,
            showStrip: cd.showStrip,
            primaryColor: cd.primaryColor,
            secondaryColor: cd.secondaryColor,
            textColor: cd.textColor,
            stripImageUrl: cd.stripImageUrl,
            patternStyle: cd.patternStyle,
            progressStyle: cd.progressStyle,
            fontFamily: cd.fontFamily,
            labelFormat: cd.labelFormat,
            customProgressLabel: cd.customProgressLabel,
            customMessage: cd.customMessage,
            editorConfig: cd.editorConfig,
          }
        : null,
    },
    unrevealedReward: unrevealed
      ? { rewardId: unrevealed.id, description: unrevealed.description! }
      : null,
    minigameConfig: mgConfig,
  }
}

// ─── Join Program (enrollment only, no wallet pass) ─────────

export async function joinProgram(
  formData: FormData
): Promise<JoinResult> {
  // Rate limit by IP
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { success: rateLimitOk } = publicFormLimiter.check(`join:${ip}`)
  if (!rateLimitOk) {
    return { success: false, error: "Too many requests. Please try again later." }
  }

  const raw = {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    restaurantSlug: formData.get("restaurantSlug") as string,
    programId: formData.get("programId") as string,
  }

  const parsed = joinSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const { restaurantSlug, programId } = parsed.data
  const fullName = sanitizeText(parsed.data.fullName, 100)
  const cleanEmail = parsed.data.email ? sanitizeText(parsed.data.email, 255) || null : null
  const cleanPhone = parsed.data.phone ? sanitizeText(parsed.data.phone, 30) || null : null

  // Fetch restaurant
  const restaurant = await db.restaurant.findUnique({
    where: { slug: restaurantSlug },
    select: { id: true },
  })

  if (!restaurant) {
    return { success: false, error: "Restaurant not found" }
  }

  // Fetch the specific program
  const program = await db.loyaltyProgram.findFirst({
    where: {
      id: programId,
      restaurantId: restaurant.id,
      status: "ACTIVE",
    },
    select: { id: true, programType: true, config: true, rewardExpiryDays: true },
  })

  if (!program) {
    return { success: false, error: "No active loyalty program found" }
  }

  // ── Find or create customer ──
  let customer: {
    id: string
    fullName: string
    createdAt: Date
    email: string | null
  } | null = null

  if (cleanEmail) {
    customer = await db.customer.findUnique({
      where: {
        restaurantId_email: { restaurantId: restaurant.id, email: cleanEmail },
      },
      select: {
        id: true,
        fullName: true,
        createdAt: true,
        email: true,
      },
    })
  }

  if (!customer && cleanPhone) {
    customer = await db.customer.findUnique({
      where: {
        restaurantId_phone: {
          restaurantId: restaurant.id,
          phone: cleanPhone,
        },
      },
      select: {
        id: true,
        fullName: true,
        createdAt: true,
        email: true,
      },
    })
  }

  const isReturningCustomer = !!customer

  // Create new customer if not found
  if (!customer) {
    customer = await db.customer.create({
      data: {
        restaurantId: restaurant.id,
        fullName,
        email: cleanEmail,
        phone: cleanPhone,
      },
      select: {
        id: true,
        fullName: true,
        createdAt: true,
        email: true,
      },
    })
  }

  // ── Find or create enrollment for this program ──
  let enrollment = await db.enrollment.findUnique({
    where: {
      customerId_loyaltyProgramId: {
        customerId: customer.id,
        loyaltyProgramId: program.id,
      },
    },
    select: {
      id: true,
      currentCycleVisits: true,
      totalVisits: true,
      status: true,
      walletPassId: true,
      rewards: {
        where: { status: "AVAILABLE" },
        select: { id: true },
        take: 1,
      },
    },
  })

  const isReturningEnrollment = !!enrollment

  // Ensure returning enrollments have a walletPassId for the browser card QR
  if (enrollment && !enrollment.walletPassId) {
    const walletPassId = randomUUID()
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { walletPassId },
    })
    enrollment = { ...enrollment, walletPassId }
  }

  if (!enrollment) {
    // Generate walletPassId upfront so the browser card page has a scannable QR
    const walletPassId = randomUUID()
    enrollment = await db.enrollment.create({
      data: {
        customerId: customer.id,
        loyaltyProgramId: program.id,
        walletPassId,
      },
      select: {
        id: true,
        currentCycleVisits: true,
        totalVisits: true,
        status: true,
        walletPassId: true,
        rewards: {
          where: { status: "AVAILABLE" },
          select: { id: true },
          take: 1,
        },
      },
    })

    // Auto-create coupon reward for new COUPON enrollments
    if (program.programType === "COUPON") {
      const couponConfig = parseCouponConfig(program.config)
      const expiresAt = couponConfig?.validUntil
        ? new Date(couponConfig.validUntil)
        : program.rewardExpiryDays > 0
          ? new Date(Date.now() + program.rewardExpiryDays * 86_400_000)
          : new Date(Date.now() + 365 * 86_400_000) // default 1 year

      // If minigame is enabled, assign a random prize immediately so customer can play the game
      const mgConfig = parseMinigameConfig(program.config)
      const hasPrizes = mgConfig?.enabled && mgConfig.prizes?.length
      const selectedPrize = hasPrizes ? weightedRandomPrize(mgConfig.prizes!) : null

      await db.reward.create({
        data: {
          customerId: customer.id,
          restaurantId: restaurant.id,
          loyaltyProgramId: program.id,
          enrollmentId: enrollment.id,
          status: "AVAILABLE",
          expiresAt,
          ...(selectedPrize ? { description: selectedPrize, revealedAt: null } : {}),
        },
      })

      // Update enrollment's rewards cache for return value
      enrollment = { ...enrollment, rewards: [{ id: "auto-created" }] }
    }
  }

  return {
    success: true,
    enrollmentId: enrollment.id,
    customerName: customer.fullName,
    isReturning: isReturningCustomer || isReturningEnrollment,
    currentCycleVisits: enrollment.currentCycleVisits,
    totalVisits: enrollment.totalVisits,
    hasAvailableReward: enrollment.rewards.length > 0,
    cardUrl: buildCardUrl(restaurantSlug, enrollment.id),
  }
}

// ─── Request Wallet Pass (separate from enrollment) ─────────

export async function requestWalletPass(
  enrollmentId: string,
  restaurantSlug: string,
  platform: "apple" | "google"
): Promise<OnboardingResult> {
  // Rate limit by IP
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { success: rateLimitOk } = publicFormLimiter.check(`pass:${ip}`)
  if (!rateLimitOk) {
    return { success: false, error: "Too many requests. Please try again later." }
  }

  const parsed = passRequestSchema.safeParse({ enrollmentId, restaurantSlug, platform })
  if (!parsed.success) {
    return { success: false, error: "Invalid request" }
  }

  // Fetch enrollment with linked data
  const enrollment = await db.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    select: {
      id: true,
      currentCycleVisits: true,
      totalVisits: true,
      walletPassId: true,
      walletPassSerialNumber: true,
      walletPassType: true,
      status: true,
      rewards: {
        where: { status: "AVAILABLE" },
        select: { id: true },
        take: 1,
      },
      customer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          createdAt: true,
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
          cardDesign: true,
          restaurant: {
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
    },
  })

  if (!enrollment) {
    return { success: false, error: "Enrollment not found" }
  }

  // Verify the enrollment belongs to the restaurant with the given slug
  if (enrollment.loyaltyProgram.restaurant.slug !== parsed.data.restaurantSlug) {
    return { success: false, error: "Enrollment not found" }
  }

  const restaurant = enrollment.loyaltyProgram.restaurant
  const program = enrollment.loyaltyProgram
  const customer = enrollment.customer

  // Resolve card design for pass generation
  const cardDesign = resolveCardDesign(program.cardDesign, restaurant)

  return issuePassForEnrollment(
    {
      enrollmentId: enrollment.id,
      customerId: customer.id,
      customerName: customer.fullName,
      customerEmail: customer.email,
      customerCreatedAt: customer.createdAt,
      currentCycleVisits: enrollment.currentCycleVisits,
      totalVisits: enrollment.totalVisits,
      walletPassId: enrollment.walletPassId,
      walletPassSerialNumber: enrollment.walletPassSerialNumber,
      walletPassType: enrollment.walletPassType,
      hasAvailableReward: enrollment.rewards.length > 0,
    },
    restaurant,
    program,
    parsed.data.platform,
    true, // requesting a pass after enrollment is always a "returning" action
    cardDesign,
  )
}

// ─── Issue Pass (shared between new and returning) ──────────

type EnrollmentPassData = {
  enrollmentId: string
  customerId: string
  customerName: string
  customerEmail: string | null
  customerCreatedAt: Date
  currentCycleVisits: number
  totalVisits: number
  pointsBalance?: number
  walletPassId: string | null
  walletPassSerialNumber: string | null
  walletPassType: string
  hasAvailableReward: boolean
}

async function issuePassForEnrollment(
  enrollment: EnrollmentPassData,
  restaurant: {
    id: string
    name: string
    slug: string
    logo: string | null
    logoApple: string | null
    logoGoogle: string | null
    brandColor: string | null
    secondaryColor: string | null
    phone: string | null
    website: string | null
  },
  program: {
    id: string
    name: string
    programType: string
    config: unknown
    visitsRequired: number
    rewardDescription: string
    rewardExpiryDays: number
    termsAndConditions: string | null
    endsAt: Date | null
  },
  platform: "apple" | "google",
  isReturning: boolean,
  cardDesign?: import("@/lib/wallet/card-design").CardDesignData | null,
): Promise<OnboardingResult> {
  if (platform === "apple") {
    const serialNumber = enrollment.walletPassSerialNumber ?? randomUUID()
    const walletPassId = enrollment.walletPassId ?? randomUUID()

    try {
      const passBuffer = await generateApplePass({
        serialNumber,
        authenticationToken: walletPassId,
        customerName: enrollment.customerName,
        customerEmail: enrollment.customerEmail,
        currentCycleVisits: enrollment.currentCycleVisits,
        visitsRequired: program.visitsRequired,
        totalVisits: enrollment.totalVisits,
        memberSince: enrollment.customerCreatedAt,
        hasAvailableReward: enrollment.hasAvailableReward,
        restaurantName: restaurant.name,
        restaurantLogo: restaurant.logo,
        restaurantLogoApple: restaurant.logoApple,
        brandColor: restaurant.brandColor,
        secondaryColor: restaurant.secondaryColor,
        rewardDescription: program.rewardDescription,
        rewardExpiryDays: program.rewardExpiryDays,
        termsAndConditions: program.termsAndConditions,
        restaurantPhone: restaurant.phone,
        restaurantWebsite: restaurant.website,
        cardDesign,
        programType: program.programType,
        programConfig: program.config,
        pointsBalance: enrollment.pointsBalance ?? 0,
      })

      // Store wallet fields on Enrollment (not Customer)
      await db.enrollment.update({
        where: { id: enrollment.enrollmentId },
        data: {
          walletPassSerialNumber: serialNumber,
          walletPassId: walletPassId,
          walletPassType: "APPLE",
        },
      })

      await db.walletPassLog.create({
        data: {
          enrollmentId: enrollment.enrollmentId,
          customerId: enrollment.customerId,
          action: "CREATED",
          details: {
            source: "onboarding",
            isReturning,
            serialNumber,
            programId: program.id,
          },
        },
      })

      return {
        success: true,
        platform: "apple",
        passBuffer: passBuffer.toString("base64"),
        customerName: enrollment.customerName,
        isReturning,
      }
    } catch (error) {
      console.error("Failed to generate Apple pass during onboarding:", error instanceof Error ? error.message : "Unknown error")
      return {
        success: false,
        error: "Failed to generate your wallet pass. Please try again.",
      }
    }
  }

  // Google Wallet
  const walletPassId = enrollment.walletPassId ?? randomUUID()

  try {
    // Check if coupon has minigame with unrevealed prize
    const mgConfig = parseMinigameConfig(program.config)
    const hasUnrevealedPrize = program.programType === "COUPON" && !!mgConfig?.enabled && !!(mgConfig.prizes?.length)

    const saveUrl = await generateGoogleWalletSaveUrl({
      customerId: enrollment.customerId,
      restaurantId: restaurant.id,
      walletPassId,
      customerName: enrollment.customerName,
      customerEmail: enrollment.customerEmail,
      currentCycleVisits: enrollment.currentCycleVisits,
      visitsRequired: program.visitsRequired,
      totalVisits: enrollment.totalVisits,
      memberSince: enrollment.customerCreatedAt,
      hasAvailableReward: enrollment.hasAvailableReward,
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
      enrollmentId: enrollment.enrollmentId,
      cardDesign,
      programEndsAt: program.endsAt,
      programType: program.programType,
      programConfig: program.config,
      pointsBalance: enrollment.pointsBalance ?? 0,
      hasUnrevealedPrize,
      restaurantSlug: restaurant.slug,
    })

    // Store wallet fields on Enrollment (not Customer)
    await db.enrollment.update({
      where: { id: enrollment.enrollmentId },
      data: {
        walletPassId,
        walletPassType: "GOOGLE",
      },
    })

    await db.walletPassLog.create({
      data: {
        enrollmentId: enrollment.enrollmentId,
        customerId: enrollment.customerId,
        action: "CREATED",
        details: {
          source: "onboarding",
          isReturning,
          platform: "google",
          programId: program.id,
        },
      },
    })

    return {
      success: true,
      platform: "google",
      saveUrl,
      customerName: enrollment.customerName,
      isReturning,
    }
  } catch (error) {
    console.error("Failed to generate Google pass during onboarding:", error instanceof Error ? error.message : "Unknown error")
    return {
      success: false,
      error: "Failed to generate your wallet pass. Please try again.",
    }
  }
}

// ─── Reveal Prize (public, HMAC-protected) ──────────────────

const revealPrizeSchema = z.object({
  rewardId: z.string().min(1),
  enrollmentId: z.string().min(1),
  signature: z.string().min(1),
})

export async function revealPrize(
  rewardId: string,
  enrollmentId: string,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  const parsed = revealPrizeSchema.safeParse({ rewardId, enrollmentId, signature })
  if (!parsed.success) {
    return { success: false, error: "Invalid request" }
  }

  // Verify HMAC signature (same as card page access)
  if (!verifyCardSignature(enrollmentId, signature)) {
    return { success: false, error: "Access denied" }
  }

  // Find the unrevealed reward (AVAILABLE for stamp cards, REDEEMED for coupons)
  const reward = await db.reward.findFirst({
    where: {
      id: rewardId,
      enrollmentId,
      status: { in: ["AVAILABLE", "REDEEMED"] },
      revealedAt: null,
    },
    select: { id: true, enrollmentId: true },
  })

  if (!reward) {
    return { success: false, error: "Reward not found or already revealed" }
  }

  // Mark as revealed
  await db.reward.update({
    where: { id: reward.id },
    data: { revealedAt: new Date() },
  })

  // Trigger wallet pass update to refresh pass content
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { walletPassType: true },
  })

  if (enrollment && enrollment.walletPassType !== "NONE") {
    if (process.env.TRIGGER_SECRET_KEY) {
      import("@trigger.dev/sdk")
        .then(({ tasks }) =>
          tasks.trigger("update-wallet-pass", {
            enrollmentId,
            updateType: "REWARD_EARNED" as const,
          })
        )
        .catch((err: unknown) =>
          console.error("Wallet pass update after reveal failed:", err instanceof Error ? err.message : "Unknown error")
        )
    } else if (enrollment.walletPassType === "GOOGLE") {
      import("@/lib/wallet/google/update-pass")
        .then(({ notifyGooglePassUpdate }) => notifyGooglePassUpdate(enrollmentId))
        .catch((err: unknown) =>
          console.error("Direct Google pass update after reveal failed:", err instanceof Error ? err.message : "Unknown error")
        )
    }
  }

  return { success: true }
}

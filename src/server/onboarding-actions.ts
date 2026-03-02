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
import type { PublicProgramInfo } from "@/types/enrollment"

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
          visitsRequired: true,
          rewardDescription: true,
          cardDesign: {
            select: {
              cardType: true,
              shape: true,
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
      visitsRequired: p.visitsRequired,
      rewardDescription: p.rewardDescription,
      cardDesign: p.cardDesign
        ? {
            cardType: p.cardDesign.cardType,
            shape: p.cardDesign.shape,
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
    cardDesign: PublicProgramInfo["cardDesign"]
  }
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
      rewards: {
        where: { status: "AVAILABLE" },
        select: { id: true },
        take: 1,
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
          cardDesign: {
            select: {
              cardType: true,
              shape: true,
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
  return {
    enrollmentId: enrollment.id,
    walletPassId: enrollment.walletPassId,
    customerName: enrollment.customer.fullName,
    currentCycleVisits: enrollment.currentCycleVisits,
    totalVisits: enrollment.totalVisits,
    hasAvailableReward: enrollment.rewards.length > 0,
    restaurant: enrollment.loyaltyProgram.restaurant,
    program: {
      name: enrollment.loyaltyProgram.name,
      visitsRequired: enrollment.loyaltyProgram.visitsRequired,
      rewardDescription: enrollment.loyaltyProgram.rewardDescription,
      cardDesign: cd
        ? {
            cardType: cd.cardType,
            shape: cd.shape,
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
    select: { id: true },
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
    const saveUrl = generateGoogleWalletSaveUrl({
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

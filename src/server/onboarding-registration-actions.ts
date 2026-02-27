"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { addDays } from "date-fns"
import { db } from "@/lib/db"
import { assertAuthenticated } from "@/lib/dal"
import { sanitizeText } from "@/lib/sanitize"

// ─── Schemas ────────────────────────────────────────────────

const createRestaurantSchema = z.object({
  name: z.string().min(1, "Restaurant name is required").max(100),
  address: z.string().max(200).optional().default(""),
  phone: z.string().max(30).optional().default(""),
})

const updateBrandingSchema = z.object({
  restaurantId: z.string().min(1),
  brandColor: z.string().max(50).optional().default(""),
})

const setupLoyaltySchema = z.object({
  restaurantId: z.string().min(1),
  visitsRequired: z.number().int().min(3).max(30),
  rewardDescription: z.string().min(1, "Reward description is required").max(200),
  rewardExpiryDays: z.number().int().min(0).max(365),
})

// ─── Slug Helpers ───────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name)
  if (!base) return `restaurant-${Date.now().toString(36)}`

  // Check if base slug is available
  const existing = await db.restaurant.findUnique({ where: { slug: base } })
  if (!existing) return base

  // Append random suffix
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

// ─── Create Restaurant ─────────────────────────────────────

export async function createRestaurant(input: z.infer<typeof createRestaurantSchema>) {
  const session = await assertAuthenticated()
  const parsed = createRestaurantSchema.parse(input)

  // Check if user already has a restaurant
  if (session.user.restaurantId) {
    return { error: "You already have a restaurant", restaurantId: session.user.restaurantId }
  }

  const name = sanitizeText(parsed.name, 100)
  const slug = await generateUniqueSlug(name)

  // Create Restaurant + Organization + LoyaltyProgram + CardDesign + Member in a transaction
  const result = await db.$transaction(async (tx) => {
    // 1. Create restaurant
    const restaurant = await tx.restaurant.create({
      data: {
        name,
        slug,
        address: parsed.address || null,
        phone: parsed.phone || null,
        settings: { onboardingComplete: false },
      },
    })

    // 2. Create matching organization (same slug convention)
    const org = await tx.organization.create({
      data: {
        name,
        slug,
      },
    })

    // 3. Create member (owner role)
    await tx.member.create({
      data: {
        userId: session.user.id,
        organizationId: org.id,
        role: "owner",
      },
    })

    // 4. Create default loyalty program
    const loyaltyProgram = await tx.loyaltyProgram.create({
      data: {
        restaurantId: restaurant.id,
        name: "Loyalty Program",
        visitsRequired: 10,
        rewardDescription: "Free reward",
        rewardExpiryDays: 90,
        status: "ACTIVE",
      },
    })

    // 5. Create default card design linked to the loyalty program
    await tx.cardDesign.create({
      data: {
        loyaltyProgramId: loyaltyProgram.id,
      },
    })

    // 6. Link user to restaurant
    await tx.user.update({
      where: { id: session.user.id },
      data: { restaurantId: restaurant.id },
    })

    return restaurant
  })

  return { success: true, restaurantId: result.id, slug: result.slug }
}

// ─── Update Restaurant Branding ────────────────────────────

export async function updateRestaurantBranding(input: z.infer<typeof updateBrandingSchema>) {
  const session = await assertAuthenticated()
  const parsed = updateBrandingSchema.parse(input)

  // Verify user owns this restaurant
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { restaurantId: true },
  })

  if (user?.restaurantId !== parsed.restaurantId) {
    return { error: "Unauthorized" }
  }

  await db.restaurant.update({
    where: { id: parsed.restaurantId },
    data: {
      brandColor: parsed.brandColor || null,
    },
  })

  return { success: true }
}

// ─── Upload Onboarding Logo ────────────────────────────────

export async function uploadOnboardingLogo(formData: FormData) {
  const session = await assertAuthenticated()
  const restaurantId = formData.get("restaurantId") as string
  const file = formData.get("file") as File

  if (!restaurantId || !file) {
    return { error: "Missing restaurant ID or file" }
  }

  // Verify user owns this restaurant
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { restaurantId: true },
  })

  if (user?.restaurantId !== restaurantId) {
    return { error: "Unauthorized" }
  }

  // Validate file
  const maxSize = 2 * 1024 * 1024 // 2MB
  if (file.size > maxSize) {
    return { error: "File must be under 2MB" }
  }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) {
    return { error: "File must be PNG, JPEG, WebP, or SVG" }
  }

  const { put } = await import("@vercel/blob")
  const blob = await put(`logos/${restaurantId}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  })

  await db.restaurant.update({
    where: { id: restaurantId },
    data: { logo: blob.url },
  })

  return { success: true, url: blob.url }
}

// ─── Setup Loyalty Program ─────────────────────────────────

export async function setupLoyaltyProgram(input: z.infer<typeof setupLoyaltySchema>) {
  const session = await assertAuthenticated()
  const parsed = setupLoyaltySchema.parse(input)

  // Verify user owns this restaurant
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { restaurantId: true },
  })

  if (user?.restaurantId !== parsed.restaurantId) {
    return { error: "Unauthorized" }
  }

  // Find the default loyalty program created during restaurant setup
  const program = await db.loyaltyProgram.findFirst({
    where: { restaurantId: parsed.restaurantId },
  })

  if (!program) {
    return { error: "Loyalty program not found" }
  }

  await db.loyaltyProgram.update({
    where: { id: program.id },
    data: {
      visitsRequired: parsed.visitsRequired,
      rewardDescription: parsed.rewardDescription,
      rewardExpiryDays: parsed.rewardExpiryDays,
    },
  })

  return { success: true }
}

// ─── Initialize Trial Subscription ─────────────────────────

export async function initializeTrialSubscription(restaurantId: string) {
  const session = await assertAuthenticated()

  // Verify user owns this restaurant
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { restaurantId: true },
  })

  if (user?.restaurantId !== restaurantId) {
    return { error: "Unauthorized" }
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      name: true,
      slug: true,
    },
  })

  if (!restaurant) {
    return { error: "Restaurant not found" }
  }

  // Skip if already has subscription
  if (restaurant.stripeSubscriptionId) {
    return { success: true, alreadySetup: true }
  }

  try {
    const { stripe } = await import("@/lib/stripe")

    // Create Stripe customer
    let stripeCustomerId = restaurant.stripeCustomerId
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: restaurant.name,
        metadata: { restaurantId },
      })
      stripeCustomerId = customer.id
    }

    // Find the Starter monthly price
    const prices = await stripe.prices.list({
      lookup_keys: ["starter_monthly"],
      active: true,
      limit: 1,
    })

    const starterPrice = prices.data[0]

    if (starterPrice) {
      // Create subscription with 14-day trial
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: starterPrice.id }],
        trial_period_days: 14,
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
      })

      const trialEndsAt = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : addDays(new Date(), 14)

      await db.restaurant.update({
        where: { id: restaurantId },
        data: {
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: "TRIALING",
          plan: "STARTER",
          trialEndsAt,
        },
      })
    } else {
      // No Stripe price found — fallback to free plan with trial marker
      await db.restaurant.update({
        where: { id: restaurantId },
        data: {
          stripeCustomerId,
          subscriptionStatus: "TRIALING",
          plan: "STARTER",
          trialEndsAt: addDays(new Date(), 14),
        },
      })
    }

    // Dispatch welcome email via Trigger.dev
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("send-welcome-email", {
          email: session.user.email,
          name: session.user.name,
          restaurantName: restaurant.name,
          slug: restaurant.slug,
        })
      )
      .catch((err: unknown) => console.error("Email dispatch failed:", err instanceof Error ? err.message : "Unknown error"))

    return { success: true }
  } catch (error) {
    console.error("Failed to initialize trial:", error instanceof Error ? error.message : "Unknown error")
    // Fallback — set up as starter trial without Stripe
    await db.restaurant.update({
      where: { id: restaurantId },
      data: {
        subscriptionStatus: "TRIALING",
        plan: "STARTER",
        trialEndsAt: addDays(new Date(), 14),
      },
    })
    return { success: true, stripeError: true }
  }
}

// ─── Complete Onboarding ───────────────────────────────────

export async function completeOnboarding(restaurantId: string) {
  const session = await assertAuthenticated()

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { restaurantId: true },
  })

  if (user?.restaurantId !== restaurantId) {
    return { error: "Unauthorized" }
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: true },
  })

  const currentSettings = (restaurant?.settings as Record<string, unknown>) ?? {}

  await db.restaurant.update({
    where: { id: restaurantId },
    data: {
      settings: { ...currentSettings, onboardingComplete: true },
    },
  })

  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Onboarding Checklist ──────────────────────────────────

export type OnboardingChecklistData = {
  hasLogo: boolean
  hasCustomLoyalty: boolean
  hasQrPrinted: boolean
  hasCustomer: boolean
  hasStaff: boolean
  isDismissed: boolean
}

export async function getOnboardingChecklist(restaurantId: string): Promise<OnboardingChecklistData> {
  // Verify the requesting user owns this restaurant
  const session = await assertAuthenticated()
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { restaurantId: true },
  })
  if (user?.restaurantId !== restaurantId) {
    return {
      hasLogo: false,
      hasCustomLoyalty: false,
      hasQrPrinted: false,
      hasCustomer: false,
      hasStaff: false,
      isDismissed: true,
    }
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      logo: true,
      slug: true,
      settings: true,
      _count: { select: { customers: true } },
    },
  })

  if (!restaurant) {
    return {
      hasLogo: false,
      hasCustomLoyalty: false,
      hasQrPrinted: false,
      hasCustomer: false,
      hasStaff: false,
      isDismissed: true,
    }
  }

  const settings = (restaurant.settings as Record<string, unknown>) ?? {}

  // Check loyalty program customization
  const program = await db.loyaltyProgram.findFirst({
    where: { restaurantId },
    select: { visitsRequired: true, rewardDescription: true },
  })

  const hasCustomLoyalty =
    (program?.visitsRequired !== 10) ||
    (program?.rewardDescription !== "Free reward")

  // Check staff count
  const org = await db.organization.findUnique({
    where: { slug: restaurant.slug },
    select: { _count: { select: { members: true } } },
  })

  return {
    hasLogo: !!restaurant.logo,
    hasCustomLoyalty,
    hasQrPrinted: settings.qrPrinted === true,
    hasCustomer: restaurant._count.customers > 0,
    hasStaff: (org?._count?.members ?? 1) > 1,
    isDismissed: settings.onboardingDismissed === true,
  }
}

export async function dismissOnboardingChecklist(restaurantId: string) {
  const session = await assertAuthenticated()

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { restaurantId: true },
  })

  if (user?.restaurantId !== restaurantId) {
    return { error: "Unauthorized" }
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: true },
  })

  const currentSettings = (restaurant?.settings as Record<string, unknown>) ?? {}

  await db.restaurant.update({
    where: { id: restaurantId },
    data: {
      settings: { ...currentSettings, onboardingDismissed: true },
    },
  })

  revalidatePath("/dashboard")
  return { success: true }
}

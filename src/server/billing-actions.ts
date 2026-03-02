"use server"

import { db } from "@/lib/db"
import { assertRestaurantRole, getRestaurantForUser } from "@/lib/dal"
import { stripe, PLANS, getPlanLimits, isUpgrade, isActiveSubscription, type PlanId } from "@/lib/stripe"

// ─── Types ──────────────────────────────────────────────────

export type BillingData = {
  restaurant: {
    id: string
    name: string
    plan: string
    subscriptionStatus: string
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    trialEndsAt: Date | null
  }
  usage: {
    customers: number
    customerLimit: number
    customerPercent: number
    staff: number
    staffLimit: number
    staffPercent: number
  }
  plans: typeof PLANS
}

// ─── Get Billing Data ──────────────────────────────────────

export async function getBillingData(): Promise<BillingData | { error: string }> {
  try {
    const restaurant = await getRestaurantForUser()
    if (!restaurant) return { error: "No restaurant found" }

    await assertRestaurantRole(restaurant.id, "owner")

    const plan = restaurant.plan as PlanId
    const limits = getPlanLimits(plan)

    // Count current customers
    const customerCount = await db.customer.count({
      where: { restaurantId: restaurant.id },
    })

    // Count current staff (org members)
    const org = await db.organization.findUnique({
      where: { slug: restaurant.slug },
      select: { _count: { select: { members: true } } },
    })
    const staffCount = org?._count?.members ?? 1

    const customerPercent = limits.customerLimit === Infinity
      ? 0
      : Math.round((customerCount / limits.customerLimit) * 100)

    const staffPercent = limits.staffLimit === Infinity
      ? 0
      : Math.round((staffCount / limits.staffLimit) * 100)

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        plan: restaurant.plan,
        subscriptionStatus: restaurant.subscriptionStatus,
        stripeCustomerId: restaurant.stripeCustomerId,
        stripeSubscriptionId: restaurant.stripeSubscriptionId,
        trialEndsAt: restaurant.trialEndsAt,
      },
      usage: {
        customers: customerCount,
        customerLimit: limits.customerLimit,
        customerPercent,
        staff: staffCount,
        staffLimit: limits.staffLimit,
        staffPercent,
      },
      plans: PLANS,
    }
  } catch {
    return { error: "Failed to load billing data" }
  }
}

// ─── Create Checkout Session ───────────────────────────────

export async function createCheckoutSession(priceLookupKey: string): Promise<{ url: string } | { error: string }> {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) return { error: "No restaurant found" }

  await assertRestaurantRole(restaurant.id, "owner")

  if (!priceLookupKey || typeof priceLookupKey !== "string") {
    return { error: "Missing price lookup key" }
  }

  // If user already has an active subscription, use the billing portal for plan changes
  if (restaurant.stripeSubscriptionId && isActiveSubscription(restaurant.subscriptionStatus)) {
    return { error: "Use the billing portal to change your plan" }
  }

  // Resolve the price from lookup key
  const prices = await stripe.prices.list({
    lookup_keys: [priceLookupKey],
    active: true,
    limit: 1,
  })

  if (prices.data.length === 0) {
    return { error: "Price not found" }
  }

  const price = prices.data[0]
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

  // Create or retrieve Stripe customer
  let stripeCustomerId = restaurant.stripeCustomerId

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: restaurant.name,
      metadata: {
        loyalshy_restaurant_id: restaurant.id,
      },
    })
    stripeCustomerId = customer.id

    await db.restaurant.update({
      where: { id: restaurant.id },
      data: { stripeCustomerId },
    })
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/settings?tab=billing&checkout=success`,
    cancel_url: `${baseUrl}/dashboard/settings?tab=billing&checkout=canceled`,
    subscription_data: {
      metadata: {
        loyalshy_restaurant_id: restaurant.id,
      },
    },
    allow_promotion_codes: true,
  })

  if (!checkoutSession.url) {
    return { error: "Failed to create checkout session" }
  }

  return { url: checkoutSession.url }
}

// ─── Create Portal Session ─────────────────────────────────

export async function createPortalSession(): Promise<{ url: string } | { error: string }> {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) return { error: "No restaurant found" }

  await assertRestaurantRole(restaurant.id, "owner")

  if (!restaurant.stripeCustomerId) {
    return { error: "No billing account found. Please subscribe to a plan first." }
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: restaurant.stripeCustomerId,
    return_url: `${baseUrl}/dashboard/settings?tab=billing`,
  })

  return { url: portalSession.url }
}

// ─── Check Plan Limits ──────────────────────────────────────
// Used by addCustomer and inviteTeamMember to enforce limits.
// Also checks subscription status — canceled/past_due users cannot add resources.

export async function checkCustomerLimit(restaurantId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
  approaching: boolean
}> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { plan: true, subscriptionStatus: true },
  })
  if (!restaurant) return { allowed: false, current: 0, limit: 0, approaching: false }

  // Block resource creation for canceled subscriptions
  if (!isActiveSubscription(restaurant.subscriptionStatus)) {
    return { allowed: false, current: 0, limit: 0, approaching: false }
  }

  const plan = restaurant.plan as PlanId
  const { customerLimit } = getPlanLimits(plan)
  const current = await db.customer.count({ where: { restaurantId } })

  return {
    allowed: current < customerLimit,
    current,
    limit: customerLimit,
    approaching: customerLimit !== Infinity && current >= customerLimit * 0.8,
  }
}

export async function checkProgramLimit(restaurantId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
  approaching: boolean
}> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { plan: true, subscriptionStatus: true },
  })
  if (!restaurant) return { allowed: false, current: 0, limit: 0, approaching: false }

  if (!isActiveSubscription(restaurant.subscriptionStatus)) {
    return { allowed: false, current: 0, limit: 0, approaching: false }
  }

  const plan = restaurant.plan as PlanId
  const { programLimit } = getPlanLimits(plan)
  // Only count ACTIVE programs toward the limit (DRAFT programs are free to create)
  const current = await db.loyaltyProgram.count({
    where: { restaurantId, status: "ACTIVE" },
  })

  return {
    allowed: current < programLimit,
    current,
    limit: programLimit,
    approaching: programLimit !== Infinity && current >= programLimit * 0.8,
  }
}

export async function checkStaffLimit(restaurantId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
  approaching: boolean
}> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId, },
    select: { plan: true, slug: true, subscriptionStatus: true },
  })
  if (!restaurant) return { allowed: false, current: 0, limit: 0, approaching: false }

  if (!isActiveSubscription(restaurant.subscriptionStatus)) {
    return { allowed: false, current: 0, limit: 0, approaching: false }
  }

  const plan = restaurant.plan as PlanId
  const { staffLimit } = getPlanLimits(plan)

  const org = await db.organization.findUnique({
    where: { slug: restaurant.slug },
    select: { _count: { select: { members: true } } },
  })
  const current = org?._count?.members ?? 1

  // Also count pending invitations
  const pendingCount = await db.staffInvitation.count({
    where: {
      restaurantId,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
  })

  const totalCommitted = current + pendingCount

  return {
    allowed: totalCommitted < staffLimit,
    current: totalCommitted,
    limit: staffLimit,
    approaching: staffLimit !== Infinity && totalCommitted >= staffLimit * 0.8,
  }
}

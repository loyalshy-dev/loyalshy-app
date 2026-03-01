"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertRestaurantRole, getRestaurantForUser } from "@/lib/dal"
import { PLANS, getPlanLimits, type PlanId } from "@/lib/stripe"

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
}

// ─── Create Checkout Session ───────────────────────────────

export async function createCheckoutSession(priceLookupKey: string): Promise<{ url: string } | { error: string }> {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) return { error: "No restaurant found" }

  await assertRestaurantRole(restaurant.id, "owner")

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

  const res = await fetch(`${baseUrl}/api/stripe/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceLookupKey }),
  })

  if (!res.ok) {
    const data = await res.json()
    return { error: data.error ?? "Failed to create checkout" }
  }

  const data = await res.json()
  return { url: data.url }
}

// ─── Create Portal Session ─────────────────────────────────

export async function createPortalSession(): Promise<{ url: string } | { error: string }> {
  const restaurant = await getRestaurantForUser()
  if (!restaurant) return { error: "No restaurant found" }

  await assertRestaurantRole(restaurant.id, "owner")

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

  const res = await fetch(`${baseUrl}/api/stripe/portal`, {
    method: "POST",
  })

  if (!res.ok) {
    const data = await res.json()
    return { error: data.error ?? "Failed to create portal session" }
  }

  const data = await res.json()
  return { url: data.url }
}

// ─── Check Plan Limit ──────────────────────────────────────
// Used by addCustomer and inviteTeamMember to enforce limits.

export async function checkCustomerLimit(restaurantId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
  approaching: boolean
}> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { plan: true },
  })
  if (!restaurant) return { allowed: false, current: 0, limit: 0, approaching: false }

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
    select: { plan: true },
  })
  if (!restaurant) return { allowed: false, current: 0, limit: 0, approaching: false }

  const plan = restaurant.plan as PlanId
  const { programLimit } = getPlanLimits(plan)
  const current = await db.loyaltyProgram.count({
    where: { restaurantId, status: { not: "ARCHIVED" } },
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
    select: { plan: true, slug: true },
  })
  if (!restaurant) return { allowed: false, current: 0, limit: 0, approaching: false }

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

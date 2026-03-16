"use server"

import { db } from "@/lib/db"
import { assertOrganizationRole, getOrganizationForUser, getCurrentUser, isAdminRole } from "@/lib/dal"
import { stripe, PLANS, getPlanLimits, isPassTypeAllowed, isActiveSubscription, type PlanId } from "@/lib/stripe"

// ─── Types ──────────────────────────────────────────────────

export type BillingData = {
  organization: {
    id: string
    name: string
    plan: string
    subscriptionStatus: string
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    trialEndsAt: Date | null
  }
  usage: {
    contacts: number
    contactLimit: number
    contactPercent: number
    staff: number
    staffLimit: number
    staffPercent: number
    programs: number
    programLimit: number
    programPercent: number
  }
  plans: typeof PLANS
}

// ─── Get Billing Data ──────────────────────────────────────

export async function getBillingData(): Promise<BillingData | { error: string }> {
  try {
    const organization = await getOrganizationForUser()
    if (!organization) return { error: "No organization found" }

    await assertOrganizationRole(organization.id, "owner")

    const plan = organization.plan as PlanId
    const limits = getPlanLimits(plan)

    // Count usage metrics in parallel
    const [contactCount, memberCount, programCount] = await Promise.all([
      db.contact.count({
        where: { organizationId: organization.id },
      }),
      db.member.count({
        where: { organizationId: organization.id },
      }),
      db.passTemplate.count({
        where: { organizationId: organization.id, status: "ACTIVE" },
      }),
    ])
    const staffCount = memberCount ?? 1

    const contactPercent = limits.customerLimit === Infinity
      ? 0
      : Math.round((contactCount / limits.customerLimit) * 100)

    const staffPercent = limits.staffLimit === Infinity
      ? 0
      : Math.round((staffCount / limits.staffLimit) * 100)

    const programPercent = limits.programLimit === Infinity
      ? 0
      : Math.round((programCount / limits.programLimit) * 100)

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        plan: organization.plan,
        subscriptionStatus: organization.subscriptionStatus,
        stripeCustomerId: organization.stripeCustomerId,
        stripeSubscriptionId: organization.stripeSubscriptionId,
        trialEndsAt: organization.trialEndsAt,
      },
      usage: {
        contacts: contactCount,
        contactLimit: limits.customerLimit,
        contactPercent,
        staff: staffCount,
        staffLimit: limits.staffLimit,
        staffPercent,
        programs: programCount,
        programLimit: limits.programLimit,
        programPercent,
      },
      plans: PLANS,
    }
  } catch {
    return { error: "Failed to load billing data" }
  }
}

// ─── Create Checkout Session ───────────────────────────────

export async function createCheckoutSession(priceLookupKey: string): Promise<{ url: string } | { error: string }> {
  const organization = await getOrganizationForUser()
  if (!organization) return { error: "No organization found" }

  await assertOrganizationRole(organization.id, "owner")

  if (!priceLookupKey || typeof priceLookupKey !== "string") {
    return { error: "Missing price lookup key" }
  }

  // If user already has an active subscription, use the billing portal for plan changes
  if (organization.stripeSubscriptionId && isActiveSubscription(organization.subscriptionStatus)) {
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
  let stripeCustomerId = organization.stripeCustomerId

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: organization.name,
      metadata: {
        loyalshy_organization_id: organization.id,
      },
    })
    stripeCustomerId = customer.id

    await db.organization.update({
      where: { id: organization.id },
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
        loyalshy_organization_id: organization.id,
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
  const organization = await getOrganizationForUser()
  if (!organization) return { error: "No organization found" }

  await assertOrganizationRole(organization.id, "owner")

  if (!organization.stripeCustomerId) {
    return { error: "No billing account found. Please subscribe to a plan first." }
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: organization.stripeCustomerId,
    return_url: `${baseUrl}/dashboard/settings?tab=billing`,
  })

  return { url: portalSession.url }
}

// ─── Check Plan Limits ──────────────────────────────────────

export async function checkContactLimit(organizationId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
  approaching: boolean
}> {
  // Super admins bypass plan restrictions
  const currentUser = await getCurrentUser()
  if (isAdminRole(currentUser?.user.role ?? "")) {
    const current = await db.contact.count({ where: { organizationId } })
    return { allowed: true, current, limit: Infinity, approaching: false }
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, subscriptionStatus: true },
  })
  if (!organization) return { allowed: false, current: 0, limit: 0, approaching: false }

  if (!isActiveSubscription(organization.subscriptionStatus)) {
    return { allowed: false, current: 0, limit: 0, approaching: false }
  }

  const plan = organization.plan as PlanId
  const { customerLimit } = getPlanLimits(plan)
  const current = await db.contact.count({ where: { organizationId } })

  return {
    allowed: current < customerLimit,
    current,
    limit: customerLimit,
    approaching: customerLimit !== Infinity && current >= customerLimit * 0.8,
  }
}

export async function checkTemplateLimit(organizationId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
  approaching: boolean
}> {
  // Super admins bypass plan restrictions
  const currentUser = await getCurrentUser()
  if (isAdminRole(currentUser?.user.role ?? "")) {
    const current = await db.passTemplate.count({
      where: { organizationId, status: "ACTIVE" },
    })
    return { allowed: true, current, limit: Infinity, approaching: false }
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, subscriptionStatus: true },
  })
  if (!organization) return { allowed: false, current: 0, limit: 0, approaching: false }

  if (!isActiveSubscription(organization.subscriptionStatus)) {
    return { allowed: false, current: 0, limit: 0, approaching: false }
  }

  const plan = organization.plan as PlanId
  const { programLimit } = getPlanLimits(plan)
  // Only count ACTIVE templates toward the limit
  const current = await db.passTemplate.count({
    where: { organizationId, status: "ACTIVE" },
  })

  return {
    allowed: current < programLimit,
    current,
    limit: programLimit,
    approaching: programLimit !== Infinity && current >= programLimit * 0.8,
  }
}

export async function checkPassTypeAllowed(organizationId: string, passType: string): Promise<boolean> {
  // Super admins bypass plan restrictions
  const currentUser = await getCurrentUser()
  if (isAdminRole(currentUser?.user.role ?? "")) return true

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  })
  if (!organization) return false
  return isPassTypeAllowed(organization.plan as PlanId, passType)
}

export async function checkStaffLimit(organizationId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
  approaching: boolean
}> {
  // Super admins bypass plan restrictions
  const currentUser = await getCurrentUser()
  if (isAdminRole(currentUser?.user.role ?? "")) {
    const current = await db.member.count({ where: { organizationId } })
    return { allowed: true, current, limit: Infinity, approaching: false }
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, subscriptionStatus: true },
  })
  if (!organization) return { allowed: false, current: 0, limit: 0, approaching: false }

  if (!isActiveSubscription(organization.subscriptionStatus)) {
    return { allowed: false, current: 0, limit: 0, approaching: false }
  }

  const plan = organization.plan as PlanId
  const { staffLimit } = getPlanLimits(plan)

  const memberCount = await db.member.count({
    where: { organizationId },
  })
  const current = memberCount ?? 1

  // Also count pending invitations
  const pendingCount = await db.staffInvitation.count({
    where: {
      organizationId,
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

import "server-only"

import Stripe from "stripe"

// ─── Stripe Client ─────────────────────────────────────────

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  return new Stripe(key, { apiVersion: "2026-01-28.clover" as Stripe.LatestApiVersion })
}

// Lazy singleton — avoid construction at import time (build safety)
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    const client = getStripeClient()
    const value = Reflect.get(client, prop, client)
    if (typeof value === "function") {
      return value.bind(client)
    }
    return value
  },
})

// ─── Plan Definitions ──────────────────────────────────────

export type PlanId = "FREE" | "STARTER" | "PRO" | "ENTERPRISE"

export type PlanDefinition = {
  id: PlanId
  name: string
  description: string
  price: number | null // null = custom pricing
  customerLimit: number
  staffLimit: number
  features: string[]
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    description: "Get started with the basics",
    price: 0,
    customerLimit: 50,
    staffLimit: 1,
    features: [
      "Up to 50 customers",
      "1 staff member",
      "Basic analytics",
      "Wallet pass with watermark",
    ],
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    description: "For growing restaurants",
    price: 29,
    customerLimit: 500,
    staffLimit: 3,
    features: [
      "Up to 500 customers",
      "3 staff members",
      "Full analytics",
      "Custom branding (no watermark)",
      "Email support",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    description: "For serious loyalty programs",
    price: 79,
    customerLimit: Infinity,
    staffLimit: 10,
    features: [
      "Unlimited customers",
      "10 staff members",
      "Priority support",
      "API access",
      "Advanced analytics",
      "Multi-location (coming soon)",
    ],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom solutions for large chains",
    price: null,
    customerLimit: Infinity,
    staffLimit: Infinity,
    features: [
      "Everything in Pro",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantees",
    ],
  },
}

// ─── Stripe Price Lookup Keys ──────────────────────────────
// These match the lookup_key set during Stripe product/price seeding.

export const STRIPE_PRICE_LOOKUP_KEYS: Record<string, PlanId> = {
  starter_monthly: "STARTER",
  pro_monthly: "PRO",
}

export function getPlanForPriceLookupKey(lookupKey: string): PlanId {
  return STRIPE_PRICE_LOOKUP_KEYS[lookupKey] ?? "FREE"
}

// ─── Helpers ───────────────────────────────────────────────

export function getPlanLimits(plan: PlanId) {
  return {
    customerLimit: PLANS[plan].customerLimit,
    staffLimit: PLANS[plan].staffLimit,
  }
}

export function isUpgrade(currentPlan: PlanId, newPlan: PlanId): boolean {
  const order: PlanId[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"]
  return order.indexOf(newPlan) > order.indexOf(currentPlan)
}

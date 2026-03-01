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

export type PlanId = "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE"

export type PlanDefinition = {
  id: PlanId
  name: string
  description: string
  price: number | null // null = custom pricing
  annualPrice: number | null // null = custom pricing
  customerLimit: number
  staffLimit: number
  programLimit: number
  features: string[]
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    description: "For small restaurants getting started",
    price: 15,
    annualPrice: 12,
    customerLimit: 200,
    staffLimit: 2,
    programLimit: 1,
    features: [
      "Up to 200 customers",
      "2 staff members",
      "1 loyalty program",
      "Apple & Google Wallet passes",
      "Card design studio",
      "Dashboard analytics",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    description: "For growing restaurants",
    price: 39,
    annualPrice: 31,
    customerLimit: 1_000,
    staffLimit: 5,
    programLimit: 3,
    features: [
      "Up to 1,000 customers",
      "5 staff members",
      "Up to 3 programs",
      "Apple & Google Wallet passes",
      "Card design studio",
      "Dashboard analytics",
      "Email support",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    description: "For serious loyalty programs",
    price: 79,
    annualPrice: 63,
    customerLimit: Infinity,
    staffLimit: 15,
    programLimit: 10,
    features: [
      "Unlimited customers",
      "15 staff members",
      "Up to 10 programs",
      "Apple & Google Wallet passes",
      "Card design studio",
      "Dashboard analytics",
      "Priority support",
    ],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom solutions for large chains",
    price: null,
    annualPrice: null,
    customerLimit: Infinity,
    staffLimit: Infinity,
    programLimit: Infinity,
    features: [
      "Everything in Business",
      "Unlimited staff members",
      "Unlimited programs",
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
  business_monthly: "BUSINESS",
}

export function getPlanForPriceLookupKey(lookupKey: string): PlanId {
  return STRIPE_PRICE_LOOKUP_KEYS[lookupKey] ?? "STARTER"
}

// ─── Helpers ───────────────────────────────────────────────

export function getPlanLimits(plan: PlanId) {
  return {
    customerLimit: PLANS[plan].customerLimit,
    staffLimit: PLANS[plan].staffLimit,
    programLimit: PLANS[plan].programLimit,
  }
}

export function isUpgrade(currentPlan: PlanId, newPlan: PlanId): boolean {
  const order: PlanId[] = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"]
  return order.indexOf(newPlan) > order.indexOf(currentPlan)
}

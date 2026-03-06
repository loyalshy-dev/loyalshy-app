// ─── Plan Definitions (shared between client and server) ──

export type PlanId = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE"

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
    description: "For small businesses getting started",
    price: 19,
    annualPrice: 15,
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
  GROWTH: {
    id: "GROWTH",
    name: "Growth",
    description: "For growing businesses",
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
  SCALE: {
    id: "SCALE",
    name: "Scale",
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
      "Everything in Scale",
      "Unlimited staff members",
      "Unlimited programs",
      "Dedicated support",
      "SLA guarantees",
    ],
  },
}

// ─── Plan Helpers ─────────────────────────────────────────

const PLAN_ORDER: PlanId[] = ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"]

export function isUpgrade(currentPlan: PlanId, newPlan: PlanId): boolean {
  return PLAN_ORDER.indexOf(newPlan) > PLAN_ORDER.indexOf(currentPlan)
}

export function getPlanLimits(plan: PlanId) {
  return {
    customerLimit: PLANS[plan].customerLimit,
    staffLimit: PLANS[plan].staffLimit,
    programLimit: PLANS[plan].programLimit,
  }
}

/** Returns true if the subscription is in a state that allows feature usage */
export function isActiveSubscription(status: string): boolean {
  return status === "TRIALING" || status === "ACTIVE"
}

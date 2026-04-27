// ─── Plan Definitions (shared between client and server) ──

export type PlanId = "FREE" | "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE"

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
  FREE: {
    id: "FREE",
    name: "Free",
    description: "Try Loyalshy with your first customers",
    price: 0,
    annualPrice: 0,
    customerLimit: 50,
    staffLimit: 1,
    programLimit: 1,
    features: [
      "Up to 50 contacts",
      "1 program (stamp card or coupon)",
      "1 staff member",
      "Apple & Google Wallet",
      "Card design studio",
    ],
  },
  STARTER: {
    id: "STARTER",
    name: "Pro",
    description: "For small businesses ready to grow",
    price: 29,
    annualPrice: 24,
    customerLimit: 500,
    staffLimit: 2,
    programLimit: 2,
    features: [
      "Up to 500 contacts",
      "2 staff members",
      "Up to 2 programs",
      "Apple & Google Wallet passes",
      "Card design studio",
      "Dashboard analytics",
    ],
  },
  GROWTH: {
    id: "GROWTH",
    name: "Business",
    description: "For growing businesses with multiple programs",
    price: 49,
    annualPrice: 39,
    customerLimit: 2_500,
    staffLimit: 5,
    programLimit: 5,
    features: [
      "Up to 2,500 contacts",
      "5 staff members",
      "Up to 5 programs",
      "Custom brand colors on passes",
      "Bulk CSV import",
      "Priority email support",
    ],
  },
  SCALE: {
    id: "SCALE",
    name: "Scale",
    description: "For serious loyalty programs at scale",
    price: 99,
    annualPrice: 79,
    customerLimit: Infinity,
    staffLimit: 25,
    programLimit: Infinity,
    features: [
      "Unlimited contacts",
      "25 staff members",
      "Unlimited programs",
      "Custom brand colors on passes",
      "Bulk CSV import",
      "Dedicated onboarding call",
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
      "White-label branding",
      "Dedicated support & SLA",
    ],
  },
}

// ─── Plan Helpers ─────────────────────────────────────────

const PLAN_ORDER: PlanId[] = ["FREE", "STARTER", "GROWTH", "SCALE", "ENTERPRISE"]

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

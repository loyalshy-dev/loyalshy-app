// ─── Plan Definitions (shared between client and server) ──

export type PlanId = "FREE" | "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE"

export type PassType = "STAMP_CARD" | "COUPON" | "MEMBERSHIP" | "POINTS" | "GIFT_CARD" | "TICKET" | "BUSINESS_CARD"

export const ALL_PASS_TYPES: PassType[] = [
  "STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "GIFT_CARD", "TICKET", "BUSINESS_CARD",
]

export type PlanDefinition = {
  id: PlanId
  name: string
  description: string
  price: number | null // null = custom pricing
  annualPrice: number | null // null = custom pricing
  customerLimit: number
  staffLimit: number
  programLimit: number
  allowedPassTypes: PassType[] // which pass types this plan can create
  features: string[]
  apiAccess: boolean
  apiRateLimit: number // requests per minute (0 for no access)
  apiDailyLimit: number // requests per day (Infinity for unlimited)
  apiKeyLimit: number // max API keys per org (0 for no access)
  webhookEndpointLimit: number // max webhook endpoints per org (0 for no access)
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
    allowedPassTypes: ["STAMP_CARD", "COUPON", "BUSINESS_CARD"],
    features: [
      "Up to 50 contacts",
      "1 program (stamp card, coupon, or business card)",
      "1 staff member",
      "Apple & Google Wallet",
      "Card design studio",
      "API access (5 req/min)",
    ],
    apiAccess: true,
    apiRateLimit: 5,
    apiDailyLimit: 100,
    apiKeyLimit: 1,
    webhookEndpointLimit: 1,
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
    allowedPassTypes: ALL_PASS_TYPES,
    features: [
      "Up to 500 contacts",
      "2 staff members",
      "Up to 2 programs",
      "All 7 pass types",
      "Apple & Google Wallet passes",
      "Card design studio",
      "Dashboard analytics",
      "API access (20 req/min)",
    ],
    apiAccess: true,
    apiRateLimit: 20,
    apiDailyLimit: 1_000,
    apiKeyLimit: 2,
    webhookEndpointLimit: 1,
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
    allowedPassTypes: ALL_PASS_TYPES,
    features: [
      "Up to 2,500 contacts",
      "5 staff members",
      "Up to 5 programs",
      "All 7 pass types",
      "Custom brand colors on passes",
      "Bulk CSV import",
      "Priority email support",
      "API access (60 req/min)",
    ],
    apiAccess: true,
    apiRateLimit: 60,
    apiDailyLimit: 10_000,
    apiKeyLimit: 10,
    webhookEndpointLimit: 5,
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
    allowedPassTypes: ALL_PASS_TYPES,
    features: [
      "Unlimited contacts",
      "25 staff members",
      "Unlimited programs",
      "All 7 pass types",
      "Custom brand colors on passes",
      "Bulk CSV import",
      "Webhook events",
      "Dedicated onboarding call",
      "API access (300 req/min)",
    ],
    apiAccess: true,
    apiRateLimit: 300,
    apiDailyLimit: 100_000,
    apiKeyLimit: 25,
    webhookEndpointLimit: 10,
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
    allowedPassTypes: ALL_PASS_TYPES,
    features: [
      "Everything in Scale",
      "Unlimited staff members",
      "Unlimited programs",
      "White-label branding",
      "Dedicated support & SLA",
      "API access (600 req/min)",
    ],
    apiAccess: true,
    apiRateLimit: 600,
    apiDailyLimit: Infinity,
    apiKeyLimit: 50,
    webhookEndpointLimit: 25,
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

export function getAllowedPassTypes(plan: PlanId): PassType[] {
  return PLANS[plan].allowedPassTypes
}

export function isPassTypeAllowed(plan: PlanId, passType: string): boolean {
  return PLANS[plan].allowedPassTypes.includes(passType as PassType)
}

/** Returns true if the subscription is in a state that allows feature usage */
export function isActiveSubscription(status: string): boolean {
  return status === "TRIALING" || status === "ACTIVE"
}

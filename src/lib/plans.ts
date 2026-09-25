// ─── Plan Definitions (shared between client and server) ──

export type PlanId = "FREE" | "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE"

export type AnnouncementPeriod = "lifetime" | "week"

export type PlanDefinition = {
  id: PlanId
  name: string
  description: string
  price: number | null // null = custom pricing
  annualPrice: number | null // null = custom pricing
  customerLimit: number
  staffLimit: number
  programLimit: number
  /** Wallet announcements per organization (shared across all programs). */
  announcementLimit: number
  /** "lifetime" = total ever sent; "week" = rolling 7 days. */
  announcementPeriod: AnnouncementPeriod
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
    announcementLimit: 2,
    announcementPeriod: "lifetime",
    features: [
      "Up to 50 contacts",
      "1 program",
      "1 staff member",
      "2 wallet announcements",
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
    announcementLimit: 1,
    announcementPeriod: "week",
    features: [
      "Up to 500 contacts",
      "Up to 2 programs",
      "2 staff members",
      "1 wallet announcement / week",
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
    announcementLimit: 2,
    announcementPeriod: "week",
    features: [
      "Up to 2,500 contacts",
      "Up to 5 programs",
      "5 staff members",
      "2 wallet announcements / week",
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
    announcementLimit: 5,
    announcementPeriod: "week",
    features: [
      "Unlimited contacts",
      "Unlimited programs",
      "25 staff members",
      "5 wallet announcements / week",
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
    announcementLimit: Infinity,
    announcementPeriod: "week",
    features: [
      "Everything in Scale",
      "Unlimited staff members",
      "Unlimited programs",
      "Unlimited wallet announcements",
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
    announcementLimit: PLANS[plan].announcementLimit,
    announcementPeriod: PLANS[plan].announcementPeriod,
  }
}

/** Returns true if the subscription is in a state that allows feature usage */
export function isActiveSubscription(status: string): boolean {
  return status === "TRIALING" || status === "ACTIVE"
}

/** Next self-serve plan that raises the announcement quota (null on Scale+). */
export function getAnnouncementUpgrade(plan: PlanId): PlanDefinition | null {
  const next: Partial<Record<PlanId, PlanId>> = {
    FREE: "STARTER",
    STARTER: "GROWTH",
    GROWTH: "SCALE",
  }
  const target = next[plan]
  return target ? PLANS[target] : null
}

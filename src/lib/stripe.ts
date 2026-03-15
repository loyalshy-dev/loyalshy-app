import "server-only"

import Stripe from "stripe"

// Re-export plan definitions from shared (client-safe) module
export { PLANS, getPlanLimits, getAllowedPassTypes, isPassTypeAllowed, isUpgrade, isActiveSubscription } from "./plans"
export type { PlanId, PlanDefinition, PassType as PlanPassType } from "./plans"

// ─── Stripe Client ─────────────────────────────────────────

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  return new Stripe(key, { apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion })
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

// ─── Stripe Price Lookup Keys ──────────────────────────────
// These match the lookup_key set during Stripe product/price seeding.

import type { PlanId } from "./plans"

export const STRIPE_PRICE_LOOKUP_KEYS: Record<string, PlanId> = {
  starter_monthly: "STARTER",
  starter_annual: "STARTER",
  growth_monthly: "GROWTH",
  growth_annual: "GROWTH",
  scale_monthly: "SCALE",
  scale_annual: "SCALE",
}

export function getPlanForPriceLookupKey(lookupKey: string): PlanId {
  return STRIPE_PRICE_LOOKUP_KEYS[lookupKey] ?? "STARTER"
}

// ─── Subscription Status Mapping ──────────────────────────
// Shared between webhook handler and Trigger.dev task.

export type SubscriptionStatusValue = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED"

export function mapSubscriptionStatus(status: string): SubscriptionStatusValue {
  switch (status) {
    case "trialing": return "TRIALING"
    case "active": return "ACTIVE"
    case "past_due": return "PAST_DUE"
    case "canceled":
    case "unpaid":
    case "incomplete_expired": return "CANCELED"
    case "incomplete": return "PAST_DUE"
    case "paused": return "CANCELED"
    default: return "ACTIVE"
  }
}

// ─── Invoice Helpers ──────────────────────────────────────
// Stripe API v20 moved subscription ID to invoice.parent.subscription_details.

export function getSubscriptionIdFromInvoice(invoice: Record<string, unknown>): string | null {
  const parent = invoice.parent as Record<string, unknown> | undefined
  const subDetails = parent?.subscription_details as Record<string, unknown> | undefined
  const sub = subDetails?.subscription
  if (!sub) return null
  return typeof sub === "string" ? sub : (sub as { id: string }).id
}

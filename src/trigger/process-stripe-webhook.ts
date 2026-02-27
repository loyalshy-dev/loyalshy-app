import { task, AbortTaskRunError } from "@trigger.dev/sdk"
import { billingQueue } from "./queues"
import { createDb } from "./db"

// ─── Types ──────────────────────────────────────────────────

type StripeWebhookPayload = {
  eventId: string
  eventType: string
  data: Record<string, unknown>
}

// ─── Process Stripe Webhook ────────────────────────────────
// Handles Stripe subscription events asynchronously via Trigger.dev.
// The primary webhook handler (/api/stripe/webhook) processes events
// inline for low latency. This task is available as a fallback for
// heavy or batched processing.

export const processStripeWebhookTask = task({
  id: "process-stripe-webhook",
  queue: billingQueue,
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 60_000,
  },
  run: async (payload: StripeWebhookPayload) => {
    const db = createDb()

    try {
      switch (payload.eventType) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = payload.data as Record<string, unknown>
          const restaurantId = (subscription.metadata as Record<string, string>)?.fidelio_restaurant_id

          if (!restaurantId) {
            return { processed: false, reason: "no_restaurant_id" }
          }

          const items = subscription.items as { data: Array<{ price: { lookup_key?: string } }> }
          const lookupKey = items?.data?.[0]?.price?.lookup_key
          const plan = lookupKeyToPlan(lookupKey)
          const status = mapStatus(subscription.status as string)

          await db.restaurant.update({
            where: { id: restaurantId },
            data: {
              stripeSubscriptionId: subscription.id as string,
              stripeCustomerId: subscription.customer as string,
              plan: plan as never,
              subscriptionStatus: status as never,
              trialEndsAt: subscription.trial_end
                ? new Date((subscription.trial_end as number) * 1000)
                : null,
            },
          })

          return { processed: true, eventType: payload.eventType, plan, status }
        }

        case "customer.subscription.deleted": {
          const subscription = payload.data as Record<string, unknown>

          const restaurant = await db.restaurant.findFirst({
            where: {
              OR: [
                { stripeSubscriptionId: subscription.id as string },
                { stripeCustomerId: subscription.customer as string },
              ],
            },
          })

          if (!restaurant) {
            return { processed: false, reason: "restaurant_not_found" }
          }

          await db.restaurant.update({
            where: { id: restaurant.id },
            data: {
              plan: "FREE" as never,
              subscriptionStatus: "CANCELED" as never,
              stripeSubscriptionId: null,
              trialEndsAt: null,
            },
          })

          return { processed: true, eventType: payload.eventType }
        }

        case "invoice.payment_failed": {
          const invoice = payload.data as Record<string, unknown>
          if (!invoice.subscription) {
            return { processed: false, reason: "no_subscription" }
          }

          const restaurant = await db.restaurant.findFirst({
            where: {
              OR: [
                { stripeSubscriptionId: invoice.subscription as string },
                { stripeCustomerId: invoice.customer as string },
              ],
            },
          })

          if (restaurant) {
            await db.restaurant.update({
              where: { id: restaurant.id },
              data: { subscriptionStatus: "PAST_DUE" as never },
            })
          }

          return { processed: true, eventType: payload.eventType }
        }

        case "invoice.paid": {
          const invoice = payload.data as Record<string, unknown>
          if (!invoice.subscription) {
            return { processed: false, reason: "no_subscription" }
          }

          const restaurant = await db.restaurant.findFirst({
            where: {
              OR: [
                { stripeSubscriptionId: invoice.subscription as string },
                { stripeCustomerId: invoice.customer as string },
              ],
            },
          })

          if (restaurant && restaurant.subscriptionStatus === "PAST_DUE") {
            await db.restaurant.update({
              where: { id: restaurant.id },
              data: { subscriptionStatus: "ACTIVE" as never },
            })
          }

          return { processed: true, eventType: payload.eventType }
        }

        default:
          throw new AbortTaskRunError(`Unhandled event type: ${payload.eventType}`)
      }
    } finally {
      await db.$disconnect()
    }
  },
})

// ─── Helpers ───────────────────────────────────────────────

function lookupKeyToPlan(lookupKey?: string): string {
  const map: Record<string, string> = {
    starter_monthly: "STARTER",
    pro_monthly: "PRO",
  }
  return lookupKey ? (map[lookupKey] ?? "FREE") : "FREE"
}

function mapStatus(status: string): string {
  switch (status) {
    case "trialing": return "TRIALING"
    case "active": return "ACTIVE"
    case "past_due": return "PAST_DUE"
    case "canceled":
    case "unpaid":
    case "incomplete_expired": return "CANCELED"
    default: return "ACTIVE"
  }
}

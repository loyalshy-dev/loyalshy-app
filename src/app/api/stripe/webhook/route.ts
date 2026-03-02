import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { db } from "@/lib/db"
import { stripe, mapSubscriptionStatus, getSubscriptionIdFromInvoice } from "@/lib/stripe"

// ─── Stripe Webhook Handler ────────────────────────────────
// Verifies signature, then processes billing events inline.
// Idempotency: uses DB-backed WebhookEvent table for cross-instance deduplication.

// Map Stripe price lookup keys to Loyalshy plan enum values
const LOOKUP_KEY_TO_PLAN: Record<string, string> = {
  starter_monthly: "STARTER",
  pro_monthly: "PRO",
  business_monthly: "BUSINESS",
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err instanceof Error ? err.message : "Unknown error")
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // DB-backed idempotency check
  try {
    await db.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
      },
    })
  } catch (err) {
    // Unique constraint violation = already processed
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ received: true, deduplicated: true })
    }
    // Other DB errors — log but continue processing (better to double-process than miss)
    console.error("Idempotency check error:", err instanceof Error ? err.message : "Unknown error")
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case "customer.subscription.trial_will_end":
        // Trial reminder emails already handled by CRON job in Trigger.dev
        break

      default:
        // Unhandled event type — not an error
        break
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err instanceof Error ? err.message : "Unknown error")
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Helpers ───────────────────────────────────────────────

function getPlanFromSubscription(subscription: Stripe.Subscription): string {
  const item = subscription.items.data[0]
  if (!item) return "STARTER"

  const lookupKey = item.price.lookup_key
  if (lookupKey && LOOKUP_KEY_TO_PLAN[lookupKey]) {
    return LOOKUP_KEY_TO_PLAN[lookupKey]
  }

  return "STARTER"
}

// ─── Event Handlers ────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || !session.subscription) return

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string,
    { expand: ["items.data.price"] }
  )

  const restaurantId = subscription.metadata?.loyalshy_restaurant_id
  if (!restaurantId) {
    console.error("No loyalshy_restaurant_id in subscription metadata")
    return
  }

  await db.restaurant.update({
    where: { id: restaurantId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      plan: getPlanFromSubscription(subscription) as never,
      subscriptionStatus: mapSubscriptionStatus(subscription.status) as never,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const restaurant = await db.restaurant.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        { stripeCustomerId: subscription.customer as string },
      ],
    },
  })

  if (!restaurant) return

  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      stripeSubscriptionId: subscription.id,
      plan: getPlanFromSubscription(subscription) as never,
      subscriptionStatus: mapSubscriptionStatus(subscription.status) as never,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const restaurant = await db.restaurant.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        { stripeCustomerId: subscription.customer as string },
      ],
    },
  })

  if (!restaurant) return

  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      subscriptionStatus: "CANCELED" as never,
      plan: "STARTER" as never,
      stripeSubscriptionId: null,
      trialEndsAt: null,
    },
  })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice as unknown as Record<string, unknown>)
  if (!subscriptionId) return

  const restaurant = await db.restaurant.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscriptionId },
        { stripeCustomerId: invoice.customer as string },
      ],
    },
  })

  if (!restaurant) return

  await db.restaurant.update({
    where: { id: restaurant.id },
    data: { subscriptionStatus: "PAST_DUE" as never },
  })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice as unknown as Record<string, unknown>)
  if (!subscriptionId) return

  const restaurant = await db.restaurant.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscriptionId },
        { stripeCustomerId: invoice.customer as string },
      ],
    },
  })

  if (!restaurant) return

  // If the restaurant was past_due, set back to active
  if (restaurant.subscriptionStatus === "PAST_DUE") {
    await db.restaurant.update({
      where: { id: restaurant.id },
      data: { subscriptionStatus: "ACTIVE" as never },
    })
  }
}

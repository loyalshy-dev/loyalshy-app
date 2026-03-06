import { NextRequest, NextResponse } from "next/server"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const session = await assertAuthenticated()
    const organization = await getOrganizationForUser()
    if (!organization) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 })
    }

    await assertOrganizationRole(organization.id, "owner")

    const { priceLookupKey } = await request.json()

    if (!priceLookupKey || typeof priceLookupKey !== "string") {
      return NextResponse.json({ error: "Missing priceLookupKey" }, { status: 400 })
    }

    // Resolve the price from lookup key
    const prices = await stripe.prices.list({
      lookup_keys: [priceLookupKey],
      active: true,
      limit: 1,
    })

    if (prices.data.length === 0) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 })
    }

    const price = prices.data[0]

    // Create or retrieve Stripe customer
    let stripeCustomerId = organization.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: organization.name,
        metadata: {
          organization_id: organization.id,
        },
      })
      stripeCustomerId = customer.id

      await db.organization.update({
        where: { id: organization.id },
        data: { stripeCustomerId },
      })
    }

    const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/settings?tab=billing&checkout=success`,
      cancel_url: `${baseUrl}/dashboard/settings?tab=billing&checkout=canceled`,
      subscription_data: {
        metadata: {
          organization_id: organization.id,
        },
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Create checkout error:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}

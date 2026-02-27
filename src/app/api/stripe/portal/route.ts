import { NextResponse } from "next/server"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantRole } from "@/lib/dal"
import { stripe } from "@/lib/stripe"

export async function POST() {
  try {
    await assertAuthenticated()
    const restaurant = await getRestaurantForUser()
    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 400 })
    }

    await assertRestaurantRole(restaurant.id, "owner")

    if (!restaurant.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Please subscribe to a plan first." },
        { status: 400 }
      )
    }

    const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: restaurant.stripeCustomerId,
      return_url: `${baseUrl}/dashboard/settings?tab=billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error("Portal session error:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 })
  }
}

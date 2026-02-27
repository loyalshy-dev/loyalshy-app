/**
 * Seed Stripe with Fidelio products and prices.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-stripe.ts
 *
 * This creates (or updates) two Stripe Products with monthly prices:
 *   - Fidelio Starter ($29/month, lookup_key: starter_monthly)
 *   - Fidelio Pro ($79/month, lookup_key: pro_monthly)
 *
 * Idempotent: uses metadata.fidelio_plan to skip existing products.
 */

import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover" as Stripe.LatestApiVersion,
})

const plans = [
  {
    fidelioPlan: "STARTER",
    name: "Fidelio Starter",
    description: "Up to 500 customers, 3 staff, full analytics, custom branding.",
    priceAmount: 2900, // cents
    lookupKey: "starter_monthly",
  },
  {
    fidelioPlan: "PRO",
    name: "Fidelio Pro",
    description: "Unlimited customers, 10 staff, priority support, API access.",
    priceAmount: 7900,
    lookupKey: "pro_monthly",
  },
]

async function main() {
  console.log("Seeding Stripe products and prices...\n")

  for (const plan of plans) {
    // Check if product already exists
    const existing = await stripe.products.search({
      query: `metadata["fidelio_plan"]:"${plan.fidelioPlan}"`,
    })

    let product: Stripe.Product

    if (existing.data.length > 0) {
      product = existing.data[0]
      console.log(`Product "${plan.name}" already exists: ${product.id}`)

      // Update product details
      product = await stripe.products.update(product.id, {
        name: plan.name,
        description: plan.description,
      })
    } else {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { fidelio_plan: plan.fidelioPlan },
      })
      console.log(`Created product "${plan.name}": ${product.id}`)
    }

    // Check if price with lookup_key exists
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      lookup_keys: [plan.lookupKey],
    })

    if (prices.data.length > 0) {
      console.log(`  Price "${plan.lookupKey}" already exists: ${prices.data[0].id}`)
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.priceAmount,
        currency: "usd",
        recurring: { interval: "month" },
        lookup_key: plan.lookupKey,
        transfer_lookup_key: true,
      })
      console.log(`  Created price "${plan.lookupKey}": ${price.id} ($${plan.priceAmount / 100}/month)`)
    }

    console.log()
  }

  // Create the customer portal configuration
  console.log("Setting up Stripe Customer Portal...")
  try {
    const configs = await stripe.billingPortal.configurations.list({ limit: 1 })
    if (configs.data.length > 0) {
      console.log(`Portal configuration already exists: ${configs.data[0].id}`)
    } else {
      const config = await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: "Manage your Fidelio subscription",
        },
        features: {
          subscription_update: {
            enabled: true,
            default_allowed_updates: ["price"],
            proration_behavior: "create_prorations",
          },
          subscription_cancel: {
            enabled: true,
            mode: "at_period_end",
          },
          invoice_history: {
            enabled: true,
          },
          payment_method_update: {
            enabled: true,
          },
        },
      })
      console.log(`Created portal configuration: ${config.id}`)
    }
  } catch (err) {
    console.log("Portal configuration may require product price IDs — configure manually if needed.")
  }

  console.log("\nDone! Stripe is seeded.")
}

main().catch((err) => {
  console.error("Failed to seed Stripe:", err)
  process.exit(1)
})

/**
 * Seed Stripe with Loyalshy products and prices.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-stripe.ts
 *
 * This creates (or updates) three Stripe Products with monthly + annual prices:
 *   - Loyalshy Pro      (€29/month, €24/month annual, lookup_keys: starter_monthly, starter_annual)
 *   - Loyalshy Business (€49/month, €39/month annual, lookup_keys: growth_monthly, growth_annual)
 *   - Loyalshy Scale    (€99/month, €79/month annual, lookup_keys: scale_monthly, scale_annual)
 *
 * Idempotent: uses metadata.loyalshy_plan to skip existing products.
 */

import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
})

const plans = [
  {
    loyalshyPlan: "STARTER",
    name: "Loyalshy Pro",
    description: "Up to 500 contacts, 2 staff, all 6 pass types, card design studio.",
    prices: [
      { amount: 2900, interval: "month" as const, lookupKey: "starter_monthly" },
      { amount: 2400, interval: "month" as const, lookupKey: "starter_annual", intervalCount: 12 },
    ],
  },
  {
    loyalshyPlan: "GROWTH",
    name: "Loyalshy Business",
    description: "Up to 2,500 contacts, 5 staff, custom brand colors, bulk CSV import.",
    prices: [
      { amount: 4900, interval: "month" as const, lookupKey: "growth_monthly" },
      { amount: 3900, interval: "month" as const, lookupKey: "growth_annual", intervalCount: 12 },
    ],
  },
  {
    loyalshyPlan: "SCALE",
    name: "Loyalshy Scale",
    description: "Unlimited contacts, 25 staff, unlimited programs, webhook events.",
    prices: [
      { amount: 9900, interval: "month" as const, lookupKey: "scale_monthly" },
      { amount: 7900, interval: "month" as const, lookupKey: "scale_annual", intervalCount: 12 },
    ],
  },
]

async function main() {
  console.log("Seeding Stripe products and prices...\n")

  for (const plan of plans) {
    // Check if product already exists
    const existing = await stripe.products.search({
      query: `metadata["loyalshy_plan"]:"${plan.loyalshyPlan}"`,
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
        metadata: { loyalshy_plan: plan.loyalshyPlan },
      })
      console.log(`Created product "${plan.name}": ${product.id}`)
    }

    for (const priceConfig of plan.prices) {
      // Check if price with lookup_key exists
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        lookup_keys: [priceConfig.lookupKey],
      })

      if (prices.data.length > 0) {
        console.log(`  Price "${priceConfig.lookupKey}" already exists: ${prices.data[0].id}`)
      } else {
        const recurring: Stripe.PriceCreateParams.Recurring = priceConfig.intervalCount
          ? { interval: "year" }
          : { interval: priceConfig.interval }

        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: priceConfig.amount,
          currency: "eur",
          recurring,
          lookup_key: priceConfig.lookupKey,
          transfer_lookup_key: true,
        })
        const label = priceConfig.intervalCount ? `€${priceConfig.amount / 100}/mo (annual)` : `€${priceConfig.amount / 100}/month`
        console.log(`  Created price "${priceConfig.lookupKey}": ${price.id} (${label})`)
      }
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
          headline: "Manage your Loyalshy subscription",
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

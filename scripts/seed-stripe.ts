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
    description: "Up to 500 contacts, 2 staff, 2 programs, card design studio.",
    prices: [
      { amount: 2900, interval: "month" as const, lookupKey: "starter_monthly" },
      { amount: 2400, interval: "month" as const, lookupKey: "starter_annual", intervalCount: 12 },
    ],
  },
  {
    loyalshyPlan: "GROWTH",
    name: "Loyalshy Business",
    description: "Up to 2,500 contacts, 5 staff, 5 programs, custom branding, bulk CSV import.",
    prices: [
      { amount: 4900, interval: "month" as const, lookupKey: "growth_monthly" },
      { amount: 3900, interval: "month" as const, lookupKey: "growth_annual", intervalCount: 12 },
    ],
  },
  {
    loyalshyPlan: "SCALE",
    name: "Loyalshy Scale",
    description: "Unlimited contacts, 25 staff, unlimited programs, priority support.",
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
      const isAnnual = Boolean(priceConfig.intervalCount)
      // Stripe stores the actual charge per billing cycle. Marketing copy
      // shows "€X/month billed annually", but the customer is charged
      // monthly×12 once per year, so annual unit_amount must be multiplied.
      const unitAmount = isAnnual ? priceConfig.amount * 12 : priceConfig.amount
      const recurring: Stripe.PriceCreateParams.Recurring = isAnnual
        ? { interval: "year" }
        : { interval: priceConfig.interval }

      // Check if price with lookup_key exists
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        lookup_keys: [priceConfig.lookupKey],
      })

      const existing = prices.data[0]
      if (existing && existing.unit_amount === unitAmount) {
        console.log(`  Price "${priceConfig.lookupKey}" already exists: ${existing.id}`)
        continue
      }

      if (existing) {
        // Wrong amount on the existing price — archive it so the lookup_key
        // is freed before we recreate. (Stripe prices are immutable; you
        // archive and replace, you don't update unit_amount.)
        await stripe.prices.update(existing.id, { active: false })
        console.log(`  Archived stale price "${priceConfig.lookupKey}": ${existing.id} (was €${(existing.unit_amount ?? 0) / 100})`)
      }

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: unitAmount,
        currency: "eur",
        recurring,
        lookup_key: priceConfig.lookupKey,
        transfer_lookup_key: true,
      })
      const label = isAnnual
        ? `€${unitAmount / 100}/year (€${priceConfig.amount / 100}/mo billed annually)`
        : `€${unitAmount / 100}/month`
      console.log(`  Created price "${priceConfig.lookupKey}": ${price.id} (${label})`)
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
      // Restrict subscription_update to ONLY the recurring prices we just
      // seeded — without `products`, Stripe lets customers switch to any
      // active price on the account, which is rarely what you want.
      const productConfigs = await Promise.all(
        plans.map(async (plan) => {
          const product = (
            await stripe.products.search({
              query: `metadata["loyalshy_plan"]:"${plan.loyalshyPlan}"`,
            })
          ).data[0]
          if (!product) throw new Error(`Product for plan ${plan.loyalshyPlan} not found — re-run product seeding first`)
          const prices = await stripe.prices.list({ product: product.id, active: true })
          return { product: product.id, prices: prices.data.map((p) => p.id) }
        }),
      )

      const config = await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: "Manage your Loyalshy subscription",
        },
        features: {
          subscription_update: {
            enabled: true,
            default_allowed_updates: ["price"],
            proration_behavior: "create_prorations",
            products: productConfigs,
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
    const stripeErr = err as Stripe.errors.StripeError & { raw?: { message?: string; code?: string; param?: string } }
    console.error("\nPortal configuration FAILED:")
    console.error(`  type:    ${stripeErr.type ?? "(unknown)"}`)
    console.error(`  code:    ${stripeErr.code ?? stripeErr.raw?.code ?? "(none)"}`)
    console.error(`  param:   ${stripeErr.param ?? stripeErr.raw?.param ?? "(none)"}`)
    console.error(`  message: ${stripeErr.message ?? stripeErr.raw?.message ?? String(err)}`)
    console.error("\nMost common fixes:")
    console.error("  - Set a business name in Stripe Dashboard → Settings → Business → Public details")
    console.error("  - Activate the Customer Portal in Stripe Dashboard → Settings → Billing → Customer portal")
    process.exitCode = 1
  }

  console.log("\nDone! Stripe is seeded.")
}

main().catch((err) => {
  console.error("Failed to seed Stripe:", err)
  process.exit(1)
})

import "server-only"

import type Stripe from "stripe"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"

// ─── Monthly partner rev-share statement (shared core) ──────
//
// Consumed by two actions: the admin statement page (/admin/partners) and
// the partner console's self-serve earnings view (/dashboard/partner).
//
// Contract terms (pilot): we pay the partner REV_SHARE_RATE of the month's
// COLLECTED NET revenue from their attributed orgs (paid invoices minus
// refunds issued in the month — refunds on older charges claw back from
// the statement of the month they happen in). The partner owes us
// SETUP_FEE_SHARE per client activated in the month (their share of the
// 100€ setup fee). Both legs net into a single payout figure.
//
// Attribution is Organization.referredById (first-touch, permanent).
// "Activated" = org created in the statement month that has at least one
// ACTIVE program. All money is in euro cents.

export const REV_SHARE_RATE = 0.3
export const SETUP_FEE_SHARE_CENTS = 3000 // 30% of the 100€ setup fee

export type StatementLine = {
  organizationId: string
  name: string
  plan: string
  subscriptionStatus: string
  createdAt: string
  activatedThisMonth: boolean
  grossCollectedCents: number
  refundedCents: number
  netCents: number
}

export type PartnerStatement = {
  partner: { id: string; name: string; email: string }
  period: { year: number; month: number } // month 1-12
  lines: StatementLine[]
  totals: {
    grossCollectedCents: number
    refundedCents: number
    netCollectedCents: number
    revShareCents: number
    newActivatedCount: number
    setupFeeShareCents: number
    payoutCents: number // positive → we pay the partner; negative → they owe us
  }
  revShareRate: number
  setupFeeShareCents: number
}

/**
 * Builds the statement for one partner and one calendar month. Callers are
 * responsible for authorization (admin role, or the partner themselves).
 */
export async function buildPartnerStatement(
  partnerId: string,
  year: number,
  month: number
): Promise<PartnerStatement | { error: string }> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2020 || year > 2100) {
    return { error: "invalid_period" }
  }

  const partner = await db.user.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true, email: true, isPartner: true },
  })
  if (!partner?.isPartner) {
    return { error: "not_a_partner" }
  }

  const periodStart = Date.UTC(year, month - 1, 1) / 1000
  const periodEnd = Date.UTC(year, month, 1) / 1000
  const created = { gte: periodStart, lt: periodEnd }

  const orgs = await db.organization.findMany({
    where: { referredById: partnerId },
    select: {
      id: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      createdAt: true,
      _count: {
        select: { passTemplates: { where: { status: "ACTIVE" } } },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Gross collected: paid invoices created in the period, per customer.
  // Everything is priced in EUR; skip any other currency defensively.
  const grossByCustomer = new Map<string, number>()
  await Promise.all(
    orgs
      .filter((o) => o.stripeCustomerId)
      .map(async (o) => {
        const customer = o.stripeCustomerId!
        const invoices = await stripe.invoices
          .list({ customer, status: "paid", created, limit: 100 })
          .autoPagingToArray({ limit: 1000 })
        const sum = invoices
          .filter((inv) => inv.currency === "eur")
          .reduce((acc, inv) => acc + (inv.amount_paid ?? 0), 0)
        grossByCustomer.set(customer, sum)
      })
  )

  // Refund clawbacks: refunds ISSUED in the period (regardless of the
  // original charge's month), mapped back to attributed customers via the
  // expanded charge. One global paginated listing keeps this a single
  // pass even across many partners' charges.
  const attributedCustomers = new Set(
    orgs.map((o) => o.stripeCustomerId).filter((c): c is string => !!c)
  )
  const refundsByCustomer = new Map<string, number>()
  if (attributedCustomers.size > 0) {
    const refunds = await stripe.refunds
      .list({ created, limit: 100, expand: ["data.charge"] })
      .autoPagingToArray({ limit: 1000 })
    for (const refund of refunds) {
      if (refund.currency !== "eur") continue
      const charge = refund.charge as Stripe.Charge | string | null
      const customer =
        charge && typeof charge === "object"
          ? typeof charge.customer === "string"
            ? charge.customer
            : charge.customer?.id
          : undefined
      if (!customer || !attributedCustomers.has(customer)) continue
      refundsByCustomer.set(
        customer,
        (refundsByCustomer.get(customer) ?? 0) + refund.amount
      )
    }
  }

  const lines: StatementLine[] = orgs.map((o) => {
    const gross = o.stripeCustomerId
      ? (grossByCustomer.get(o.stripeCustomerId) ?? 0)
      : 0
    const refunded = o.stripeCustomerId
      ? (refundsByCustomer.get(o.stripeCustomerId) ?? 0)
      : 0
    const createdMs = o.createdAt.getTime()
    const activatedThisMonth =
      createdMs >= periodStart * 1000 &&
      createdMs < periodEnd * 1000 &&
      o._count.passTemplates > 0
    return {
      organizationId: o.id,
      name: o.name,
      plan: o.plan,
      subscriptionStatus: o.subscriptionStatus,
      createdAt: o.createdAt.toISOString(),
      activatedThisMonth,
      grossCollectedCents: gross,
      refundedCents: refunded,
      netCents: gross - refunded,
    }
  })

  const grossCollectedCents = lines.reduce((a, l) => a + l.grossCollectedCents, 0)
  const refundedCents = lines.reduce((a, l) => a + l.refundedCents, 0)
  const netCollectedCents = grossCollectedCents - refundedCents
  const revShareCents = Math.round(netCollectedCents * REV_SHARE_RATE)
  const newActivatedCount = lines.filter((l) => l.activatedThisMonth).length
  const setupFeeShareCents = newActivatedCount * SETUP_FEE_SHARE_CENTS

  return {
    partner: { id: partner.id, name: partner.name, email: partner.email },
    period: { year, month },
    lines,
    totals: {
      grossCollectedCents,
      refundedCents,
      netCollectedCents,
      revShareCents,
      newActivatedCount,
      setupFeeShareCents,
      payoutCents: revShareCents - setupFeeShareCents,
    },
    revShareRate: REV_SHARE_RATE,
    setupFeeShareCents: SETUP_FEE_SHARE_CENTS,
  }
}

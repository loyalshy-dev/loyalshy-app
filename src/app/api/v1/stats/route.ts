import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight, notFound } from "@/lib/api-session"
import { orgScope } from "@/lib/org-scope"
import { startOfDayInTimeZone } from "@/lib/org-time"

export function OPTIONS() {
  return handlePreflight()
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Today at a glance for the staff app's Home: stamps today, rewards
 * redeemed today (stamp rewards + coupons, via Reward.redeemedAt), new
 * customers in the last 7 days, and rewards waiting to be redeemed.
 * "Today" is the organization's own day (Organization.timezone).
 */
export async function GET(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    const organization = await db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { timezone: true },
    })
    if (!organization) throw notFound("Organization not found")

    const now = new Date()
    const dayStart = startOfDayInTimeZone(now, organization.timezone)
    const weekStart = new Date(now.getTime() - WEEK_MS)

    const [stampsToday, rewardsRedeemedToday, newContactsWeek, pendingRewards] = await Promise.all([
      db.interaction.count({
        where: orgScope.interaction(ctx, { type: "STAMP", createdAt: { gte: dayStart } }),
      }),
      db.reward.count({
        where: orgScope.reward(ctx, { status: "REDEEMED", redeemedAt: { gte: dayStart } }),
      }),
      db.contact.count({
        where: orgScope.contact(ctx, { deletedAt: null, createdAt: { gte: weekStart } }),
      }),
      db.reward.count({
        where: orgScope.reward(ctx, {
          status: "AVAILABLE",
          expiresAt: { gt: now },
          passTemplate: { passType: "STAMP_CARD" },
        }),
      }),
    ])

    return {
      timezone: organization.timezone,
      dayStart: dayStart.toISOString(),
      stampsToday,
      rewardsRedeemedToday,
      newContactsWeek,
      pendingRewards,
    }
  })
}

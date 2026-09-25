import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight } from "@/lib/api-session"
import { orgScope } from "@/lib/org-scope"
import { toApiReward } from "@/lib/api-serializers"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * Stamp-card rewards waiting to be redeemed, soonest-expiring first, so
 * staff can remind customers at the counter. Coupon passes also carry a
 * Reward row (prize bookkeeping) but are redeemed through
 * POST /passes/{id}/actions, so they're excluded here. Redeem with
 * POST /rewards/{id}/redeem.
 */
export async function GET(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20))

    const where = orgScope.reward(ctx, {
      status: "AVAILABLE",
      expiresAt: { gt: new Date() },
      passTemplate: { passType: "STAMP_CARD" },
    })

    const [rewards, total] = await Promise.all([
      db.reward.findMany({
        where,
        orderBy: { expiresAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contact: { select: { id: true, fullName: true } },
          passTemplate: { select: { id: true, name: true, config: true } },
        },
      }),
      db.reward.count({ where }),
    ])

    return {
      data: rewards.map((r) => {
        const config = (r.passTemplate.config ?? {}) as Record<string, unknown>
        return {
          ...toApiReward(r),
          passInstanceId: r.passInstanceId,
          contact: r.contact,
          program: {
            id: r.passTemplate.id,
            name: r.passTemplate.name,
            rewardDescription: (config.rewardDescription as string | undefined) ?? null,
          },
        }
      }),
      pagination: { page, pageSize, total },
    }
  })
}

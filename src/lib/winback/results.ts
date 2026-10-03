import "server-only"

import { db } from "@/lib/db"
import { computeWinbackResults, WINBACK_RETURN_WINDOW_DAYS, type WinbackResults } from "./results-math"

const DAY_MS = 24 * 60 * 60 * 1000

export const WINBACK_PERIOD_OPTIONS = [30, 90, 365] as const
export type WinbackPeriod = (typeof WINBACK_PERIOD_OPTIONS)[number]
export const WINBACK_PERIOD_DEFAULT: WinbackPeriod = 90

export function parseWinbackPeriod(value: string | undefined): WinbackPeriod {
  const n = Number(value)
  return n === 30 || n === 90 || n === 365 ? n : WINBACK_PERIOD_DEFAULT
}

/**
 * Came-back rates for sends in the period, messaged vs comparison group.
 * Only sends at least 14 days old count toward the rates (their outcome is
 * known); younger ones are reported as "measuring". A visit = a stamp or a
 * coupon redemption on any of the contact's passes.
 */
export async function getWinbackResults(
  organizationId: string,
  periodDays: WinbackPeriod,
  now: Date = new Date(),
): Promise<WinbackResults> {
  const since = new Date(now.getTime() - periodDays * DAY_MS)
  const maturedBefore = new Date(now.getTime() - WINBACK_RETURN_WINDOW_DAYS * DAY_MS)

  const [groups, measuring, unreachable] = await Promise.all([
    db.$queryRaw<{ control: boolean; sent: number; back: number }[]>`
      SELECT w.control,
        COUNT(*)::int AS sent,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM interaction i
          WHERE i."contactId" = w."contactId"
            AND i.type IN ('stamp', 'coupon_redeem')
            AND i."createdAt" > w."sentAt"
            AND i."createdAt" <= w."sentAt" + make_interval(days => ${WINBACK_RETURN_WINDOW_DAYS}::int)
        ))::int AS back
      FROM winback_send w
      WHERE w."organizationId" = ${organizationId}
        AND w.reachable = true
        AND w."sentAt" >= ${since}
        AND w."sentAt" <= ${maturedBefore}
      GROUP BY w.control
    `,
    db.winbackSend.count({
      where: { organizationId, reachable: true, sentAt: { gt: maturedBefore, gte: since } },
    }),
    db.winbackSend.count({ where: { organizationId, reachable: false, sentAt: { gte: since } } }),
  ])

  const pick = (control: boolean) => {
    const row = groups.find((g) => g.control === control)
    return { sent: row?.sent ?? 0, back: row?.back ?? 0 }
  }
  return computeWinbackResults({
    periodDays,
    messaged: pick(false),
    comparison: pick(true),
    measuring,
    unreachable,
  })
}

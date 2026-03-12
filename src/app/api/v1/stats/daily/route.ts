import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { dailyStatsParamsSchema } from "@/lib/api-schemas"
import { queryDailyStats } from "@/lib/api-data"
import { apiSuccess } from "@/lib/api-response"
import { ValidationError, BadRequestError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/stats/daily?from=YYYY-MM-DD&to=YYYY-MM-DD — Daily stats time series
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = dailyStatsParamsSchema.safeParse(params)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { from, to } = parsed.data

  // Validate date range (max 90 days)
  const fromDate = new Date(from)
  const toDate = new Date(to)

  if (fromDate > toDate) {
    throw new BadRequestError("'from' must be before or equal to 'to'.")
  }

  const diffDays = Math.ceil(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays > 90) {
    throw new BadRequestError("Date range cannot exceed 90 days.")
  }

  const rows = await queryDailyStats(ctx.organizationId, from, to)

  return apiSuccess(
    rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      totalContacts: r.totalContacts,
      newContacts: r.newContacts,
      totalInteractions: r.totalInteractions,
      rewardsEarned: r.rewardsEarned,
      rewardsRedeemed: r.rewardsRedeemed,
    }))
  )
})

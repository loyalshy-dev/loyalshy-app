import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { queryOrgStats } from "@/lib/api-data"
import { apiSuccess } from "@/lib/api-response"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/stats — Organization-level aggregate stats
export const GET = apiHandler(async (_req: NextRequest, ctx: ApiContext) => {
  const stats = await queryOrgStats(ctx.organizationId)
  return apiSuccess(stats)
})

import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { queryTemplateStats } from "@/lib/api-data"
import { apiSuccess } from "@/lib/api-response"
import { NotFoundError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/templates/:id/stats — Template-level stats
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const id = req.nextUrl.pathname.split("/").at(-2)!

  const stats = await queryTemplateStats(ctx.organizationId, id)

  if (!stats) {
    throw new NotFoundError(`Template with ID ${id} was not found.`)
  }

  return apiSuccess(stats)
})

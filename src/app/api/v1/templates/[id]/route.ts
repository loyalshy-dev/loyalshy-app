import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { queryTemplateDetail } from "@/lib/api-data"
import { serializeTemplateDetail } from "@/lib/api-serializers"
import { apiSuccess } from "@/lib/api-response"
import { NotFoundError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/templates/:id — Get template detail
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const id = req.nextUrl.pathname.split("/").pop()!
  const result = await queryTemplateDetail(ctx.organizationId, id)

  if (!result) {
    throw new NotFoundError(`Template with ID ${id} was not found.`)
  }

  return apiSuccess(serializeTemplateDetail(result.template, result.stats))
})

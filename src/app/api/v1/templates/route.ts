import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { templateListParamsSchema } from "@/lib/api-schemas"
import { queryTemplates } from "@/lib/api-data"
import { serializeTemplate } from "@/lib/api-serializers"
import { apiPaginated } from "@/lib/api-response"
import { ValidationError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/templates — List templates
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = templateListParamsSchema.safeParse(params)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { page, per_page, status, pass_type } = parsed.data
  const result = await queryTemplates(ctx.organizationId, {
    page,
    perPage: per_page,
    status,
    passType: pass_type,
  })

  return apiPaginated(result.templates.map(serializeTemplate), {
    page,
    perPage: per_page,
    total: result.total,
    pageCount: result.pageCount,
  })
})

import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { interactionListParamsSchema } from "@/lib/api-schemas"
import { queryInteractions } from "@/lib/api-data"
import { serializeInteraction } from "@/lib/api-serializers"
import { apiPaginated } from "@/lib/api-response"
import { ValidationError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/interactions — List all interactions (cross-pass)
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = interactionListParamsSchema.safeParse(params)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { page, per_page, type, contact_id, template_id, since, until } =
    parsed.data
  const result = await queryInteractions(ctx.organizationId, {
    page,
    perPage: per_page,
    type,
    contactId: contact_id,
    templateId: template_id,
    since,
    until,
  })

  return apiPaginated(result.interactions.map(serializeInteraction), {
    page,
    perPage: per_page,
    total: result.total,
    pageCount: result.pageCount,
  })
})

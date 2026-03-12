import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { passListParamsSchema, issuePassBodySchema } from "@/lib/api-schemas"
import { queryPassInstances, issuePass, queryPassInstanceDetail } from "@/lib/api-data"
import { serializePassInstance, serializePassInstanceDetail } from "@/lib/api-serializers"
import { apiPaginated, apiCreated } from "@/lib/api-response"
import { ValidationError, ConflictError, UnprocessableError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/passes — List pass instances
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = passListParamsSchema.safeParse(params)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { page, per_page, contact_id, template_id, status, pass_type } = parsed.data
  const result = await queryPassInstances(ctx.organizationId, {
    page,
    perPage: per_page,
    contactId: contact_id,
    templateId: template_id,
    status,
    passType: pass_type,
  })

  return apiPaginated(result.instances.map(serializePassInstance), {
    page,
    perPage: per_page,
    total: result.total,
    pageCount: result.pageCount,
  })
})

// POST /api/v1/passes — Issue a pass
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const body = await req.json()
  const parsed = issuePassBodySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const result = await issuePass(
    ctx.organizationId,
    parsed.data.templateId,
    parsed.data.contactId
  )

  if (!result.success) {
    if (result.error.includes("already issued")) {
      throw new ConflictError(result.error)
    }
    throw new UnprocessableError(result.error)
  }

  // Fetch the created pass instance for response
  const detail = await queryPassInstanceDetail(ctx.organizationId, result.passInstanceId)
  if (!detail) throw new Error("Created pass instance not found")

  const serialized = serializePassInstanceDetail(detail)

  import("@/lib/api-events").then(({ dispatchWebhookEvent }) =>
    dispatchWebhookEvent(ctx.organizationId, "pass.issued", { pass: serialized })
  ).catch(() => {})

  return apiCreated(serialized)
})

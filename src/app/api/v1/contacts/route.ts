import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { contactListParamsSchema, createContactBodySchema } from "@/lib/api-schemas"
import { queryContacts, createContact } from "@/lib/api-data"
import { serializeContact } from "@/lib/api-serializers"
import { apiPaginated, apiCreated } from "@/lib/api-response"
import { ValidationError, ConflictError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/contacts — List contacts (paginated)
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = contactListParamsSchema.safeParse(params)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { page, per_page, search, sort, order, pass_type } = parsed.data
  const result = await queryContacts(ctx.organizationId, {
    page,
    perPage: per_page,
    search,
    sort,
    order,
    passType: pass_type,
  })

  return apiPaginated(result.contacts.map(serializeContact), {
    page,
    perPage: per_page,
    total: result.total,
    pageCount: result.pageCount,
  })
})

// POST /api/v1/contacts — Create contact
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const body = await req.json()
  const parsed = createContactBodySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  // Check plan contact limit
  const { checkContactLimit } = await import("@/server/billing-actions")
  const limitCheck = await checkContactLimit(ctx.organizationId)
  if (!limitCheck.allowed) {
    throw new ConflictError(
      `Contact limit (${limitCheck.limit}) reached for your plan. Upgrade to add more.`
    )
  }

  const result = await createContact(ctx.organizationId, parsed.data)

  if (!result.success) {
    throw new ConflictError(result.error)
  }

  // Fetch the created contact for response
  const { queryContactDetail } = await import("@/lib/api-data")
  const contact = await queryContactDetail(ctx.organizationId, result.contactId)
  if (!contact) {
    throw new Error("Created contact not found")
  }

  const serialized = serializeContact({
    ...contact,
    _count: { passInstances: contact.passInstances.length },
  })

  // Fire-and-forget webhook
  import("@/lib/api-events").then(({ dispatchWebhookEvent }) =>
    dispatchWebhookEvent(ctx.organizationId, "contact.created", { contact: serialized })
  ).catch(() => {})

  return apiCreated(serialized)
})

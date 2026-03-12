import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { bulkCreateContactsBodySchema } from "@/lib/api-schemas"
import { bulkCreateContacts } from "@/lib/api-data"
import { apiCreated } from "@/lib/api-response"
import { ValidationError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// POST /api/v1/contacts/bulk — Bulk import contacts (max 200, or 100 with issueTemplateId)
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const body = await req.json()
  const parsed = bulkCreateContactsBodySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { contacts, issueTemplateId } = parsed.data

  // Enforce lower limit when also issuing passes
  if (issueTemplateId && contacts.length > 100) {
    throw new ValidationError([
      {
        field: "contacts",
        message:
          "Maximum 100 contacts when issueTemplateId is provided.",
      },
    ])
  }

  const result = await bulkCreateContacts(
    ctx.organizationId,
    contacts,
    issueTemplateId
  )

  return apiCreated(result)
})

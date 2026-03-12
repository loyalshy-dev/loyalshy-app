import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { bulkIssuePassesBodySchema } from "@/lib/api-schemas"
import { bulkIssuePasses } from "@/lib/api-data"
import { apiCreated } from "@/lib/api-response"
import { ValidationError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// POST /api/v1/passes/bulk — Bulk issue passes (max 100 contacts)
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const body = await req.json()
  const parsed = bulkIssuePassesBodySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { templateId, contactIds } = parsed.data
  const result = await bulkIssuePasses(ctx.organizationId, templateId, contactIds)

  return apiCreated(result)
})

import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { queryPassInstanceDetail } from "@/lib/api-data"
import { serializePassInstanceDetail } from "@/lib/api-serializers"
import { apiSuccess } from "@/lib/api-response"
import { NotFoundError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/passes/:id — Get pass instance detail
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const segments = req.nextUrl.pathname.split("/")
  const id = segments[segments.length - 1]!

  const instance = await queryPassInstanceDetail(ctx.organizationId, id)

  if (!instance) {
    throw new NotFoundError(`Pass instance with ID ${id} was not found.`)
  }

  return apiSuccess(serializePassInstanceDetail(instance))
})

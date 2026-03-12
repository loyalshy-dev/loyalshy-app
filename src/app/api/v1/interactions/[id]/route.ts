import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { queryInteractionDetail } from "@/lib/api-data"
import { serializeInteraction } from "@/lib/api-serializers"
import { apiSuccess } from "@/lib/api-response"
import { NotFoundError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/interactions/:id — Get interaction detail
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const id = req.nextUrl.pathname.split("/").pop()!
  const interaction = await queryInteractionDetail(ctx.organizationId, id)

  if (!interaction) {
    throw new NotFoundError(`Interaction with ID ${id} was not found.`)
  }

  return apiSuccess(serializeInteraction(interaction))
})

import { type NextRequest } from "next/server"
import { randomBytes } from "crypto"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { apiSuccess } from "@/lib/api-response"
import { NotFoundError } from "@/lib/api-errors"
import { db } from "@/lib/db"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// POST /api/v1/webhooks/:id/rotate-secret — Rotate signing secret
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const segments = req.nextUrl.pathname.split("/")
  // /api/v1/webhooks/[id]/rotate-secret → id is at index -2
  const id = segments[segments.length - 2]!

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true },
  })

  if (!endpoint) {
    throw new NotFoundError(`Webhook endpoint with ID ${id} was not found.`)
  }

  const newSecret = randomBytes(32).toString("hex")

  await db.webhookEndpoint.update({
    where: { id },
    data: { secret: newSecret, failureCount: 0 },
  })

  return apiSuccess({ secret: newSecret })
})

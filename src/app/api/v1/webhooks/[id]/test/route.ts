import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { apiSuccess } from "@/lib/api-response"
import { NotFoundError } from "@/lib/api-errors"
import { db } from "@/lib/db"
import { dispatchWebhookEvent } from "@/lib/api-events"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// POST /api/v1/webhooks/:id/test — Send test ping event
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const segments = req.nextUrl.pathname.split("/")
  // /api/v1/webhooks/[id]/test → id is at index -2
  const id = segments[segments.length - 2]!

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true, events: true },
  })

  if (!endpoint) {
    throw new NotFoundError(`Webhook endpoint with ID ${id} was not found.`)
  }

  // Temporarily add test.ping to the endpoint's events if not present
  const hasTestEvent = endpoint.events.includes("test.ping")
  if (!hasTestEvent) {
    await db.webhookEndpoint.update({
      where: { id },
      data: { events: { push: "test.ping" } },
    })
  }

  await dispatchWebhookEvent(ctx.organizationId, "test.ping", {
    message: "This is a test webhook event from Loyalshy.",
    timestamp: new Date().toISOString(),
  })

  // Remove test.ping if we temporarily added it
  if (!hasTestEvent) {
    await db.webhookEndpoint.update({
      where: { id },
      data: { events: endpoint.events },
    })
  }

  return apiSuccess({ sent: true })
})

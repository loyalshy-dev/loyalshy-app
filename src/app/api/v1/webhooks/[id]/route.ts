import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { updateWebhookBodySchema } from "@/lib/api-schemas"
import { apiSuccess, apiNoContent } from "@/lib/api-response"
import { ValidationError, NotFoundError } from "@/lib/api-errors"
import { db } from "@/lib/db"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

async function findEndpoint(organizationId: string, id: string) {
  return db.webhookEndpoint.findFirst({
    where: { id, organizationId },
  })
}

// GET /api/v1/webhooks/:id — Get endpoint detail with recent deliveries
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const id = req.nextUrl.pathname.split("/").pop()!

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          eventType: true,
          statusCode: true,
          attempts: true,
          deliveredAt: true,
          createdAt: true,
        },
      },
    },
  })

  if (!endpoint) {
    throw new NotFoundError(`Webhook endpoint with ID ${id} was not found.`)
  }

  return apiSuccess({
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events,
    enabled: endpoint.enabled,
    failureCount: endpoint.failureCount,
    lastDeliveryAt: endpoint.lastDeliveryAt?.toISOString() ?? null,
    createdAt: endpoint.createdAt.toISOString(),
    recentDeliveries: endpoint.deliveries.map((d) => ({
      id: d.id,
      eventType: d.eventType,
      statusCode: d.statusCode,
      attempts: d.attempts,
      deliveredAt: d.deliveredAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  })
})

// PATCH /api/v1/webhooks/:id — Update endpoint
export const PATCH = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const id = req.nextUrl.pathname.split("/").pop()!

  const existing = await findEndpoint(ctx.organizationId, id)
  if (!existing) {
    throw new NotFoundError(`Webhook endpoint with ID ${id} was not found.`)
  }

  const body = await req.json()
  const parsed = updateWebhookBodySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.url !== undefined) updateData.url = parsed.data.url
  if (parsed.data.events !== undefined) updateData.events = parsed.data.events
  if (parsed.data.enabled !== undefined) {
    updateData.enabled = parsed.data.enabled
    // Re-enabling resets failure count
    if (parsed.data.enabled && !existing.enabled) {
      updateData.failureCount = 0
    }
  }

  const updated = await db.webhookEndpoint.update({
    where: { id, organizationId: ctx.organizationId },
    data: updateData,
    select: {
      id: true,
      url: true,
      events: true,
      enabled: true,
      failureCount: true,
      lastDeliveryAt: true,
      createdAt: true,
    },
  })

  return apiSuccess({
    id: updated.id,
    url: updated.url,
    events: updated.events,
    enabled: updated.enabled,
    failureCount: updated.failureCount,
    lastDeliveryAt: updated.lastDeliveryAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  })
})

// DELETE /api/v1/webhooks/:id — Delete endpoint and all deliveries
export const DELETE = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const id = req.nextUrl.pathname.split("/").pop()!

  const existing = await findEndpoint(ctx.organizationId, id)
  if (!existing) {
    throw new NotFoundError(`Webhook endpoint with ID ${id} was not found.`)
  }

  await db.webhookEndpoint.delete({ where: { id, organizationId: ctx.organizationId } })

  return apiNoContent()
})

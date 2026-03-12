import { type NextRequest } from "next/server"
import { randomBytes } from "crypto"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { createWebhookBodySchema } from "@/lib/api-schemas"
import { apiSuccess, apiCreated } from "@/lib/api-response"
import { ValidationError, ForbiddenError } from "@/lib/api-errors"
import { db } from "@/lib/db"
import { PLANS } from "@/lib/plans"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const hostname = url.hostname
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return true
    }
    return false
  } catch {
    return true
  }
}

// GET /api/v1/webhooks — List webhook endpoints
export const GET = apiHandler(async (_req: NextRequest, ctx: ApiContext) => {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
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

  return apiSuccess(
    endpoints.map((e) => ({
      id: e.id,
      url: e.url,
      events: e.events,
      enabled: e.enabled,
      failureCount: e.failureCount,
      lastDeliveryAt: e.lastDeliveryAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    }))
  )
})

// POST /api/v1/webhooks — Register webhook endpoint
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const body = await req.json()
  const parsed = createWebhookBodySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { url, events, enabled } = parsed.data

  // Reject private IPs
  if (isPrivateUrl(url)) {
    throw new ValidationError([
      { field: "url", message: "URL must not point to a private or local address." },
    ])
  }

  // Check plan limit
  const plan = PLANS[ctx.organization.plan as keyof typeof PLANS]
  const currentCount = await db.webhookEndpoint.count({
    where: { organizationId: ctx.organizationId },
  })
  if (currentCount >= plan.webhookEndpointLimit) {
    throw new ForbiddenError(
      `Your ${plan.name} plan allows a maximum of ${plan.webhookEndpointLimit} webhook endpoints.`
    )
  }

  const secret = randomBytes(32).toString("hex")

  const endpoint = await db.webhookEndpoint.create({
    data: {
      organizationId: ctx.organizationId,
      url,
      events,
      enabled,
      secret,
    },
    select: {
      id: true,
      url: true,
      events: true,
      enabled: true,
      createdAt: true,
    },
  })

  return apiCreated({
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events,
    enabled: endpoint.enabled,
    secret, // Returned ONCE at creation
    createdAt: endpoint.createdAt.toISOString(),
  })
})

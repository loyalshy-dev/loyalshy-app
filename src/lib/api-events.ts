import "server-only"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

export const API_WEBHOOK_VERSION = "2026-03-01"

const WEBHOOK_EVENT_TYPES = [
  "contact.created",
  "contact.updated",
  "contact.deleted",
  "pass.issued",
  "pass.completed",
  "pass.suspended",
  "pass.revoked",
  "pass.expired",
  "pass.voided",
  "interaction.created",
  "reward.earned",
  "reward.redeemed",
  "reward.expired",
  "test.ping",
] as const

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]

/**
 * Dispatch a webhook event to all subscribed endpoints for an organization.
 * Non-blocking — queues delivery via Trigger.dev. Silently skips if
 * Trigger.dev is unavailable or no endpoints are configured.
 */
export async function dispatchWebhookEvent(
  organizationId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Find all enabled endpoints subscribed to this event type
    const endpoints = await db.webhookEndpoint.findMany({
      where: {
        organizationId,
        enabled: true,
        events: { has: eventType },
      },
      select: { id: true, url: true, secret: true },
    })

    if (endpoints.length === 0) return

    const eventId = `evt_${randomUUID().replace(/-/g, "")}`
    const payload = {
      id: eventId,
      api_version: API_WEBHOOK_VERSION,
      type: eventType,
      created_at: new Date().toISOString(),
      organization_id: organizationId,
      data,
    }

    // Try to dispatch via Trigger.dev
    let triggerAvailable = false
    try {
      const { tasks } = await import("@trigger.dev/sdk/v3")
      const { deliverWebhookTask } = await import(
        "@/trigger/deliver-webhook"
      )
      triggerAvailable = true

      for (const endpoint of endpoints) {
        // Create delivery record
        const delivery = await db.webhookDelivery.create({
          data: {
            webhookEndpointId: endpoint.id,
            eventType,
            payload: payload as unknown as Prisma.JsonObject,
          },
          select: { id: true },
        })

        await tasks.trigger(deliverWebhookTask.id, {
          webhookDeliveryId: delivery.id,
          webhookEndpointId: endpoint.id,
          url: endpoint.url,
          secret: endpoint.secret,
          eventType,
          payload,
        })
      }
    } catch {
      // Trigger.dev not available — skip silently
      if (!triggerAvailable) return

      // If Trigger.dev init succeeded but individual triggers failed,
      // delivery records are already created with pending status
    }
  } catch {
    // Silently ignore all errors — webhooks are best-effort
  }
}

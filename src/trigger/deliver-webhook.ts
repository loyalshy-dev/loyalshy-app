import { task } from "@trigger.dev/sdk"
import { createHmac } from "crypto"
import { webhooksQueue } from "./queues"
import { createDb } from "./db"

type DeliverWebhookPayload = {
  webhookDeliveryId: string
  webhookEndpointId: string
  url: string
  secret: string
  eventType: string
  payload: Record<string, unknown>
}

export const deliverWebhookTask = task({
  id: "deliver-webhook",
  queue: webhooksQueue,
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 300_000,
  },
  run: async (input: DeliverWebhookPayload) => {
    const db = createDb()
    try {
      const body = JSON.stringify(input.payload)
      const timestamp = Math.floor(Date.now() / 1000)
      const signatureInput = `${timestamp}.${body}`
      const signature = createHmac("sha256", input.secret)
        .update(signatureInput)
        .digest("hex")

      const response = await fetch(input.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Loyalshy-Signature": `t=${timestamp},v1=${signature}`,
          "X-Loyalshy-Event": input.eventType,
          "X-Loyalshy-Delivery-Id": input.webhookDeliveryId,
        },
        body,
        signal: AbortSignal.timeout(30_000),
      })

      const responseBody = await response.text().catch(() => "")
      const truncatedBody = responseBody.slice(0, 1024)

      await db.webhookDelivery.update({
        where: { id: input.webhookDeliveryId },
        data: {
          statusCode: response.status,
          responseBody: truncatedBody,
          attempts: { increment: 1 },
          deliveredAt: new Date(),
        },
      })

      if (response.ok) {
        // Success — reset failure count and update lastDeliveryAt
        await db.webhookEndpoint.update({
          where: { id: input.webhookEndpointId },
          data: { failureCount: 0, lastDeliveryAt: new Date() },
        })
      } else {
        // HTTP error — increment failure count
        const endpoint = await db.webhookEndpoint.update({
          where: { id: input.webhookEndpointId },
          data: {
            failureCount: { increment: 1 },
            lastDeliveryAt: new Date(),
          },
          select: { failureCount: true },
        })

        // Auto-disable after 10 consecutive failures
        if (endpoint.failureCount >= 10) {
          await db.webhookEndpoint.update({
            where: { id: input.webhookEndpointId },
            data: { enabled: false },
          })
        }

        throw new Error(
          `Webhook delivery failed: HTTP ${response.status}`
        )
      }
    } catch (error) {
      // Network/timeout errors
      if (
        error instanceof Error &&
        !error.message.startsWith("Webhook delivery failed")
      ) {
        await db.webhookDelivery
          .update({
            where: { id: input.webhookDeliveryId },
            data: {
              attempts: { increment: 1 },
              responseBody: (error as Error).message.slice(0, 1024),
            },
          })
          .catch(() => {})

        const endpoint = await db.webhookEndpoint
          .update({
            where: { id: input.webhookEndpointId },
            data: {
              failureCount: { increment: 1 },
              lastDeliveryAt: new Date(),
            },
            select: { failureCount: true },
          })
          .catch(() => null)

        if (endpoint && endpoint.failureCount >= 10) {
          await db.webhookEndpoint
            .update({
              where: { id: input.webhookEndpointId },
              data: { enabled: false },
            })
            .catch(() => {})
        }
      }
      throw error
    } finally {
      await db.$disconnect()
    }
  },
})

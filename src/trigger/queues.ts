import { queue } from "@trigger.dev/sdk"

// ─── Queues ─────────────────────────────────────────────────
// Trigger.dev v4 requires queues to be defined in code before deployment.

export const walletUpdatesQueue = queue({
  name: "wallet-updates",
  concurrencyLimit: 10,
})

export const notificationsQueue = queue({
  name: "notifications",
  concurrencyLimit: 5,
})

export const analyticsQueue = queue({
  name: "analytics",
  concurrencyLimit: 2,
})

export const billingQueue = queue({
  name: "billing",
  concurrencyLimit: 3,
})

export const emailsQueue = queue({
  name: "emails",
  concurrencyLimit: 5,
})

export const webhooksQueue = queue({
  name: "webhooks",
  concurrencyLimit: 10,
})

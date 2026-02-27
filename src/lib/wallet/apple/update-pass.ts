import "server-only"

import { db } from "@/lib/db"

/**
 * Notifies that a customer's Apple Wallet pass needs updating.
 * Touches customer.updatedAt so Apple's polling detects the change.
 * Full APNs HTTP/2 push is deferred to Phase 3.4 (Trigger.dev background jobs).
 */
export async function notifyApplePassUpdate(customerId: string): Promise<void> {
  // Touch updatedAt so the "list serials updated since" endpoint picks it up
  await db.customer.update({
    where: { id: customerId },
    data: { updatedAt: new Date() },
  })

  // Log the update
  await db.walletPassLog.create({
    data: {
      customerId,
      action: "UPDATED",
      details: { trigger: "data_change" },
    },
  })
}

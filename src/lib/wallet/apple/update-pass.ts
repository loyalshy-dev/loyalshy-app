import "server-only"

import { db } from "@/lib/db"

/**
 * Notifies that a contact's Apple Wallet pass needs updating.
 * Touches passInstance.updatedAt so Apple's polling detects the change.
 * Full APNs HTTP/2 push is deferred to Trigger.dev background jobs.
 */
export async function notifyApplePassUpdate(passInstanceId: string): Promise<void> {
  // Touch updatedAt so the "list serials updated since" endpoint picks it up
  await db.passInstance.update({
    where: { id: passInstanceId },
    data: { updatedAt: new Date() },
  })

  // Log the update
  await db.walletPassLog.create({
    data: {
      passInstanceId,
      action: "UPDATED",
      details: { trigger: "data_change" },
    },
  })
}

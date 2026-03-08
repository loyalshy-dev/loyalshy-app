import "server-only"

import http2 from "node:http2"
import { db } from "@/lib/db"

/**
 * Notifies that a contact's Apple Wallet pass needs updating.
 * Touches passInstance.updatedAt, fetches device registrations,
 * and sends APNs HTTP/2 push so the device fetches the updated pass.
 */
export async function notifyApplePassUpdate(passInstanceId: string): Promise<void> {
  // Touch updatedAt so the "list serials updated since" endpoint picks it up
  const passInstance = await db.passInstance.update({
    where: { id: passInstanceId },
    data: { updatedAt: new Date() },
    select: {
      id: true,
      walletPassSerialNumber: true,
      deviceRegistrations: { select: { pushToken: true } },
    },
  })

  const pushTokens = passInstance.deviceRegistrations.map((d) => d.pushToken)
  let pushResult = { sent: 0, failed: 0 }

  if (pushTokens.length > 0) {
    pushResult = await sendApnsPush(pushTokens)
  }

  // Log the update
  await db.walletPassLog.create({
    data: {
      passInstanceId,
      action: pushTokens.length > 0 ? "PUSH_SENT" : "UPDATED",
      details: {
        trigger: "data_change",
        platform: "apple",
        devicesNotified: pushTokens.length,
        pushSent: pushResult.sent,
        pushFailed: pushResult.failed,
      },
    },
  })
}

/**
 * Sends empty push notifications to Apple Wallet via APNs HTTP/2.
 * Apple Wallet passes use empty pushes — the OS fetches the updated
 * pass from the webServiceURL when it receives the notification.
 */
export async function sendApnsPush(
  pushTokens: string[]
): Promise<{ sent: number; failed: number }> {
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER
  if (!passTypeIdentifier) {
    return { sent: 0, failed: pushTokens.length }
  }

  const certB64 = process.env.APPLE_PASS_CERTIFICATE
  const keyB64 = process.env.APPLE_PASS_KEY
  const keyPassphrase = process.env.APPLE_PASS_KEY_PASSPHRASE ?? ""

  if (!certB64 || !keyB64) {
    return { sent: 0, failed: pushTokens.length }
  }

  const cert = Buffer.from(certB64, "base64")
  const key = Buffer.from(keyB64, "base64")
  const apnsHost = process.env.APNS_HOST ?? "api.push.apple.com"

  let sent = 0
  let failed = 0

  // Create a single HTTP/2 session for all pushes
  const session = http2.connect(`https://${apnsHost}`, {
    cert,
    key,
    passphrase: keyPassphrase,
  })

  try {
    for (const pushToken of pushTokens) {
      try {
        const statusCode = await new Promise<number>((resolve, reject) => {
          const req = session.request({
            ":method": "POST",
            ":path": `/3/device/${pushToken}`,
            "apns-topic": passTypeIdentifier,
            "apns-push-type": "background",
            "apns-priority": "5",
          })

          req.on("response", (headers) => {
            resolve(Number(headers[":status"]) || 0)
          })

          req.on("error", reject)
          req.end("{}")
        })

        if (statusCode === 200) {
          sent++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }
  } finally {
    session.close()
  }

  return { sent, failed }
}

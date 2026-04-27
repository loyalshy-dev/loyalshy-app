import "server-only"

import http2 from "node:http2"
import { db } from "@/lib/db"

/**
 * Notifies that a contact's Apple Wallet pass needs updating.
 * Touches passInstance.updatedAt, fetches device registrations,
 * and sends APNs HTTP/2 push so the device fetches the updated pass.
 *
 * `dedupeKey`, when provided (e.g. a Trigger.dev run id), is used as the
 * WalletPassLog primary key so a task retry collapses to one log row.
 */
export async function notifyApplePassUpdate(
  passInstanceId: string,
  dedupeKey?: string,
): Promise<void> {
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

  await createWalletPassLog({
    passInstanceId,
    action: pushTokens.length > 0 ? "PUSH_SENT" : "UPDATED",
    platform: "apple",
    trigger: "data_change",
    dedupeKey,
    extra: {
      devicesNotified: pushTokens.length,
      pushSent: pushResult.sent,
      pushFailed: pushResult.failed,
    },
  })
}

/**
 * Inserts a WalletPassLog row, deduping retries when a `dedupeKey` is supplied
 * by deriving the primary key from it. The second insert hits a PK collision
 * (P2002) which we swallow.
 */
export async function createWalletPassLog(args: {
  passInstanceId: string
  action: "PUSH_SENT" | "UPDATED"
  platform: "apple" | "google"
  trigger: string
  dedupeKey?: string
  extra?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.walletPassLog.create({
      data: {
        ...(args.dedupeKey ? { id: `wpl_${args.dedupeKey}_${args.action}` } : {}),
        passInstanceId: args.passInstanceId,
        action: args.action,
        details: {
          trigger: args.trigger,
          platform: args.platform,
          ...(args.extra ?? {}),
        },
      },
    })
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return // duplicate from a retry — exactly what dedupeKey is for
    }
    throw err
  }
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
        const { status: statusCode, body: responseBody } = await new Promise<{ status: number; body: string }>((resolve, reject) => {
          const req = session.request({
            ":method": "POST",
            ":path": `/3/device/${pushToken}`,
            "apns-topic": passTypeIdentifier,
            "apns-push-type": "background",
            "apns-priority": "5",
          })

          let body = ""
          req.on("response", (headers) => {
            const s = Number(headers[":status"]) || 0
            req.on("data", (chunk: Buffer) => { body += chunk.toString() })
            req.on("end", () => resolve({ status: s, body }))
          })

          req.on("error", reject)
          req.end("{}")
        })

        if (statusCode === 200) {
          sent++
        } else {
          console.error(`APNs push failed for token ${pushToken.slice(0, 8)}...: status=${statusCode} body=${responseBody}`)
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

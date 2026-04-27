import http2 from "node:http2"
import { task, AbortTaskRunError } from "@trigger.dev/sdk"
import { walletUpdatesQueue } from "./queues"
import { createDb } from "./db"

// ─── Types ──────────────────────────────────────────────────

type UpdateWalletPassPayload = {
  passInstanceId: string
  updateType: "STAMP" | "VISIT" | "REWARD_EARNED" | "REWARD_REDEEMED" | "REWARD_EXPIRED" | "DESIGN_CHANGE" | "TEMPLATE_CHANGE" | "PASS_INSTANCE_SUSPENDED"
}

// ─── Task ───────────────────────────────────────────────────

export const updateWalletPassTask = task({
  id: "update-wallet-pass",
  queue: walletUpdatesQueue,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: UpdateWalletPassPayload, { ctx }) => {
    const db = createDb()
    // Stable across retries of the same trigger — used to dedupe the
    // WalletPassLog row so a retry doesn't double-log.
    const dedupeKey = ctx.run.id

    try {
      const passInstance = await db.passInstance.findUnique({
        where: { id: payload.passInstanceId },
        select: {
          id: true,
          data: true,
          issuedAt: true,
          updatedAt: true,
          walletPassId: true,
          walletPassSerialNumber: true,
          walletProvider: true,
          status: true,
          contact: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          passTemplate: {
            select: {
              id: true,
              name: true,
              passType: true,
              config: true,
              termsAndConditions: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  brandColor: true,
                  secondaryColor: true,
                  logo: true,
                  logoApple: true,
                  logoGoogle: true,
                  phone: true,
                  website: true,
                },
              },
              passDesign: true,
            },
          },
          rewards: {
            where: { status: { in: ["AVAILABLE", "REDEEMED"] } },
            select: { id: true, status: true, revealedAt: true, description: true },
          },
          deviceRegistrations: {
            select: { pushToken: true },
          },
        },
      })

      if (!passInstance) {
        throw new AbortTaskRunError(`PassInstance ${payload.passInstanceId} not found`)
      }

      if (passInstance.walletProvider === "NONE") {
        return { skipped: true, reason: "no_wallet_pass" }
      }

      if (passInstance.walletProvider === "APPLE" && passInstance.walletPassSerialNumber) {
        // ── Apple Wallet: Touch updatedAt + send APNs push ──
        // NOTE: This intentionally inlines the same updatedAt + APNs flow as
        // notifyApplePassUpdate() in src/lib/wallet/apple/update-pass.ts —
        // both must update updatedAt so Apple's "list serials updated since"
        // endpoint picks the pass up. Don't add a call to the helper here
        // without removing this block, or you'll touch updatedAt twice.
        await db.passInstance.update({
          where: { id: passInstance.id },
          data: { updatedAt: new Date() },
        })

        // Send APNs push to all registered devices
        const pushTokens = passInstance.deviceRegistrations.map(
          (d: { pushToken: string }) => d.pushToken
        )
        let pushResult = { sent: 0, failed: 0, errors: [] as string[] }

        if (pushTokens.length > 0) {
          pushResult = await sendApnsPush(pushTokens)
        }

        // Dedupe the log on retry by deriving the PK from the run id.
        const action = pushTokens.length > 0 ? "PUSH_SENT" : "UPDATED"
        try {
          await db.walletPassLog.create({
            data: {
              id: `wpl_${dedupeKey}_${action}`,
              passInstanceId: passInstance.id,
              action,
              details: {
                trigger: payload.updateType,
                platform: "apple",
                devicesNotified: pushTokens.length,
                pushSent: pushResult.sent,
                pushFailed: pushResult.failed,
                ...(pushResult.errors.length > 0 && { apnsErrors: pushResult.errors }),
              },
            },
          })
        } catch (err) {
          if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
            throw err
          }
          // P2002 = retry of the same run; the original log row is already there.
        }

        return {
          platform: "apple",
          devicesNotified: pushTokens.length,
          pushSent: pushResult.sent,
          pushFailed: pushResult.failed,
          ...(pushResult.errors.length > 0 && { apnsErrors: pushResult.errors }),
        }
      } else if (passInstance.walletProvider === "GOOGLE") {
        // ── Google Wallet: Use the full update function that respects card design fields ──
        const { notifyGooglePassUpdate } = await import("@/lib/wallet/google/update-pass")
        await notifyGooglePassUpdate(passInstance.id, dedupeKey)

        return { platform: "google", status: 200 }
      }

      return { skipped: true, reason: "unknown_wallet_type" }
    } finally {
      await db.$disconnect()
    }
  },
})

// ─── APNs Push ──────────────────────────────────────────────

/**
 * Sends empty push notifications to Apple Wallet via APNs HTTP/2.
 * Apple Wallet passes use empty pushes — the OS fetches the updated
 * pass from the webServiceURL when it receives the notification.
 */
async function sendApnsPush(
  pushTokens: string[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER
  if (!passTypeIdentifier) {
    return { sent: 0, failed: pushTokens.length, errors: ["APPLE_PASS_TYPE_IDENTIFIER not set"] }
  }

  const certB64 = process.env.APPLE_PASS_CERTIFICATE
  const keyB64 = process.env.APPLE_PASS_KEY
  const keyPassphrase = process.env.APPLE_PASS_KEY_PASSPHRASE ?? ""

  if (!certB64 || !keyB64) {
    return { sent: 0, failed: pushTokens.length, errors: ["APPLE_PASS_CERTIFICATE or APPLE_PASS_KEY not set"] }
  }

  const cert = Buffer.from(certB64, "base64")
  const key = Buffer.from(keyB64, "base64")
  const apnsHost = process.env.APNS_HOST ?? "api.push.apple.com"

  let sent = 0
  let failed = 0
  const errors: string[] = []

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
          const errorMsg = `status=${statusCode} body=${responseBody}`
          console.error(`APNs push failed for token ${pushToken.slice(0, 8)}...: ${errorMsg}`)
          errors.push(errorMsg)
          failed++
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`APNs push error for token ${pushToken.slice(0, 8)}...: ${errorMsg}`)
        errors.push(errorMsg)
        failed++
      }
    }
  } finally {
    session.close()
  }

  return { sent, failed, errors }
}

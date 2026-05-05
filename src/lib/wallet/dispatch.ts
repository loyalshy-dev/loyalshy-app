import { after } from "next/server"

/**
 * Wallet pass update dispatch shared by every staff action that mutates
 * pass state. Scheduled via `after()` so the HTTP response returns
 * immediately while the push fires in the background — Vercel keeps the
 * Lambda alive until the registered work completes.
 *
 * Primary path is a direct call into `notifyApplePassUpdate` /
 * `notifyGooglePassUpdate` — no Trigger.dev queue / worker boot in front
 * of APNs, which shaves ~1-2s off perceived latency on the device.
 *
 * If the direct call throws, falls back to Trigger.dev for retry +
 * observability. Without Trigger.dev (e.g. local dev) the failure is
 * just logged.
 */
export function dispatchWalletUpdate(
  passInstanceId: string,
  walletProvider: string,
  updateType: "STAMP" | "COUPON_REDEEM" | "REWARD_REDEEMED",
) {
  if (walletProvider === "NONE") return

  after(async () => {
    try {
      if (walletProvider === "APPLE") {
        const { notifyApplePassUpdate } = await import("@/lib/wallet/apple/update-pass")
        await notifyApplePassUpdate(passInstanceId)
      } else if (walletProvider === "GOOGLE") {
        const { notifyGooglePassUpdate } = await import("@/lib/wallet/google/update-pass")
        await notifyGooglePassUpdate(passInstanceId)
      }
    } catch (err) {
      console.error(
        "[wallet-dispatch] direct push failed, falling back to Trigger.dev:",
        err instanceof Error ? err.message : err,
      )
      if (!process.env.TRIGGER_SECRET_KEY) return
      try {
        const { tasks } = await import("@trigger.dev/sdk")
        await tasks.trigger("update-wallet-pass", { passInstanceId, updateType })
      } catch (triggerErr) {
        console.error(
          "[wallet-dispatch] trigger.dev fallback also failed:",
          triggerErr instanceof Error ? triggerErr.message : triggerErr,
        )
      }
    }
  })
}

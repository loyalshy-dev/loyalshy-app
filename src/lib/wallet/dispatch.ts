import { after } from "next/server"

/**
 * Update types accepted by the dispatch helper. Mirrors the Trigger.dev
 * task's payload union (see `src/trigger/update-wallet-pass.ts`) plus
 * `COUPON_REDEEM` which is dashboard-specific. Used as fire-and-forget
 * metadata — no provider-specific behavior depends on it.
 */
export type WalletUpdateType =
  | "STAMP"
  | "VISIT"
  | "COUPON_REDEEM"
  | "REWARD_EARNED"
  | "REWARD_REDEEMED"
  | "REWARD_EXPIRED"
  | "DESIGN_CHANGE"
  | "TEMPLATE_CHANGE"
  | "PASS_INSTANCE_SUSPENDED"

/**
 * Wallet pass update dispatch shared by every staff/admin action that
 * mutates pass state. Scheduled via `after()` so the HTTP response
 * returns immediately while the push fires in the background — Vercel
 * keeps the Lambda alive until the registered work completes (works
 * the same in Server Actions and Route Handlers).
 *
 * Primary path is a direct call into `notifyApplePassUpdate` /
 * `notifyGooglePassUpdate` — no Trigger.dev queue / worker boot in
 * front of APNs, which shaves ~1-2s off perceived latency on the
 * device.
 *
 * If the direct call throws, falls back to Trigger.dev for retry +
 * observability. Without Trigger.dev (e.g. local dev) the failure is
 * just logged.
 */
export function dispatchWalletUpdate(
  passInstanceId: string,
  walletProvider: string,
  updateType: WalletUpdateType,
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

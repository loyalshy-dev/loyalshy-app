/**
 * Fire-and-forget wallet pass update dispatch shared by every staff
 * action that mutates pass state.
 *
 * Trigger.dev path is preferred when configured (resilient retries,
 * idempotency keyed via the Trigger run id). Without Trigger we fall
 * back to direct provider calls — fine for local dev, not idempotent
 * across crashes.
 */
export function dispatchWalletUpdate(
  passInstanceId: string,
  walletProvider: string,
  updateType: "STAMP" | "COUPON_REDEEM" | "REWARD_REDEEMED",
) {
  if (walletProvider === "NONE") return

  if (process.env.TRIGGER_SECRET_KEY) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-wallet-pass", { passInstanceId, updateType }),
      )
      .catch((err: unknown) =>
        console.error(
          "[wallet-dispatch] trigger.dev failed:",
          err instanceof Error ? err.message : err,
        ),
      )
    return
  }

  if (walletProvider === "GOOGLE") {
    import("@/lib/wallet/google/update-pass")
      .then(({ notifyGooglePassUpdate }) => notifyGooglePassUpdate(passInstanceId))
      .catch((err: unknown) =>
        console.error(
          "[wallet-dispatch] Google update failed:",
          err instanceof Error ? err.message : err,
        ),
      )
    return
  }

  if (walletProvider === "APPLE") {
    import("@/lib/wallet/apple/update-pass")
      .then(({ notifyApplePassUpdate }) => notifyApplePassUpdate(passInstanceId))
      .catch((err: unknown) =>
        console.error(
          "[wallet-dispatch] Apple update failed:",
          err instanceof Error ? err.message : err,
        ),
      )
  }
}

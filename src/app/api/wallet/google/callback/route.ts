import { NextResponse } from "next/server"

/**
 * POST /api/wallet/google/callback
 *
 * Callback endpoint for Google Wallet status updates.
 * Google Wallet can send notifications when a pass is saved or deleted.
 *
 * For now, we log the callback payload. Full processing
 * will be implemented in Phase 3.4 (Trigger.dev background jobs).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    console.log(
      "[Google Wallet Callback]",
      JSON.stringify(body, null, 2)
    )

    // TODO Phase 3.4: Process callback events
    // - Pass saved: update customer.walletPassType to GOOGLE
    // - Pass deleted: clear customer wallet fields

    return NextResponse.json({ status: "ok" })
  } catch {
    return NextResponse.json({ status: "ok" })
  }
}

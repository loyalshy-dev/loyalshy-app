import { NextResponse } from "next/server"
import { isAuthorizedInternalRequest } from "@/lib/internal-auth"
import { snapshotAllPlaceRatings } from "@/lib/reviews/snapshots"

/**
 * GET /api/cron/google-ratings — daily Vercel cron (vercel.json). Snapshots
 * each tracked org's Google rating + review count. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await snapshotAllPlaceRatings()
  if (result.failed > 0) {
    console.error(`[google-ratings] ${result.failed}/${result.orgs} snapshots failed`)
  }
  return NextResponse.json(result)
}

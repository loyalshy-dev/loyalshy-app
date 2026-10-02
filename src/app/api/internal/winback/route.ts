import { NextResponse } from "next/server"
import { isAuthorizedInternalRequest } from "@/lib/internal-auth"
import { runWinback } from "@/lib/winback/engine"

/**
 * POST /api/internal/winback — called hourly by the Trigger.dev schedule
 * `winback-hourly` (src/trigger/winback-hourly.ts). Each org is handled in
 * the hour it is 10:00 locally. Returns a per-org summary.
 */
export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const results = await runWinback()
    return NextResponse.json({ orgs: results.length, results })
  } catch (err) {
    console.error("[winback] run failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Run failed" }, { status: 500 })
  }
}

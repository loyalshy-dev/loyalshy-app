import { NextResponse } from "next/server"
import { runHealthChecks } from "@/lib/health"

/**
 * Dependency health check for external uptime monitoring.
 * Returns 200 when every critical dependency responds, 503 otherwise —
 * point UptimeRobot / Better Stack at this URL. The checks themselves live
 * in src/lib/health.ts, shared with the public /status page.
 */
export async function GET(): Promise<NextResponse> {
  const report = await runHealthChecks()
  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  })
}

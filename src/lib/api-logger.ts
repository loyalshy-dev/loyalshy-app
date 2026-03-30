import "server-only"

import { type NextRequest, type NextResponse } from "next/server"
import { type ApiContext } from "@/lib/api-auth"
import { db } from "@/lib/db"

/**
 * Log an API request. Fire-and-forget — never blocks or fails the response.
 * Writes immediately to avoid data loss in serverless environments.
 */
export function logApiRequest(
  ctx: ApiContext,
  req: NextRequest,
  response: NextResponse,
  latencyMs: number
): void {
  // Fire-and-forget: don't await, don't block the response
  db.apiRequestLog
    .create({
      data: {
        organizationId: ctx.organizationId,
        apiKeyId: ctx.apiKeyId ?? "session",
        requestId: ctx.requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        statusCode: response.status,
        latencyMs: Math.round(latencyMs),
        userAgent: req.headers.get("user-agent"),
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    })
    .catch(() => {
      // Logging should never fail the API — silently drop on error
    })
}

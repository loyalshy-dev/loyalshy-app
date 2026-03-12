import "server-only"

import { type NextRequest, type NextResponse } from "next/server"
import { type ApiContext } from "@/lib/api-auth"
import { db } from "@/lib/db"

type LogEntry = {
  organizationId: string
  apiKeyId: string
  requestId: string
  method: string
  path: string
  statusCode: number
  latencyMs: number
  userAgent: string | null
  ipAddress: string | null
}

const LOG_BATCH: LogEntry[] = []
const BATCH_SIZE = 50
const FLUSH_INTERVAL_MS = 1_000

let flushTimer: ReturnType<typeof setInterval> | null = null

function startFlushTimer() {
  if (flushTimer) return
  flushTimer = setInterval(flushBatch, FLUSH_INTERVAL_MS)
  // Unref so it doesn't keep the process alive
  if (typeof flushTimer === "object" && "unref" in flushTimer) {
    flushTimer.unref()
  }
}

async function flushBatch() {
  if (LOG_BATCH.length === 0) return

  const entries = LOG_BATCH.splice(0, LOG_BATCH.length)

  try {
    await db.apiRequestLog.createMany({ data: entries })
  } catch {
    // Logging should never fail the API — silently drop on error
  }
}

/**
 * Log an API request. Fire-and-forget — never blocks or fails the response.
 * Accumulates entries and flushes in batches for efficiency.
 */
export function logApiRequest(
  ctx: ApiContext,
  req: NextRequest,
  response: NextResponse,
  latencyMs: number
): void {
  LOG_BATCH.push({
    organizationId: ctx.organizationId,
    apiKeyId: ctx.apiKeyId,
    requestId: ctx.requestId,
    method: req.method,
    path: req.nextUrl.pathname,
    statusCode: response.status,
    latencyMs: Math.round(latencyMs),
    userAgent: req.headers.get("user-agent"),
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  })

  if (LOG_BATCH.length >= BATCH_SIZE) {
    flushBatch()
  } else {
    startFlushTimer()
  }
}

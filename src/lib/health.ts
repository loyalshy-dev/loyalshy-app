import { db } from "@/lib/db"

// ─── Dependency health checks ───────────────────────────────
// Shared by /api/health (external uptime monitors) and the public
// /status page. Redis is checked even though the rate limiter fails open
// without it: silent degradation to per-instance limits is exactly what
// these checks exist to surface.

export type CheckStatus = "ok" | "down" | "unconfigured"
export type Check = { status: CheckStatus; latencyMs?: number; error?: string }
export type HealthReport = {
  status: "ok" | "degraded"
  checks: { database: Check; redis: Check }
  timestamp: string
}

const CHECK_TIMEOUT_MS = 5_000

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${CHECK_TIMEOUT_MS}ms`)), CHECK_TIMEOUT_MS)
    ),
  ])
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Surface the network-level cause (e.g. getaddrinfo ENOTFOUND) over the generic "fetch failed"
    const cause = (err as Error & { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    return err.message
  }
  return String(err)
}

async function checkDatabase(): Promise<Check> {
  const start = Date.now()
  try {
    await withTimeout(db.$queryRaw`SELECT 1`)
    return { status: "ok", latencyMs: Date.now() - start }
  } catch (err) {
    return { status: "down", latencyMs: Date.now() - start, error: errorMessage(err) }
  }
}

async function checkRedis(): Promise<Check> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { status: "unconfigured" }

  const start = Date.now()
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    })
    if (!res.ok) {
      return { status: "down", latencyMs: Date.now() - start, error: `HTTP ${res.status}` }
    }
    return { status: "ok", latencyMs: Date.now() - start }
  } catch (err) {
    return { status: "down", latencyMs: Date.now() - start, error: errorMessage(err) }
  }
}

export async function runHealthChecks(): Promise<HealthReport> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()])
  const checks = { database, redis }
  const healthy = Object.values(checks).every((c) => c.status === "ok")
  return {
    status: healthy ? "ok" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  }
}

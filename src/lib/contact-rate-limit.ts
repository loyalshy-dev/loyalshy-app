import "server-only"

// ─── Contact-style rate limiting ─────────────────────────────
// Three submissions per IP per hour, Upstash sliding window with an
// in-memory per-instance fallback. Shared by the contact form and the
// counter-material request form. Fails open (fallback) when Redis is
// unreachable, with a Sentry capture — see the 2026-08-18 Upstash incident.

type Limiter = { limit: (key: string) => Promise<{ success: boolean }> }

const MAX_PER_HOUR = 3
const WINDOW_MS = 3_600_000

let _limiter: Limiter | null = null
let _upstashChecked = false

async function getRateLimiter(): Promise<Limiter | null> {
  if (_limiter) return _limiter
  if (_upstashChecked) return null

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    _upstashChecked = true
    return null
  }

  try {
    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")
    const redis = new Redis({ url, token })
    _limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(MAX_PER_HOUR, "1 h"),
      prefix: "contact:rl",
    })
    _upstashChecked = true
    return _limiter
  } catch {
    // Don't set _upstashChecked — retry on next invocation in case of transient failure
    return null
  }
}

const memoryStore = new Map<string, { count: number; resetAt: number }>()

function checkMemoryLimit(key: string): boolean {
  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= MAX_PER_HOUR) return false
  entry.count++
  return true
}

/** True when `scope:ip` is under the limit. `scope` separates the forms' budgets. */
export async function checkContactRateLimit(scope: string, ip: string): Promise<boolean> {
  const key = `${scope}:${ip}`
  const limiter = await getRateLimiter()
  if (limiter) {
    try {
      return (await limiter.limit(key)).success
    } catch (err) {
      // Redis unreachable — degrade to the in-memory fallback below
      console.error(`[${scope}] Upstash rate-limit check failed, using in-memory fallback:`, err)
      const Sentry = await import("@sentry/nextjs")
      Sentry.captureException(err, { tags: { component: `${scope}-rate-limit` } })
    }
  }
  return checkMemoryLimit(key)
}

/** The caller's IP for rate limiting, from the proxy headers. */
export function clientIpFromHeaders(hdrs: Headers): string {
  return hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown"
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

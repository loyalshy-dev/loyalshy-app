/**
 * Distributed rate limiter for the staff-app auth endpoints.
 * Backed by Upstash Redis when configured (sliding window across all
 * Vercel instances). Falls back to a per-instance in-memory map for
 * local dev — fine on a single node, never relied on in production.
 *
 * Replaces the previous per-Lambda `publicFormLimiter` (Map-based) which
 * effectively gave attackers `N × limit` requests across warm instances.
 */

type RateLimitResult = { success: boolean }

type Limiter = {
  limit: (key: string) => Promise<RateLimitResult>
}

type LimiterOptions = {
  /** Max requests per window */
  limit: number
  /** Sliding window duration as @upstash/ratelimit Duration string */
  window: `${number} ${"s" | "m" | "h"}`
  /** Redis key prefix */
  prefix: string
}

const limiterCache = new Map<string, Limiter | null>()

async function getLimiter(opts: LimiterOptions): Promise<Limiter | null> {
  const cacheKey = `${opts.prefix}:${opts.limit}:${opts.window}`
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey) ?? null

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    limiterCache.set(cacheKey, null)
    return null
  }

  try {
    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")
    const redis = new Redis({ url, token })
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(opts.limit, opts.window),
      prefix: opts.prefix,
    })
    limiterCache.set(cacheKey, limiter)
    return limiter
  } catch {
    // Transient — don't cache failure
    return null
  }
}

// ─── In-memory fallback (per-instance) ────────────────────────────

type MemoryEntry = { timestamps: number[] }
const memoryStores = new Map<string, Map<string, MemoryEntry>>()

function checkMemoryFallback(
  prefix: string,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  let store = memoryStores.get(prefix)
  if (!store) {
    store = new Map()
    memoryStores.set(prefix, store)
  }
  const now = Date.now()
  const entry = store.get(key) ?? { timestamps: [] }
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)
  if (entry.timestamps.length >= limit) {
    store.set(key, entry)
    return false
  }
  entry.timestamps.push(now)
  store.set(key, entry)
  return true
}

function windowToMs(window: LimiterOptions["window"]): number {
  const [count, unit] = window.split(" ") as [string, "s" | "m" | "h"]
  const n = Number(count)
  if (unit === "s") return n * 1_000
  if (unit === "m") return n * 60_000
  return n * 3_600_000
}

async function check(
  opts: LimiterOptions,
  key: string,
): Promise<RateLimitResult> {
  const limiter = await getLimiter(opts)
  if (limiter) return limiter.limit(key)
  const ok = checkMemoryFallback(
    opts.prefix,
    key,
    opts.limit,
    windowToMs(opts.window),
  )
  return { success: ok }
}

// ─── Pre-configured policies ──────────────────────────────────────

/**
 * Email/password signin. 10 attempts per minute per (email+ip),
 * plus a slower 30-per-hour cap per email so a botnet rotating IPs
 * against one mailbox is still throttled.
 */
export async function checkEmailSigninLimit(
  email: string,
  ip: string,
): Promise<RateLimitResult> {
  const normalized = email.trim().toLowerCase()
  const fast = await check(
    { prefix: "rl:auth:email-signin", limit: 10, window: "1 m" },
    `${normalized}|${ip}`,
  )
  if (!fast.success) return fast
  const slow = await check(
    { prefix: "rl:auth:email-signin-slow", limit: 30, window: "1 h" },
    normalized,
  )
  return slow
}

/** Google ID token exchange — 10/min per ip. */
export async function checkGoogleMobileLimit(
  ip: string,
): Promise<RateLimitResult> {
  return check(
    { prefix: "rl:auth:google-mobile", limit: 10, window: "1 m" },
    ip,
  )
}

/** QR pairing claim — 20/min per ip (UX is "scan and retry quickly"). */
export async function checkDevicePairClaimLimit(
  ip: string,
): Promise<RateLimitResult> {
  return check(
    { prefix: "rl:auth:device-pair-claim", limit: 20, window: "1 m" },
    ip,
  )
}

/** Invite token validation (GET) — 30/min per ip. */
export async function checkInviteValidateLimit(
  ip: string,
): Promise<RateLimitResult> {
  return check(
    { prefix: "rl:auth:invite-validate", limit: 30, window: "1 m" },
    ip,
  )
}

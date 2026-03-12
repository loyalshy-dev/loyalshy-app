import "server-only"

import { type ApiContext } from "@/lib/api-auth"
import { PLANS, type PlanId } from "@/lib/plans"
import { RateLimitError } from "@/lib/api-errors"

export type RateLimitResult = {
  limit: number
  remaining: number
  reset: number // Unix timestamp (seconds)
}

// Lazy-init Upstash rate limiters (avoid build-time crashes)
let _minuteLimiter: InstanceType<
  typeof import("@upstash/ratelimit").Ratelimit
> | null = null
let _dailyLimiter: InstanceType<
  typeof import("@upstash/ratelimit").Ratelimit
> | null = null
let _upstashAvailable: boolean | null = null

async function getUpstashLimiters() {
  if (_upstashAvailable === false) return null
  if (_minuteLimiter && _dailyLimiter) return { minute: _minuteLimiter, daily: _dailyLimiter }

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    _upstashAvailable = false
    return null
  }

  const { Ratelimit } = await import("@upstash/ratelimit")
  const { Redis } = await import("@upstash/redis")
  const redis = new Redis({ url, token })

  _minuteLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, "1 m"), // placeholder, overridden per-request
    prefix: "api:rl:min",
  })

  _dailyLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, "1 d"),
    prefix: "api:rl:day",
  })

  _upstashAvailable = true
  return { minute: _minuteLimiter, daily: _dailyLimiter }
}

// In-memory fallback for local dev (no Upstash)
const memoryStore = new Map<string, { count: number; resetAt: number }>()

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { limit, remaining: limit - 1, reset: Math.ceil((now + windowMs) / 1000) }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)
  return { limit, remaining, reset: Math.ceil(entry.resetAt / 1000) }
}

/**
 * Check rate limits for an API request. Throws RateLimitError if exceeded.
 * Uses Upstash Redis in production, in-memory fallback in dev.
 */
export async function checkApiRateLimit(
  ctx: ApiContext
): Promise<RateLimitResult> {
  const planDef = PLANS[ctx.organization.plan as PlanId]
  if (!planDef?.apiAccess) {
    throw new RateLimitError(0)
  }

  const minuteLimit = planDef.apiRateLimit
  const dailyLimit = planDef.apiDailyLimit
  const orgId = ctx.organizationId

  const limiters = await getUpstashLimiters()

  if (limiters) {
    // Use Upstash Redis
    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })

    // Per-minute check
    const minuteRl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(minuteLimit, "1 m"),
      prefix: "api:rl:min",
    })
    const minuteResult = await minuteRl.limit(orgId)

    if (!minuteResult.success) {
      const retryAfter = Math.ceil(
        (minuteResult.reset - Date.now()) / 1000
      )
      throw new RateLimitError(Math.max(1, retryAfter))
    }

    // Per-day check (skip if unlimited)
    if (Number.isFinite(dailyLimit)) {
      const dailyRl = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(dailyLimit, "1 d"),
        prefix: "api:rl:day",
      })
      const dailyResult = await dailyRl.limit(orgId)

      if (!dailyResult.success) {
        const retryAfter = Math.ceil(
          (dailyResult.reset - Date.now()) / 1000
        )
        throw new RateLimitError(Math.max(1, retryAfter))
      }
    }

    return {
      limit: minuteLimit,
      remaining: minuteResult.remaining,
      reset: Math.ceil(minuteResult.reset / 1000),
    }
  }

  // In-memory fallback (local dev)
  const minuteResult = checkMemoryRateLimit(
    `min:${orgId}`,
    minuteLimit,
    60_000
  )

  if (minuteResult.remaining < 0) {
    throw new RateLimitError(
      Math.max(1, minuteResult.reset - Math.ceil(Date.now() / 1000))
    )
  }

  if (Number.isFinite(dailyLimit)) {
    const dailyResult = checkMemoryRateLimit(
      `day:${orgId}`,
      dailyLimit,
      86_400_000
    )
    if (dailyResult.remaining < 0) {
      throw new RateLimitError(
        Math.max(1, dailyResult.reset - Math.ceil(Date.now() / 1000))
      )
    }
  }

  return minuteResult
}

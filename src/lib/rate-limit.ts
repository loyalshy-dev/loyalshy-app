/**
 * Simple in-memory sliding window rate limiter.
 * Each Vercel serverless instance gets its own Map,
 * providing per-instance protection.
 */

type RateLimitEntry = {
  timestamps: number[]
}

type RateLimitOptions = {
  /** Time window in milliseconds */
  interval: number
  /** Max requests per window */
  limit: number
}

type RateLimitResult = {
  success: boolean
  remaining: number
}

export function rateLimit({ interval, limit }: RateLimitOptions) {
  const store = new Map<string, RateLimitEntry>()

  // Auto-cleanup stale entries every 60s
  const cleanup = () => {
    const now = Date.now()
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < interval)
      if (entry.timestamps.length === 0) {
        store.delete(key)
      }
    }
  }

  let lastCleanup = Date.now()

  return {
    check(key: string): RateLimitResult {
      const now = Date.now()

      // Run cleanup periodically (every 60s)
      if (now - lastCleanup > 60_000) {
        cleanup()
        lastCleanup = now
      }

      const entry = store.get(key) ?? { timestamps: [] }

      // Remove expired timestamps
      entry.timestamps = entry.timestamps.filter((t) => now - t < interval)

      if (entry.timestamps.length >= limit) {
        return { success: false, remaining: 0 }
      }

      entry.timestamps.push(now)
      store.set(key, entry)

      return { success: true, remaining: limit - entry.timestamps.length }
    },
  }
}

// ─── Pre-configured limiters ─────────────────────────────────

/** 10 requests per minute — for public form submissions */
export const publicFormLimiter = rateLimit({ interval: 60_000, limit: 10 })

/** 3 joins per hour per IP — prevents bulk pass creation abuse */
export const joinPassLimiter = rateLimit({ interval: 3_600_000, limit: 3 })

/** 20 requests per minute — for authenticated API routes */
export const apiRouteLimiter = rateLimit({ interval: 60_000, limit: 20 })

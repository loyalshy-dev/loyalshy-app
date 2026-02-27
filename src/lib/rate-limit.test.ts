import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { rateLimit } from "./rate-limit"

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows requests under the limit", () => {
    const limiter = rateLimit({ interval: 60_000, limit: 3 })
    const result = limiter.check("user-1")
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it("counts remaining correctly", () => {
    const limiter = rateLimit({ interval: 60_000, limit: 3 })
    expect(limiter.check("user-1").remaining).toBe(2)
    expect(limiter.check("user-1").remaining).toBe(1)
    expect(limiter.check("user-1").remaining).toBe(0)
  })

  it("blocks requests at the limit", () => {
    const limiter = rateLimit({ interval: 60_000, limit: 2 })
    limiter.check("user-1") // 1
    limiter.check("user-1") // 2
    const result = limiter.check("user-1") // 3 — blocked
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("resets after the interval expires", () => {
    const limiter = rateLimit({ interval: 60_000, limit: 2 })
    limiter.check("user-1")
    limiter.check("user-1")
    expect(limiter.check("user-1").success).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(60_001)
    const result = limiter.check("user-1")
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it("tracks different keys independently", () => {
    const limiter = rateLimit({ interval: 60_000, limit: 1 })
    expect(limiter.check("user-1").success).toBe(true)
    expect(limiter.check("user-1").success).toBe(false)
    expect(limiter.check("user-2").success).toBe(true)
  })

  it("uses sliding window — partial expiry", () => {
    const limiter = rateLimit({ interval: 10_000, limit: 3 })

    // Request at t=0
    limiter.check("user-1")
    // Request at t=5s
    vi.advanceTimersByTime(5_000)
    limiter.check("user-1")
    // Request at t=8s
    vi.advanceTimersByTime(3_000)
    limiter.check("user-1")

    // At t=8s, all 3 used → blocked
    expect(limiter.check("user-1").success).toBe(false)

    // At t=10.001s, first request expires → 1 slot opens
    vi.advanceTimersByTime(2_001)
    const result = limiter.check("user-1")
    expect(result.success).toBe(true)
  })

  it("limit of 1 allows exactly one request per window", () => {
    const limiter = rateLimit({ interval: 1_000, limit: 1 })
    expect(limiter.check("k").success).toBe(true)
    expect(limiter.check("k").success).toBe(false)
    vi.advanceTimersByTime(1_001)
    expect(limiter.check("k").success).toBe(true)
  })
})

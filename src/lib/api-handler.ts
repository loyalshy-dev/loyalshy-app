import "server-only"

import { type NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, type ApiContext } from "@/lib/api-auth"
import { checkApiRateLimit, type RateLimitResult } from "@/lib/api-rate-limit"
import {
  ApiError,
  InternalError,
  RateLimitError,
  UnsupportedMediaTypeError,
} from "@/lib/api-errors"
import { apiError } from "@/lib/api-response"
import { withCorsHeaders } from "@/lib/api-cors"
import { logApiRequest } from "@/lib/api-logger"

// ─── Idempotency (Upstash Redis) ───────────────────────────

type CachedResponse = {
  status: number
  body: string
}

let _redis: InstanceType<typeof import("@upstash/redis").Redis> | null = null
let _redisChecked = false

async function getRedis() {
  if (_redisChecked) return _redis
  _redisChecked = true

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const { Redis } = await import("@upstash/redis")
  _redis = new Redis({ url, token })
  return _redis
}

async function getIdempotentResponse(
  orgId: string,
  idempotencyKey: string
): Promise<NextResponse | null> {
  const redis = await getRedis()
  if (!redis) return null

  const cached = await redis.get<CachedResponse>(
    `idempotency:${orgId}:${idempotencyKey}`
  )
  if (!cached) return null

  return new NextResponse(cached.body, {
    status: cached.status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

async function storeIdempotentResponse(
  orgId: string,
  idempotencyKey: string,
  response: NextResponse
): Promise<void> {
  const redis = await getRedis()
  if (!redis) return

  const body = await response.clone().text()
  await redis
    .set(
      `idempotency:${orgId}:${idempotencyKey}`,
      { status: response.status, body } satisfies CachedResponse,
      { ex: 86_400 } // 24h TTL
    )
    .catch(() => {}) // fire-and-forget
}

// ─── Response Headers ──────────────────────────────────────

function withApiHeaders(
  response: NextResponse,
  requestId: string,
  rateLimit?: RateLimitResult,
  idempotencyKey?: string
): NextResponse {
  response.headers.set("X-Request-Id", requestId)
  response.headers.set("Content-Type", "application/json; charset=utf-8")

  if (rateLimit) {
    response.headers.set("X-RateLimit-Limit", String(rateLimit.limit))
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining))
    response.headers.set("X-RateLimit-Reset", String(rateLimit.reset))
  }

  if (idempotencyKey) {
    response.headers.set("Idempotency-Key", idempotencyKey)
  }

  return response
}

// ─── Inject requestId into JSON response meta ─────────────

async function injectRequestId(
  response: NextResponse,
  requestId: string
): Promise<NextResponse> {
  // Only process JSON responses with 2xx status
  if (response.status < 200 || response.status >= 300) return response
  const ct = response.headers.get("content-type") ?? ""
  if (!ct.includes("json")) return response

  try {
    const body = await response.clone().json()
    if (body && typeof body === "object" && "meta" in body) {
      body.meta = { requestId, ...body.meta }
      return NextResponse.json(body, { status: response.status })
    }
  } catch {
    // Not parseable JSON — return as-is
  }
  return response
}

// ─── Composable Route Handler ──────────────────────────────

/**
 * Wraps an API route handler with authentication, rate limiting,
 * CORS, content-type validation, idempotency, and error handling.
 */
export function apiHandler(
  handler: (req: NextRequest, ctx: ApiContext) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    let requestId = `req_fallback_${Date.now()}`
    const startTime = performance.now()

    try {
      // Content-Type validation for POST/PATCH
      if (req.method === "POST" || req.method === "PATCH") {
        const ct = req.headers.get("content-type") ?? ""
        if (!ct.startsWith("application/json")) {
          throw new UnsupportedMediaTypeError()
        }
      }

      // Authenticate
      const ctx = await authenticateApiRequest(req)
      requestId = ctx.requestId

      // Rate limit
      const rateLimit = await checkApiRateLimit(ctx)

      // Idempotency check for POST/PATCH
      const idempotencyKey =
        req.method === "POST" || req.method === "PATCH"
          ? req.headers.get("idempotency-key")?.slice(0, 255) ?? null
          : null

      if (idempotencyKey) {
        const cached = await getIdempotentResponse(
          ctx.organizationId,
          idempotencyKey
        )
        if (cached) {
          return withCorsHeaders(
            withApiHeaders(cached, requestId, rateLimit, idempotencyKey)
          )
        }
      }

      // Execute handler
      const response = await handler(req, ctx)

      // Inject requestId into the response body meta
      const enrichedResponse = await injectRequestId(response, requestId)

      // Store idempotent response
      if (idempotencyKey) {
        await storeIdempotentResponse(
          ctx.organizationId,
          idempotencyKey,
          enrichedResponse
        )
      }

      const finalResponse = withCorsHeaders(
        withApiHeaders(enrichedResponse, requestId, rateLimit, idempotencyKey ?? undefined)
      )

      // Log request (fire-and-forget)
      logApiRequest(ctx, req, finalResponse, performance.now() - startTime)

      return finalResponse
    } catch (error) {
      if (error instanceof ApiError) {
        const errResponse = apiError(error, req.nextUrl.pathname)

        // Add Retry-After for rate limit errors
        if (error instanceof RateLimitError) {
          errResponse.headers.set("Retry-After", String(error.retryAfter))
        }

        return withCorsHeaders(withApiHeaders(errResponse, requestId))
      }

      // Unexpected error — report to Sentry if available
      try {
        const { captureException } = await import("@sentry/nextjs")
        captureException(error)
      } catch {
        // Sentry not available
      }

      const errResponse = apiError(
        new InternalError(),
        req.nextUrl.pathname
      )
      return withCorsHeaders(withApiHeaders(errResponse, requestId))
    }
  }
}

import { NextResponse } from "next/server"

/**
 * Allowed origins for the staff-app API surface. Native fetches don't
 * honor CORS, so the mobile app is unaffected — this whitelist exists to
 * stop arbitrary browser pages and extensions from probing the auth
 * endpoints. Add an origin via NEXT_PUBLIC_STAFF_APP_ORIGINS as a
 * comma-separated list when expanding to staging or a new dev origin.
 */
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    "https://www.loyalshy.com",
    "https://loyalshy.com",
    "loyalshystaff://",
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    ...(process.env.NEXT_PUBLIC_STAFF_APP_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []),
  ].filter((s): s is string => !!s),
)

const STATIC_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id",
  "Access-Control-Expose-Headers": "X-Request-Id",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
}

function resolveAllowOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null
  if (ALLOWED_ORIGINS.has(requestOrigin)) return requestOrigin
  return null
}

/** Handle OPTIONS preflight requests */
export function handlePreflight(req?: Request): NextResponse {
  const origin = resolveAllowOrigin(req?.headers.get("origin") ?? null)
  const headers: Record<string, string> = { ...STATIC_HEADERS }
  if (origin) headers["Access-Control-Allow-Origin"] = origin
  return new NextResponse(null, { status: 204, headers })
}

/** Attach CORS headers to any response */
export function withCorsHeaders(
  response: NextResponse,
  req?: Request,
): NextResponse {
  const origin = resolveAllowOrigin(req?.headers.get("origin") ?? null)
  for (const [key, value] of Object.entries(STATIC_HEADERS)) {
    response.headers.set(key, value)
  }
  if (origin) response.headers.set("Access-Control-Allow-Origin", origin)
  return response
}

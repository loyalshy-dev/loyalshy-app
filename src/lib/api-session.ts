import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { withCorsHeaders, handlePreflight } from "@/lib/api-cors"

export type SessionContext = {
  userId: string
  organizationId: string
  role: string
  requestId: string
}

export type Pagination = {
  page: number
  pageSize: number
  total: number
  /** Keyset continuation for feeds that support it; null = no more rows. */
  nextCursor?: string | null
}

export type HandlerResult<T> = T | { data: T; pagination: Pagination }

type Handler<T> = (ctx: SessionContext, req: NextRequest) => Promise<HandlerResult<T>>

type ApiEnvelope<T> = {
  data: T
  meta: {
    requestId: string
    pagination?: Pagination
  }
}

function isPaginated<T>(r: HandlerResult<T>): r is { data: T; pagination: Pagination } {
  return r != null && typeof r === "object" && "pagination" in r && "data" in r
}

/**
 * Minimal session-auth wrapper for /api/v1 staff-app endpoints.
 * Replaces the deleted apiHandler() — no API key auth, no rate limiting,
 * no idempotency, no webhooks, no request logging. Just session token →
 * active organization → handler.
 *
 * Usage:
 *   export async function GET(req: NextRequest) {
 *     return sessionHandler(req, async (ctx) => {
 *       const contacts = await db.contact.findMany({ where: { organizationId: ctx.organizationId } })
 *       return contacts.map(toApiContact)
 *     })
 *   }
 */
/**
 * Bearer token → session → active org membership. Returns the context, or
 * the 401/403 response to send. Shared by sessionHandler (JSON envelope)
 * and sessionRawHandler (binary responses such as card strip PNGs).
 */
async function authenticate(
  req: NextRequest,
  requestId: string,
): Promise<{ ctx: SessionContext } | { response: NextResponse }> {
  const deny = (status: 401 | 403, title: string, detail: string) => ({
    response: withCorsHeaders(
      NextResponse.json({ type: "about:blank", status, title, detail }, { status }),
    ),
  })

  const auth = req.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    return deny(401, "Unauthorized", "Missing Authorization header")
  }
  const token = auth.slice(7)

  const session = await db.session.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      activeOrganizationId: true,
      user: { select: { id: true } },
    },
  })

  if (!session || session.expiresAt < new Date()) {
    return deny(401, "Unauthorized", "Invalid or expired session")
  }

  if (!session.activeOrganizationId) {
    return deny(403, "Forbidden", "No active organization selected")
  }

  const member = await db.member.findFirst({
    where: { userId: session.user.id, organizationId: session.activeOrganizationId },
    select: { role: true },
  })

  if (!member) {
    return deny(403, "Forbidden", "Not a member of this organization")
  }

  return {
    ctx: {
      userId: session.user.id,
      organizationId: session.activeOrganizationId,
      role: member.role,
      requestId,
    },
  }
}

export async function sessionHandler<T>(
  req: NextRequest,
  handler: Handler<T>,
): Promise<NextResponse> {
  const requestId = randomUUID()
  try {
    const authResult = await authenticate(req, requestId)
    if ("response" in authResult) return authResult.response
    const ctx = authResult.ctx

    const result = await handler(ctx, req)

    const envelope: ApiEnvelope<T> = isPaginated(result)
      ? { data: result.data, meta: { requestId, pagination: result.pagination } }
      : { data: result, meta: { requestId } }

    return withCorsHeaders(NextResponse.json(envelope))
  } catch (err) {
    if (err instanceof ApiError) {
      return withCorsHeaders(
        NextResponse.json(
          { type: "about:blank", status: err.status, title: err.title, detail: err.detail, ...err.extra, requestId },
          { status: err.status },
        ),
      )
    }
    console.error(`[api/v1] [${requestId}]`, err instanceof Error ? err.message : err)
    return withCorsHeaders(
      NextResponse.json(
        { type: "about:blank", status: 500, title: "Internal Server Error", detail: "Unexpected error", requestId },
        { status: 500 },
      ),
    )
  }
}

/**
 * Like sessionHandler, but the handler returns its own Response (images and
 * other non-JSON bodies). Errors still come back as RFC 7807 JSON.
 */
export async function sessionRawHandler(
  req: NextRequest,
  handler: (ctx: SessionContext, req: NextRequest) => Promise<Response>,
): Promise<Response> {
  const requestId = randomUUID()
  try {
    const authResult = await authenticate(req, requestId)
    if ("response" in authResult) return authResult.response
    return await handler(authResult.ctx, req)
  } catch (err) {
    if (err instanceof ApiError) {
      return withCorsHeaders(
        NextResponse.json(
          { type: "about:blank", status: err.status, title: err.title, detail: err.detail, ...err.extra, requestId },
          { status: err.status },
        ),
      )
    }
    console.error(`[api/v1] [${requestId}]`, err instanceof Error ? err.message : err)
    return withCorsHeaders(
      NextResponse.json(
        { type: "about:blank", status: 500, title: "Internal Server Error", detail: "Unexpected error", requestId },
        { status: 500 },
      ),
    )
  }
}

export type SessionContextNoOrg = {
  sessionId: string
  userId: string
  activeOrganizationId: string | null
  requestId: string
}

type HandlerNoOrg<T> = (ctx: SessionContextNoOrg, req: NextRequest) => Promise<HandlerResult<T>>

/**
 * Variant of {@link sessionHandler} that does NOT require an active
 * organization. For routes that bootstrap the session (e.g. /auth/me,
 * /auth/select-org) which run *before* the user has chosen an org.
 *
 * Same RFC 7807 error shape and `{ data, meta }` envelope as
 * sessionHandler so clients only deal with one response contract.
 */
export async function sessionHandlerNoOrg<T>(
  req: NextRequest,
  handler: HandlerNoOrg<T>,
): Promise<NextResponse> {
  const requestId = randomUUID()
  try {
    const auth = req.headers.get("authorization")
    if (!auth || !auth.startsWith("Bearer ")) {
      return withCorsHeaders(
        NextResponse.json(
          { type: "about:blank", status: 401, title: "Unauthorized", detail: "Missing Authorization header" },
          { status: 401 },
        ),
      )
    }
    const token = auth.slice(7)

    const session = await db.session.findUnique({
      where: { token },
      select: {
        id: true,
        expiresAt: true,
        activeOrganizationId: true,
        user: { select: { id: true } },
      },
    })

    if (!session || session.expiresAt < new Date()) {
      return withCorsHeaders(
        NextResponse.json(
          { type: "about:blank", status: 401, title: "Unauthorized", detail: "Invalid or expired session" },
          { status: 401 },
        ),
      )
    }

    const ctx: SessionContextNoOrg = {
      sessionId: session.id,
      userId: session.user.id,
      activeOrganizationId: session.activeOrganizationId,
      requestId,
    }

    const result = await handler(ctx, req)
    const envelope: ApiEnvelope<T> = isPaginated(result)
      ? { data: result.data, meta: { requestId, pagination: result.pagination } }
      : { data: result, meta: { requestId } }
    return withCorsHeaders(NextResponse.json(envelope))
  } catch (err) {
    if (err instanceof ApiError) {
      return withCorsHeaders(
        NextResponse.json(
          { type: "about:blank", status: err.status, title: err.title, detail: err.detail, ...err.extra, requestId },
          { status: err.status },
        ),
      )
    }
    console.error(`[api/v1/auth] [${requestId}]`, err instanceof Error ? err.message : err)
    return withCorsHeaders(
      NextResponse.json(
        { type: "about:blank", status: 500, title: "Internal Server Error", detail: "Unexpected error", requestId },
        { status: 500 },
      ),
    )
  }
}

/** Throwable error inside session handlers — sent as RFC 7807 problem JSON */
export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    /** Extra machine-readable members merged into the problem body (e.g. `code`). */
    public extra?: Record<string, unknown>,
  ) {
    super(detail)
  }
}

const ROLE_RANK: Record<string, number> = { member: 1, admin: 2, owner: 3 }

/**
 * Org-role gate for staff-app routes, same hierarchy as the DAL's
 * assertOrganizationRole (owner > admin > member) but throwing a 403
 * ApiError instead of redirecting.
 */
export function requireRole(ctx: SessionContext, minRole: "admin" | "owner"): void {
  if ((ROLE_RANK[ctx.role] ?? 0) < ROLE_RANK[minRole]) {
    throw forbidden(`Requires the ${minRole} role`)
  }
}

/** Convenience factories */
export const notFound = (detail = "Resource not found") => new ApiError(404, "Not Found", detail)
export const badRequest = (detail: string) => new ApiError(400, "Bad Request", detail)
export const forbidden = (detail = "Forbidden") => new ApiError(403, "Forbidden", detail)

/**
 * Build a standalone RFC 7807 problem-details JSON response. For the auth
 * routes that don't use sessionHandler/sessionHandlerNoOrg (because they
 * run before a session exists or have a custom flow), so error shapes
 * stay uniform with the rest of /api/v1.
 */
export function problemJson(
  status: number,
  title: string,
  detail: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { type: "about:blank", status, title, detail, ...(extra ?? {}) },
    { status },
  )
}

export { handlePreflight }

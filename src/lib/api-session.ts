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

export type Pagination = { page: number; pageSize: number; total: number }

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
export async function sessionHandler<T>(
  req: NextRequest,
  handler: Handler<T>,
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

    if (!session.activeOrganizationId) {
      return withCorsHeaders(
        NextResponse.json(
          { type: "about:blank", status: 403, title: "Forbidden", detail: "No active organization selected" },
          { status: 403 },
        ),
      )
    }

    const member = await db.member.findFirst({
      where: { userId: session.user.id, organizationId: session.activeOrganizationId },
      select: { role: true },
    })

    if (!member) {
      return withCorsHeaders(
        NextResponse.json(
          { type: "about:blank", status: 403, title: "Forbidden", detail: "Not a member of this organization" },
          { status: 403 },
        ),
      )
    }

    const ctx: SessionContext = {
      userId: session.user.id,
      organizationId: session.activeOrganizationId,
      role: member.role,
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
          { type: "about:blank", status: err.status, title: err.title, detail: err.detail, requestId },
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

/** Throwable error inside session handlers — sent as RFC 7807 problem JSON */
export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
  ) {
    super(detail)
  }
}

/** Convenience factories */
export const notFound = (detail = "Resource not found") => new ApiError(404, "Not Found", detail)
export const badRequest = (detail: string) => new ApiError(400, "Bad Request", detail)
export const forbidden = (detail = "Forbidden") => new ApiError(403, "Forbidden", detail)

export { handlePreflight }

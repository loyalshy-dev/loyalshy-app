import { NextResponse } from "next/server"
import { ApiError } from "@/lib/api-errors"

export type PaginationMeta = {
  page: number
  perPage: number
  total: number
  pageCount: number
}

/** 200 OK with data */
export function apiSuccess(
  data: unknown,
  meta?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { data, meta: { ...meta } },
    { status: 200 }
  )
}

/** 201 Created with data */
export function apiCreated(data: unknown): NextResponse {
  return NextResponse.json({ data, meta: {} }, { status: 201 })
}

/** 204 No Content */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/** 200 OK with paginated list */
export function apiPaginated(
  data: unknown[],
  pagination: PaginationMeta
): NextResponse {
  return NextResponse.json(
    { data, meta: { pagination } },
    { status: 200 }
  )
}

/** Error response — maps ApiError to RFC 7807 JSON */
export function apiError(error: ApiError, requestPath?: string): NextResponse {
  return NextResponse.json(error.toJSON(requestPath), { status: error.status })
}

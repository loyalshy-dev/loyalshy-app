import "server-only"

import crypto from "node:crypto"
import { type NextRequest } from "next/server"
import { validateApiKey } from "@/lib/api-keys"
import { PLANS, isActiveSubscription, type PlanId } from "@/lib/plans"
import { UnauthorizedError, ForbiddenError } from "@/lib/api-errors"
import { db } from "@/lib/db"

export type ApiContext = {
  apiKeyId: string | null
  userId: string | null
  memberRole: string | null
  organizationId: string
  organization: {
    id: string
    name: string
    plan: string
    subscriptionStatus: string
  }
  requestId: string
}

/**
 * Authenticate an API request.
 * Supports two auth methods:
 *   1. API key (token starts with "lsk_live_") — org-scoped, no user identity
 *   2. Session token (any other Bearer token) — user-scoped via Better Auth session
 * Throws ApiError on failure.
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<ApiContext> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError(
      "Missing Authorization header. Expected: Bearer <token>"
    )
  }

  const token = authHeader.slice(7) // strip "Bearer "
  if (!token) {
    throw new UnauthorizedError("Auth token is empty.")
  }

  const requestId = generateRequestId()

  // Route 1: API key auth (existing)
  if (token.startsWith("lsk_live_")) {
    return authenticateWithApiKey(token, requestId)
  }

  // Route 2: Session token auth (new — for mobile staff app)
  return authenticateWithSession(token, requestId)
}

async function authenticateWithApiKey(
  key: string,
  requestId: string
): Promise<ApiContext> {
  const result = await validateApiKey(key)
  if (!result) {
    throw new UnauthorizedError("Invalid or expired API key.")
  }

  checkOrgAccess(result.organization)

  return {
    apiKeyId: result.apiKeyId,
    userId: null,
    memberRole: null,
    organizationId: result.organizationId,
    organization: result.organization,
    requestId,
  }
}

async function authenticateWithSession(
  token: string,
  requestId: string
): Promise<ApiContext> {
  // Look up session by token
  const session = await db.session.findUnique({
    where: { token },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      activeOrganizationId: true,
      user: { select: { id: true, role: true } },
    },
  })

  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired session token.")
  }

  if (!session.activeOrganizationId) {
    throw new ForbiddenError(
      "No active organization selected. Call POST /api/v1/auth/select-org first."
    )
  }

  // Get org + member record
  const [org, member] = await Promise.all([
    db.organization.findUnique({
      where: { id: session.activeOrganizationId },
      select: { id: true, name: true, plan: true, subscriptionStatus: true },
    }),
    db.member.findFirst({
      where: {
        userId: session.userId,
        organizationId: session.activeOrganizationId,
      },
      select: { role: true },
    }),
  ])

  if (!org) {
    throw new ForbiddenError("Organization not found.")
  }

  if (!member) {
    throw new ForbiddenError("You are not a member of this organization.")
  }

  checkOrgAccess(org)

  return {
    apiKeyId: null,
    userId: session.userId,
    memberRole: member.role,
    organizationId: org.id,
    organization: org,
    requestId,
  }
}

function checkOrgAccess(org: {
  plan: string
  subscriptionStatus: string
}): void {
  if (!isActiveSubscription(org.subscriptionStatus)) {
    throw new ForbiddenError(
      "Organization subscription is not active. Please update your billing."
    )
  }

  const planDef = PLANS[org.plan as PlanId]
  if (!planDef?.apiAccess) {
    throw new ForbiddenError(
      "Your current plan does not include API access."
    )
  }
}

function generateRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`
}

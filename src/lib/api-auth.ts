import "server-only"

import crypto from "node:crypto"
import { type NextRequest } from "next/server"
import { validateApiKey } from "@/lib/api-keys"
import { PLANS, isActiveSubscription, type PlanId } from "@/lib/plans"
import { UnauthorizedError, ForbiddenError } from "@/lib/api-errors"

export type ApiContext = {
  apiKeyId: string
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
 * Extracts Bearer token, validates key, checks plan access, returns org context.
 * Throws ApiError on failure.
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<ApiContext> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError(
      "Missing Authorization header. Expected: Bearer lsk_live_..."
    )
  }

  const key = authHeader.slice(7) // strip "Bearer "
  if (!key) {
    throw new UnauthorizedError("API key is empty.")
  }

  const result = await validateApiKey(key)
  if (!result) {
    throw new UnauthorizedError("Invalid or expired API key.")
  }

  // Check subscription is active
  if (!isActiveSubscription(result.organization.subscriptionStatus)) {
    throw new ForbiddenError(
      "Organization subscription is not active. Please update your billing."
    )
  }

  // Check plan allows API access
  const planDef = PLANS[result.organization.plan as PlanId]
  if (!planDef?.apiAccess) {
    throw new ForbiddenError(
      "Your current plan does not include API access."
    )
  }

  const requestId = generateRequestId()

  return {
    apiKeyId: result.apiKeyId,
    organizationId: result.organizationId,
    organization: result.organization,
    requestId,
  }
}

function generateRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`
}

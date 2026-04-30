import "server-only"

import { headers } from "next/headers"
import { db } from "@/lib/db"
import type { OrgAuditAction, Prisma } from "@prisma/client"

export type OrgAuditLogParams = {
  organizationId: string
  actorUserId: string | null
  actorEmail: string | null
  action: OrgAuditAction
  targetType?: "member" | "invitation"
  targetId?: string
  targetLabel?: string
  metadata?: Record<string, unknown>
}

/**
 * Append an event to the org-level audit log.
 *
 * Visible to org owners via /dashboard/settings/audit-log. Mirrors
 * `logAdminAction` (admin-audit.ts) but scoped to a single organization.
 *
 * Fire-and-forget: any failure here must never break the underlying owner
 * action (a flaky audit insert shouldn't block invitation send / member
 * removal). Errors are swallowed silently.
 */
export async function logOrgAction(params: OrgAuditLogParams): Promise<void> {
  try {
    const hdrs = await headers()
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      hdrs.get("x-real-ip") ??
      null
    const userAgent = hdrs.get("user-agent") ?? null

    await db.orgAuditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        actorEmail: params.actorEmail,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        targetLabel: params.targetLabel ?? null,
        metadata: (params.metadata
          ? JSON.parse(JSON.stringify(params.metadata))
          : undefined) as Prisma.InputJsonValue | undefined,
        ipAddress,
        userAgent,
      },
    })
  } catch {
    // Audit failure must not break the action that triggered it.
  }
}

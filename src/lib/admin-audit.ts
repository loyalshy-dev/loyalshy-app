import "server-only"

import { headers } from "next/headers"
import { db } from "@/lib/db"
import type { AdminAction } from "@prisma/client"

export type AuditLogParams = {
  adminId: string
  action: AdminAction
  targetType: "user" | "organization" | "contact"
  targetId: string
  targetLabel?: string
  metadata?: Record<string, unknown>
  reason?: string
}

/**
 * Logs an admin action to the audit trail.
 * Fire-and-forget — never throws, never blocks the caller.
 */
export async function logAdminAction(params: AuditLogParams): Promise<void> {
  try {
    const hdrs = await headers()
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      hdrs.get("x-real-ip") ??
      null
    const userAgent = hdrs.get("user-agent") ?? null

    await db.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        targetLabel: params.targetLabel ?? null,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        ipAddress,
        userAgent,
        reason: params.reason ?? null,
      },
    })
  } catch {
    // Fire-and-forget: audit log failure must never break admin actions
  }
}

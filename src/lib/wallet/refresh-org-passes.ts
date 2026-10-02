import "server-only"

import { after } from "next/server"
import { db } from "@/lib/db"

/**
 * Silent refresh of every active wallet pass in an org (no banner: nothing
 * with a changeMessage changes). Used when a feature adds an always-present
 * field that must already be on the device before its first real value
 * arrives — iOS doesn't banner a field that is new on that version.
 * Fans out through the `update-all-passes` Trigger.dev task; direct calls
 * when Trigger.dev isn't configured (local dev).
 */
export function refreshOrgPasses(organizationId: string) {
  after(async () => {
    try {
      if (process.env.TRIGGER_SECRET_KEY) {
        const { tasks } = await import("@trigger.dev/sdk")
        await tasks.trigger("update-all-passes", { organizationId, reason: "TEMPLATE_CHANGE" })
        return
      }
      const scope = { status: "ACTIVE" as const, passTemplate: { organizationId } }
      const [{ notifyGooglePassUpdate }, { notifyApplePassUpdate }, google, apple] = await Promise.all([
        import("@/lib/wallet/google/update-pass"),
        import("@/lib/wallet/apple/update-pass"),
        db.passInstance.findMany({ where: { ...scope, walletProvider: "GOOGLE" }, select: { id: true } }),
        db.passInstance.findMany({ where: { ...scope, walletProvider: "APPLE" }, select: { id: true } }),
      ])
      await Promise.allSettled([
        ...google.map((p) => notifyGooglePassUpdate(p.id)),
        ...apple.map((p) => notifyApplePassUpdate(p.id)),
      ])
    } catch (err) {
      console.error("[refresh-org-passes] failed:", err instanceof Error ? err.message : err)
    }
  })
}

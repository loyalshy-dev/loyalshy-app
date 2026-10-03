import "server-only"

import { db } from "@/lib/db"
import { planAllowsFeature, type PlanFeature, type PlanId } from "@/lib/plans"

// Platform admin roles (User.role). Mirrors ADMIN_ROLE_HIERARCHY in dal.ts,
// which can't be imported here: automations run in background jobs with no session.
const ADMIN_USER_ROLES = ["ADMIN_SUPPORT", "ADMIN_BILLING", "ADMIN_OPS", "SUPER_ADMIN"] as const

/**
 * Whether an org gets a paid automation (review prompts, win-back): a plan
 * that includes it, or an org OWNED by a platform admin (our own test/demo
 * orgs, which usually sit on Free). Keyed on the owner — not on whoever is
 * logged in — because these run in the background with no admin session. A
 * platform admin who is merely a member of a client's Free org does not
 * unlock it for that client.
 */
export async function orgAllowsFeature(
  org: { id: string; plan: string; subscriptionStatus: string },
  feature: PlanFeature,
): Promise<boolean> {
  if (planAllowsFeature(org.plan as PlanId, org.subscriptionStatus, feature)) return true
  const adminOwner = await db.member.findFirst({
    where: { organizationId: org.id, role: "owner", user: { role: { in: [...ADMIN_USER_ROLES] } } },
    select: { id: true },
  })
  return Boolean(adminOwner)
}

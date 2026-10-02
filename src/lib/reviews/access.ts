import "server-only"

import { db } from "@/lib/db"
import { planAllowsReviewPrompts, type PlanId } from "@/lib/plans"

// Platform admin roles (User.role). Mirrors ADMIN_ROLE_HIERARCHY in dal.ts,
// which can't be imported here: this runs in background sends with no session.
const ADMIN_USER_ROLES = ["ADMIN_SUPPORT", "ADMIN_BILLING", "ADMIN_OPS", "SUPER_ADMIN"] as const

/**
 * Whether an org gets review prompts: a plan that includes them, or an org
 * OWNED by a platform admin (our own test/demo orgs, which usually sit on
 * Free). Keyed on the owner — not on whoever is logged in — because prompts
 * are scheduled on staff stamps and delivered in the background, with no
 * admin session around. A platform admin who is merely a member of a
 * client's Free org does not unlock it for that client.
 */
export async function orgAllowsReviewPrompts(org: {
  id: string
  plan: string
  subscriptionStatus: string
}): Promise<boolean> {
  if (planAllowsReviewPrompts(org.plan as PlanId, org.subscriptionStatus)) return true
  const adminOwner = await db.member.findFirst({
    where: { organizationId: org.id, role: "owner", user: { role: { in: [...ADMIN_USER_ROLES] } } },
    select: { id: true },
  })
  return Boolean(adminOwner)
}

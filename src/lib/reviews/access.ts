import "server-only"

import { orgAllowsFeature } from "@/lib/plan-access"

/** Review prompts: Pro+ or an admin-owned org (see plan-access.ts). */
export function orgAllowsReviewPrompts(org: {
  id: string
  plan: string
  subscriptionStatus: string
}): Promise<boolean> {
  return orgAllowsFeature(org, "reviewPrompts")
}

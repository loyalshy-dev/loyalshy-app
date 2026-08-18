"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { assertAuthenticated } from "@/lib/dal"

const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1),
})

/**
 * Switch the current session's active organization.
 * Only updates THIS session row — other sessions for the same user
 * (e.g. the staff app's bearer session) keep their own active org,
 * mirroring /api/v1/auth/select-org.
 */
export async function switchActiveOrganization(input: {
  organizationId: string
}): Promise<{ success: true } | { error: string }> {
  const session = await assertAuthenticated()

  const parsed = switchOrganizationSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "invalid_input" }
  }
  const { organizationId } = parsed.data

  const member = await db.member.findFirst({
    where: { userId: session.user.id, organizationId },
    select: { id: true },
  })
  if (!member) {
    return { error: "not_a_member" }
  }

  await db.session.update({
    where: { id: session.session.id },
    data: { activeOrganizationId: organizationId },
  })

  return { success: true }
}

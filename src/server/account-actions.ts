"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { assertAuthenticated } from "@/lib/dal"
import { logOrgAction } from "@/lib/org-audit"

const deleteSchema = z.object({
  confirmationEmail: z.string().email(),
})

/**
 * Self-service account deletion.
 *
 * Soft-delete pattern (industry standard for B2B SaaS):
 *  - User row is banned + name/email/image scrubbed → can never sign in,
 *    audit trails on Interaction.performedBy / Reward.redeemedBy /
 *    OrgAuditLog.actor still resolve via foreign keys.
 *  - All sessions deleted → mobile staff app + every browser tab gets
 *    booted on the next request.
 *  - All Account rows deleted → no leftover OAuth tokens or password hash;
 *    nobody can re-derive credentials.
 *  - Memberships removed one-by-one (not via cascade) so we can audit each
 *    org separately and revoke per-org sessions; an `OrgAuditLog` entry
 *    with `metadata.selfRemoved: true` lets owners distinguish a self-
 *    departure from an owner-initiated removal.
 *
 * Preconditions enforced before any writes:
 *  - The submitted `confirmationEmail` must match the current user's email
 *    exactly (case-insensitive). Acts as the typed-name confirmation.
 *  - For every org where the user is the **last owner**, deletion is
 *    blocked. Returning a list of names lets the UI tell the user
 *    exactly which orgs they need to transfer or have deleted first.
 *
 * Soft-delete is reversible from the DB side (un-ban, restore email)
 * which is why we don't hard-delete the User row. If true GDPR erasure
 * is requested later, an admin can hard-delete via the admin panel.
 */
export async function deleteOwnAccount(
  input: z.infer<typeof deleteSchema>,
): Promise<
  | { success: true }
  | { error: "wrong_email" }
  | { error: "last_owner"; orgNames: string[] }
> {
  const parsed = deleteSchema.parse(input)
  const session = await assertAuthenticated()
  const userId = session.user.id
  const userEmail = session.user.email

  if (parsed.confirmationEmail.toLowerCase() !== userEmail.toLowerCase()) {
    return { error: "wrong_email" }
  }

  // Enumerate every org membership; we'll need the full list whether the
  // pre-flight passes or fails.
  const memberships = await db.member.findMany({
    where: { userId },
    select: {
      id: true,
      role: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  })

  // Pre-flight: any org where the user is the only owner blocks deletion.
  const blockedOrgs: string[] = []
  for (const m of memberships) {
    if (m.role !== "owner") continue
    const ownerCount = await db.member.count({
      where: { organizationId: m.organizationId, role: "owner" },
    })
    if (ownerCount === 1) {
      blockedOrgs.push(m.organization.name)
    }
  }
  if (blockedOrgs.length > 0) {
    return { error: "last_owner", orgNames: blockedOrgs }
  }

  // Leave every org. Each iteration: drop the Member row, kill any session
  // pinned to that org (so the staff app + browser tabs get 401-bounced),
  // and write an audit entry with selfRemoved: true so owners can see who
  // left and when.
  for (const m of memberships) {
    await db.$transaction([
      db.member.delete({ where: { id: m.id } }),
      db.session.deleteMany({
        where: { userId, activeOrganizationId: m.organizationId },
      }),
    ])
    await logOrgAction({
      organizationId: m.organizationId,
      actorUserId: userId,
      actorEmail: userEmail,
      action: "MEMBER_REMOVED",
      targetType: "member",
      targetId: userId,
      targetLabel: userEmail,
      metadata: { role: m.role, selfRemoved: true },
    })
  }

  // Soft-delete the user. Email gets a unique scrubbed value so nothing
  // collides with a future re-registration of the same address — and so
  // nobody can re-derive the original email from the row.
  const scrubbedEmail = `deleted-${Date.now()}-${userId}@deleted.local`
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        banned: true,
        banReason: "self-deleted",
        name: "Deleted user",
        email: scrubbedEmail,
        image: null,
      },
    }),
    db.session.deleteMany({ where: { userId } }),
    db.account.deleteMany({ where: { userId } }),
  ])

  return { success: true }
}

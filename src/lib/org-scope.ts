import type { Prisma } from "@prisma/client"
import type { SessionContext } from "./api-session"

/**
 * Tenant-scoped Prisma `where` composers.
 *
 * Every staff-app data route is responsible for restricting reads/writes
 * to the caller's organization. Forgetting that filter is a cross-tenant
 * IDOR — exactly the bug class hardest to catch in code review because
 * "no error" looks the same as "correctly scoped." These helpers move the
 * scoping decision into one file, give each entity an explicit named
 * function, and make the relational quirks (PassInstance has no
 * `organizationId` column — it traverses `passTemplate`) impossible to
 * forget at call sites.
 *
 * Usage:
 *
 *   const contacts = await db.contact.findMany({
 *     where: orgScope.contact(ctx, { deletedAt: null }),
 *   })
 *
 *   const pass = await db.passInstance.findFirst({
 *     where: orgScope.passInstance(ctx, { OR: [{ id }, { walletPassId: id }] }),
 *   })
 *
 * To audit: grep for `db.<model>.findMany|findFirst|findUnique|updateMany`
 * in `src/app/api/v1/**` and confirm each call sources its `where` from
 * `orgScope.*`. Anything else is a finding.
 */
export const orgScope = {
  contact(
    ctx: SessionContext,
    where: Prisma.ContactWhereInput = {},
  ): Prisma.ContactWhereInput {
    return { ...where, organizationId: ctx.organizationId }
  },

  passTemplate(
    ctx: SessionContext,
    where: Prisma.PassTemplateWhereInput = {},
  ): Prisma.PassTemplateWhereInput {
    return { ...where, organizationId: ctx.organizationId }
  },

  /**
   * `PassInstance` has no `organizationId` column — ownership is via
   * `passTemplate.organizationId`. The caller's `where` should NOT
   * include its own `passTemplate` relational filter (use a separate
   * sub-filter helper if that's needed); we own that slot to make sure
   * the org guard isn't accidentally overwritten by a later `...spread`.
   */
  passInstance(
    ctx: SessionContext,
    where: Omit<Prisma.PassInstanceWhereInput, "passTemplate"> = {},
  ): Prisma.PassInstanceWhereInput {
    return {
      ...where,
      passTemplate: { organizationId: ctx.organizationId },
    }
  },

  interaction(
    ctx: SessionContext,
    where: Prisma.InteractionWhereInput = {},
  ): Prisma.InteractionWhereInput {
    return { ...where, organizationId: ctx.organizationId }
  },

  reward(
    ctx: SessionContext,
    where: Prisma.RewardWhereInput = {},
  ): Prisma.RewardWhereInput {
    return { ...where, organizationId: ctx.organizationId }
  },
}

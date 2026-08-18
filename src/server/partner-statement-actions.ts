"use server"

import { db } from "@/lib/db"
import { assertAdminRole } from "@/lib/dal"
import {
  buildPartnerStatement,
  type PartnerStatement,
} from "@/lib/partner-statement"

export type { PartnerStatement, StatementLine } from "@/lib/partner-statement"

// ─── Monthly partner rev-share statement (actions) ──────────
//
// Math and contract terms live in src/lib/partner-statement.ts. Admin-only:
// the partner console deliberately has NO self-serve earnings view — the
// rev-share percentage is negotiated per partner, so the fixed-rate
// statement is an internal payout tool, not something partners see.

export type PartnerRow = {
  id: string
  name: string
  email: string
  referralCode: string | null
  attributedOrgCount: number
}

export async function getPartners(): Promise<PartnerRow[] | { error: string }> {
  await assertAdminRole("ADMIN_BILLING")

  const partners = await db.user.findMany({
    where: { isPartner: true },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      _count: { select: { referredOrganizations: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return partners.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    referralCode: p.referralCode,
    attributedOrgCount: p._count.referredOrganizations,
  }))
}

export async function getPartnerStatement(
  partnerId: string,
  year: number,
  month: number
): Promise<PartnerStatement | { error: string }> {
  await assertAdminRole("ADMIN_BILLING")
  return buildPartnerStatement(partnerId, year, month)
}

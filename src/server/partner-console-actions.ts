"use server"

import { db } from "@/lib/db"
import { assertAuthenticated } from "@/lib/dal"
import { publicFormLimiter } from "@/lib/rate-limit"
import { logOrgAction } from "@/lib/org-audit"

// ─── Partner console: client portfolio ──────────────────────
//
// Everything a partner rep needs to run their book: each attributed org
// (Organization.referredById = them) with setup-checklist status, whether
// ownership has been handed off, and whether the rep can still open the
// org from the dashboard (they're a member until the client removes them).

export type PartnerClient = {
  organizationId: string
  name: string
  logo: string | null
  plan: string
  subscriptionStatus: string
  createdAt: string
  checklist: {
    programPublished: boolean // ≥1 ACTIVE template
    contactsJoined: boolean // ≥1 contact
    ownerClaimed: boolean // a non-partner owner exists
  }
  handoffPending: boolean // an unclaimed, unexpired handoff link exists
  isMember: boolean // the rep can switch into this org
}

export async function getMyPartnerClients(): Promise<
  PartnerClient[] | { error: "not_a_partner" }
> {
  const session = await assertAuthenticated()

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isPartner: true },
  })
  if (!me?.isPartner) {
    return { error: "not_a_partner" }
  }

  const now = new Date()
  const orgs = await db.organization.findMany({
    where: { referredById: session.user.id },
    select: {
      id: true,
      name: true,
      logo: true,
      logoGoogle: true,
      plan: true,
      subscriptionStatus: true,
      createdAt: true,
      _count: {
        select: {
          passTemplates: { where: { status: "ACTIVE" } },
          contacts: { where: { deletedAt: null } },
        },
      },
      members: {
        where: { role: "owner" },
        select: { userId: true, user: { select: { isPartner: true } } },
      },
      handoffTokens: {
        where: { claimedAt: null, expiresAt: { gt: now } },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const myMemberships = await db.member.findMany({
    where: { userId: session.user.id, organizationId: { in: orgs.map((o) => o.id) } },
    select: { organizationId: true },
  })
  const memberOf = new Set(myMemberships.map((m) => m.organizationId))

  return orgs.map((o) => ({
    organizationId: o.id,
    name: o.name,
    logo: o.logoGoogle ?? o.logo,
    plan: o.plan,
    subscriptionStatus: o.subscriptionStatus,
    createdAt: o.createdAt.toISOString(),
    checklist: {
      programPublished: o._count.passTemplates > 0,
      contactsJoined: o._count.contacts > 0,
      ownerClaimed: o.members.some((m) => !m.user.isPartner),
    },
    handoffPending: o.handoffTokens.length > 0,
    isMember: memberOf.has(o.id),
  }))
}

// ─── Request access to a referred client org ────────────────
//
// Referral-signup clients never gave the rep a seat. The rep can't grant
// themselves access (that would be a backdoor) — instead this emails the
// org's owner(s) a prefilled link to the Team invite dialog. The owner
// stays fully in control: one click to review, one click to send.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function requestClientAccess(
  organizationId: string
): Promise<
  | { success: true; sentTo: number }
  | { error: "not_a_partner" | "not_your_client" | "already_member" | "no_owner" | "rate_limited" | "send_failed" }
> {
  const session = await assertAuthenticated()

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isPartner: true },
  })
  if (!me?.isPartner) {
    return { error: "not_a_partner" }
  }

  // 3 requests per org per hour per rep — enough to retry, not enough to spam
  const { success: withinLimit } = publicFormLimiter.check(
    `access-request:${session.user.id}:${organizationId}`
  )
  if (!withinLimit) {
    return { error: "rate_limited" }
  }

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      referredById: true,
      members: {
        where: { role: "owner" },
        select: { userId: true, user: { select: { email: true, isPartner: true } } },
      },
    },
  })
  if (!org || org.referredById !== session.user.id) {
    return { error: "not_your_client" }
  }

  const existingMembership = await db.member.findFirst({
    where: { organizationId, userId: session.user.id },
    select: { id: true },
  })
  if (existingMembership) {
    return { error: "already_member" }
  }

  const owners = org.members.filter((m) => !m.user.isPartner)
  if (owners.length === 0) {
    return { error: "no_owner" }
  }

  const siteUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"
  const inviteLink = `${siteUrl}/dashboard/settings?tab=team&invite=${encodeURIComponent(session.user.email)}&inviteRole=admin`
  const repName = escapeHtml(session.user.name)
  const repEmail = escapeHtml(session.user.email)
  const orgName = escapeHtml(org.name)

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    await Promise.all(
      owners.slice(0, 3).map((owner) =>
        resend.emails.send({
          from: "Loyalshy <noreply@loyalshy.com>",
          to: owner.user.email,
          subject: `${session.user.name} is requesting access to ${org.name}`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
              <h2 style="color:#171717;font-size:24px;margin-bottom:8px;">Access request</h2>
              <p style="color:#525252;font-size:15px;line-height:1.6;">
                <strong>${repName}</strong> (${repEmail}), your Loyalshy setup
                partner, is asking for <strong>Program manager</strong> access to
                <strong>${orgName}</strong> — they'd be able to design cards and
                manage programs, but not billing, your team, or settings.
              </p>
              <p style="color:#525252;font-size:15px;line-height:1.6;">
                To grant it, open your team settings — the invitation will be
                pre-filled, you just review and send. You can also ignore this
                email, or remove their access again at any time.
              </p>
              <a href="${inviteLink}" style="display:inline-block;padding:12px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;margin:16px 0;">
                Review invitation
              </a>
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
              <p style="color:#a3a3a3;font-size:12px;">Loyalshy — Digital loyalty programs</p>
            </div>
          `,
        })
      )
    )
  } catch (err) {
    console.error("[requestClientAccess] email send failed:", err instanceof Error ? err.message : err)
    return { error: "send_failed" }
  }

  await logOrgAction({
    organizationId,
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "ACCESS_REQUESTED",
    targetType: "member",
    targetLabel: session.user.email,
    metadata: { sentToOwners: Math.min(owners.length, 3) },
  })

  return { success: true, sentTo: Math.min(owners.length, 3) }
}

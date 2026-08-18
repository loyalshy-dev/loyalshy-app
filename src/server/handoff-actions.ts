"use server"

import { z } from "zod"
import crypto from "crypto"
import { addDays } from "date-fns"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { assertAuthenticated, assertOrganizationRole } from "@/lib/dal"
import { publicFormLimiter } from "@/lib/rate-limit"
import { hashToken } from "@/lib/token-hash"
import { logOrgAction } from "@/lib/org-audit"
import { sanitizeText } from "@/lib/sanitize"

// ─── Partner-led onboarding ─────────────────────────────────
//
// A partner rep (User.isPartner, flagged by admins) creates a client org,
// does the full setup (design, publish, staff pairing), then hands
// ownership to the real owner via a one-shot claim link. On claim the
// claimant becomes owner and every partner-held owner seat in the org is
// demoted to member — the agency keeps access (as a non-counting partner
// seat) but never retains billing/team control after the client takes over.

const HANDOFF_EXPIRY_DAYS = 7

const createClientOrgSchema = z.object({
  name: z.string().min(1).max(100),
})

const claimSchema = z.object({
  token: z.string().min(1).max(200),
})

// Same slug helpers as onboarding-registration-actions (private there).
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name)
  if (!base) return `organization-${Date.now().toString(36)}`
  const existing = await db.organization.findUnique({ where: { slug: base } })
  if (!existing) return base
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

async function requirePartner(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isPartner: true },
  })
  return user?.isPartner === true
}

// ─── Create Client Org ──────────────────────────────────────

export async function createClientOrg(input: z.input<typeof createClientOrgSchema>) {
  const session = await assertAuthenticated()

  const parsed = createClientOrgSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "invalid_input" as const }
  }

  if (!(await requirePartner(session.user.id))) {
    return { error: "not_a_partner" as const }
  }

  const name = sanitizeText(parsed.data.name, 100)
  const slug = await generateUniqueSlug(name)

  const organization = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        slug,
        plan: "FREE",
        subscriptionStatus: "ACTIVE",
        settings: { onboardingComplete: true, createdByPartner: session.user.id },
        // Canonical attribution column for the rev-share statement (the
        // settings stamp above is kept as a redundant marker).
        referredById: session.user.id,
      },
    })
    // The rep starts as owner so the design studio, distribution, and
    // device pairing all work pre-handoff. Demoted to member on claim.
    await tx.member.create({
      data: {
        userId: session.user.id,
        organizationId: org.id,
        role: "owner",
      },
    })
    return org
  })

  // Switch only THIS session to the new org (parallel sessions keep theirs)
  await db.session.update({
    where: { id: session.session.id },
    data: { activeOrganizationId: organization.id },
  })

  return { organizationId: organization.id }
}

// ─── Create Handoff Link ────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const recipientEmailSchema = z.string().email().max(254)

/**
 * Generates a fresh one-shot handoff link (invalidating any previous
 * unclaimed one). When recipientEmail is given, also emails the link to
 * the business owner so the rep doesn't have to copy-paste it around.
 */
export async function createHandoffLink(
  organizationId: string,
  recipientEmail?: string
) {
  const session = await assertAuthenticated()

  if (!(await requirePartner(session.user.id))) {
    return { error: "not_a_partner" as const }
  }
  await assertOrganizationRole(organizationId, "owner")

  if (recipientEmail !== undefined) {
    const parsedEmail = recipientEmailSchema.safeParse(recipientEmail)
    if (!parsedEmail.success) {
      return { error: "invalid_email" as const }
    }
    recipientEmail = parsedEmail.data
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  if (!organization) {
    return { error: "not_found" as const }
  }

  const plaintextToken = crypto.randomBytes(32).toString("hex")
  const expiresAt = addDays(new Date(), HANDOFF_EXPIRY_DAYS)

  await db.$transaction([
    // Regenerating invalidates any previously issued unclaimed link
    db.orgHandoffToken.deleteMany({
      where: { organizationId, claimedAt: null },
    }),
    db.orgHandoffToken.create({
      data: {
        organizationId,
        createdById: session.user.id,
        token: hashToken(plaintextToken),
        expiresAt,
      },
    }),
  ])

  const siteUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"
  const url = `${siteUrl}/claim/${plaintextToken}`

  let emailSent = false
  if (recipientEmail) {
    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      const orgName = escapeHtml(organization.name)
      await resend.emails.send({
        from: "Loyalshy <noreply@loyalshy.com>",
        to: recipientEmail,
        subject: `Take ownership of ${organization.name} on Loyalshy`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
            <h2 style="color:#171717;font-size:24px;margin-bottom:8px;">Your loyalty program is ready!</h2>
            <p style="color:#525252;font-size:15px;line-height:1.6;">
              <strong>${orgName}</strong> has been set up for you on Loyalshy.
              Create your account to take ownership — your card design and
              program are already waiting for you.
            </p>
            <a href="${url}" style="display:inline-block;padding:12px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;margin:16px 0;">
              Take ownership
            </a>
            <p style="color:#a3a3a3;font-size:13px;margin-top:24px;">This link expires in ${HANDOFF_EXPIRY_DAYS} days and can be used once.</p>
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
            <p style="color:#a3a3a3;font-size:12px;">Loyalshy — Digital loyalty programs</p>
          </div>
        `,
      })
      emailSent = true
    } catch (err) {
      // The link itself was created; the rep can still copy it manually.
      console.error("[createHandoffLink] email send failed:", err instanceof Error ? err.message : err)
    }
  }

  await logOrgAction({
    organizationId,
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "HANDOFF_LINK_CREATED",
    targetType: "handoff",
    metadata: {
      expiresAt: expiresAt.toISOString(),
      ...(recipientEmail ? { sentTo: recipientEmail, emailSent } : {}),
    },
  })

  return {
    url,
    expiresAt: expiresAt.toISOString(),
    emailSent,
  }
}

// ─── Validate Handoff Token ─────────────────────────────────

export async function validateHandoffToken(token: string) {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { success } = publicFormLimiter.check(`validate-handoff:${ip}`)
  if (!success) {
    return { error: "rate_limited" as const }
  }

  const handoff = await db.orgHandoffToken.findUnique({
    where: { token: hashToken(token) },
    include: { organization: { select: { id: true, name: true, logo: true } } },
  })

  if (!handoff) {
    return { error: "stale_link" as const }
  }
  if (handoff.claimedAt) {
    // If the signed-in visitor is already a member (typically the claimant
    // re-clicking the link), route them straight to the dashboard instead
    // of dead-ending on "already used".
    const { auth } = await import("@/lib/auth")
    const session = await auth.api.getSession({ headers: headersList })
    if (session?.user?.id) {
      const member = await db.member.findFirst({
        where: {
          userId: session.user.id,
          organizationId: handoff.organizationId,
        },
        select: { id: true },
      })
      if (member) {
        return {
          alreadyMember: true as const,
          organizationName: handoff.organization.name,
        }
      }
    }
    return { error: "already_used" as const }
  }
  if (handoff.expiresAt < new Date()) {
    return { error: "expired" as const }
  }

  return {
    handoff: {
      organizationId: handoff.organization.id,
      organizationName: handoff.organization.name,
      organizationLogo: handoff.organization.logo,
      expiresAt: handoff.expiresAt.toISOString(),
    },
  }
}

// ─── Claim Handoff (ownership transfer) ─────────────────────

export async function claimHandoff(input: z.input<typeof claimSchema>) {
  const session = await assertAuthenticated()

  const parsed = claimSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "invalid_input" as const }
  }

  // Mirror the invite-accept gate: the mobile + web flows both require a
  // verified email before granting org access. Read from db.user because
  // the DAL AuthUser projection strips emailVerified.
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  })
  if (!dbUser?.emailVerified) {
    return { error: "email_not_verified" as const }
  }

  const tokenHash = hashToken(parsed.data.token)

  const result = await db.$transaction(async (tx) => {
    const handoff = await tx.orgHandoffToken.findUnique({
      where: { token: tokenHash },
      include: { organization: { select: { id: true, name: true } } },
    })

    if (!handoff) return { error: "stale_link" as const }
    if (handoff.expiresAt < new Date()) return { error: "expired" as const }
    if (handoff.createdById === session.user.id) {
      return { error: "cannot_claim_own" as const }
    }

    // Atomic claim: only one caller wins the race
    const claimed = await tx.orgHandoffToken.updateMany({
      where: { id: handoff.id, claimedAt: null },
      data: { claimedAt: new Date(), claimedById: session.user.id },
    })
    if (claimed.count === 0) return { error: "already_used" as const }

    const organizationId = handoff.organization.id

    // Claimant becomes owner (promote if somehow already a member)
    const existingMember = await tx.member.findFirst({
      where: { userId: session.user.id, organizationId },
      select: { id: true },
    })
    if (existingMember) {
      await tx.member.update({
        where: { id: existingMember.id },
        data: { role: "owner" },
      })
    } else {
      await tx.member.create({
        data: { userId: session.user.id, organizationId, role: "owner" },
      })
    }

    // Demote every partner-held owner seat (the creating rep, and any
    // other agency rep) to "admin" (program manager): they keep design,
    // distribution, and program-lifecycle access as a non-counting partner
    // seat for follow-up support, but lose billing/team/org-settings
    // control. Non-partner co-owners are untouched.
    const demoted = await tx.member.updateMany({
      where: {
        organizationId,
        role: "owner",
        userId: { not: session.user.id },
        user: { isPartner: true },
      },
      data: { role: "admin" },
    })

    return {
      organizationId,
      organizationName: handoff.organization.name,
      createdById: handoff.createdById,
      demotedCount: demoted.count,
    }
  })

  if ("error" in result) {
    return result
  }

  // Land this session in the newly owned org
  await db.session.update({
    where: { id: session.session.id },
    data: { activeOrganizationId: result.organizationId },
  })

  await logOrgAction({
    organizationId: result.organizationId,
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "OWNERSHIP_CLAIMED",
    targetType: "handoff",
    targetLabel: session.user.email,
    metadata: {
      createdById: result.createdById,
      partnerOwnersDemoted: result.demotedCount,
    },
  })

  return {
    success: true as const,
    organizationName: result.organizationName,
  }
}

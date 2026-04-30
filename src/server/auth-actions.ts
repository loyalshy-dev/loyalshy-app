"use server"

import { z } from "zod"
import crypto from "crypto"
import { addDays } from "date-fns"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { assertOrganizationRole, assertAuthenticated } from "@/lib/dal"
import { publicFormLimiter } from "@/lib/rate-limit"
import { hashToken } from "@/lib/token-hash"

// ─── Schemas ────────────────────────────────────────────────

const sendInvitationSchema = z.object({
  organizationId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["owner", "staff"]),
})

// ─── Send Staff Invitation ──────────────────────────────────

export async function sendStaffInvitation(input: z.infer<typeof sendInvitationSchema>) {
  const parsed = sendInvitationSchema.parse(input)

  // Only owners can invite staff
  await assertOrganizationRole(parsed.organizationId, "owner")

  // Check for existing pending invitation
  const existing = await db.staffInvitation.findFirst({
    where: {
      organizationId: parsed.organizationId,
      email: parsed.email,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
  })

  if (existing) {
    return { error: "An invitation has already been sent to this email" }
  }

  // Cap pending invitations at 50 per organization
  const pendingCount = await db.staffInvitation.count({
    where: {
      organizationId: parsed.organizationId,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
  })

  if (pendingCount >= 50) {
    return { error: "Too many pending invitations. Cancel some before sending new ones." }
  }

  // Check if user is already a member of this organization
  const org = await db.organization.findUnique({
    where: { id: parsed.organizationId },
    select: {
      name: true,
      members: {
        select: { userId: true, user: { select: { email: true } } },
      },
    },
  })

  const isMember = org?.members.some((m) => m.user.email === parsed.email)
  if (isMember) {
    return { error: "This user is already a member of your organization" }
  }

  // Generate invitation token. The plaintext only ever leaves in the
  // email/deep-link; the DB stores the sha256 hash so a backup leak
  // can't be replayed against /invite/[token].
  const plaintextToken = crypto.randomBytes(32).toString("hex")
  const expiresAt = addDays(new Date(), 7)

  const invitation = await db.staffInvitation.create({
    data: {
      organizationId: parsed.organizationId,
      email: parsed.email,
      role: parsed.role === "owner" ? "OWNER" : "STAFF",
      token: hashToken(plaintextToken),
      expiresAt,
    },
  })

  // Dispatch invitation email
  const siteUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"
  const inviteUrl = `${siteUrl}/invite/${plaintextToken}`
  const mobileDeepLink = `loyalshystaff://invite/${plaintextToken}?url=${encodeURIComponent(siteUrl)}`
  const organizationName = org?.name ?? "An organization"

  await sendInvitationEmail({
    email: parsed.email,
    organizationName,
    role: parsed.role,
    inviteUrl,
    mobileDeepLink,
    // Initial send: dedupe across Trigger.dev/Resend retries. The manual
    // "resend invitation" flow intentionally omits this key so each click
    // produces a fresh email.
    idempotencyKey: `invite:${invitation.id}`,
  })

  return { success: true, invitationId: invitation.id }
}

/** Sends the invitation email via Trigger.dev or falls back to direct Resend. */
export async function sendInvitationEmail(payload: {
  email: string
  organizationName: string
  role: "owner" | "staff"
  inviteUrl: string
  mobileDeepLink?: string
  idempotencyKey?: string
}) {
  if (process.env.TRIGGER_SECRET_KEY) {
    const { tasks } = await import("@trigger.dev/sdk")
    await tasks.trigger(
      "send-invitation-email",
      payload,
      payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined,
    )
  } else {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { getEmailFrom } = await import("@/lib/email-templates")

    const roleLabel = payload.role === "owner" ? "an owner" : "a staff member"

    await resend.emails.send(
      {
      from: getEmailFrom(),
      to: payload.email,
      subject: `You've been invited to ${payload.organizationName} on Loyalshy`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
          <h2 style="color:#171717;font-size:24px;margin-bottom:8px;">You've been invited!</h2>
          <p style="color:#525252;font-size:15px;line-height:1.6;">
            <strong>${payload.organizationName}</strong> has invited you to join their team as ${roleLabel}.
          </p>
          <a href="${payload.inviteUrl}" style="display:inline-block;padding:12px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;margin:16px 0;">
            Accept Invitation
          </a>
          ${payload.mobileDeepLink ? `<a href="${payload.mobileDeepLink}" style="display:inline-block;padding:10px 20px;background:#fff;color:#171717;text-decoration:none;border-radius:6px;font-size:13px;font-weight:500;border:1px solid #e5e5e5;">Open in Staff App</a>` : ""}
          <p style="color:#a3a3a3;font-size:13px;margin-top:24px;">This invitation expires in 7 days.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
          <p style="color:#a3a3a3;font-size:12px;">Loyalshy — Digital Wallet Passes</p>
        </div>
      `,
      },
      payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined,
    )
  }
}

// ─── Validate Invitation Token ──────────────────────────────

export async function validateInvitationToken(token: string) {
  // Rate limit by IP
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { success } = publicFormLimiter.check(`validate-invite:${ip}`)
  if (!success) {
    return { error: "Too many requests. Please try again later." }
  }

  const invitation = await db.staffInvitation.findUnique({
    where: { token: hashToken(token) },
    include: { organization: true },
  })

  if (!invitation) {
    return { error: "Invalid invitation link" }
  }

  if (invitation.accepted) {
    return { error: "This invitation has already been used" }
  }

  if (invitation.expiresAt < new Date()) {
    return { error: "This invitation has expired" }
  }

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      organizationId: invitation.organizationId,
    },
  }
}

// ─── Sign-up + Accept (fresh account) ───────────────────────
//
// The /invite signup path used to call `authClient.signUp.email(...)`,
// which goes through Better Auth's `/sign-up/email` endpoint and triggers
// the emailOTP plugin's after-hook: a 6-digit OTP "verify your email" email
// gets sent. That makes no sense for invite acceptance — the recipient
// already proved control of the address by clicking the link from the
// invitation email.
//
// This action bypasses Better Auth's signup endpoint entirely, creates the
// User + credential Account + Member rows directly with `emailVerified:
// true`, then runs `auth.api.signInEmail` to mint a session. The
// `nextCookies()` Better Auth plugin (already wired in `src/lib/auth.ts`)
// forwards the Set-Cookie headers to the browser via Next.js `cookies()`,
// so the user lands in the dashboard authenticated, with no junk OTP.

const signUpInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
})

export async function signUpAndAcceptInvite(
  input: z.infer<typeof signUpInviteSchema>,
): Promise<{ success: true; organizationId: string } | { error: string; alreadyExists?: boolean }> {
  const parsed = signUpInviteSchema.parse(input)

  const invitation = await db.staffInvitation.findUnique({
    where: { token: hashToken(parsed.token) },
  })
  if (!invitation || invitation.accepted || invitation.expiresAt < new Date()) {
    return { error: "Invalid or expired invitation" }
  }

  // If the email already has an account, kick the form back to signin mode
  // rather than failing the unique constraint inside the transaction.
  const existing = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  })
  if (existing) {
    return {
      error: "An account with this email already exists. Sign in to accept the invitation.",
      alreadyExists: true,
    }
  }

  const { hashPassword } = await import("better-auth/crypto")
  const hashedPassword = await hashPassword(parsed.password)

  const userId = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: invitation.email,
        name: parsed.name,
        emailVerified: true,
        role: "USER",
      },
      select: { id: true },
    })

    await tx.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    })

    await tx.staffInvitation.update({
      where: { id: invitation.id },
      data: { accepted: true },
    })

    await tx.member.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        role: invitation.role === "OWNER" ? "owner" : "member",
      },
    })

    return user.id
  })

  // Mint the session via Better Auth so cookie handling matches every other
  // signin path. nextCookies() forwards the Set-Cookie via next/headers.
  const { auth } = await import("@/lib/auth")
  try {
    await auth.api.signInEmail({
      body: { email: invitation.email, password: parsed.password },
      headers: await headers(),
    })
  } catch (err) {
    // The user + invitation are persisted at this point; log so we can
    // diagnose, then surface a generic error so the form can fall back.
    console.error("[signUpAndAcceptInvite] signInEmail failed:", err)
    return { error: "Account created but sign-in failed. Please sign in manually." }
  }

  await db.session.updateMany({
    where: { userId },
    data: { activeOrganizationId: invitation.organizationId },
  })

  return { success: true, organizationId: invitation.organizationId }
}

// ─── Accept Invitation (existing user) ──────────────────────

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
})

export async function acceptStaffInvitation(input: z.infer<typeof acceptInvitationSchema>) {
  const parsed = acceptInvitationSchema.parse(input)
  const session = await assertAuthenticated()

  const invitation = await db.staffInvitation.findUnique({
    where: { token: hashToken(parsed.token) },
  })

  if (!invitation || invitation.accepted || invitation.expiresAt < new Date()) {
    return { error: "Invalid or expired invitation" }
  }

  // Verify the authenticated user's email matches the invitation email
  if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return { error: "This invitation was sent to a different email address" }
  }

  // If the user already belongs to this org (e.g. invitation was re-sent
  // after they already accepted, or they were added via another path), don't
  // explode on the unique constraint inside the transaction — just mark the
  // invitation accepted, point the session at this org, and let them in.
  const existingMember = await db.member.findFirst({
    where: {
      userId: session.user.id,
      organizationId: invitation.organizationId,
    },
    select: { id: true },
  })

  // Mark invitation accepted, add the membership if missing, and set the
  // session's active org so the dashboard lands in the org they just joined
  // rather than whatever org was previously active.
  await db.$transaction([
    db.staffInvitation.update({
      where: { id: invitation.id },
      data: { accepted: true },
    }),
    ...(existingMember
      ? []
      : [
          db.member.create({
            data: {
              userId: session.user.id,
              organizationId: invitation.organizationId,
              role: invitation.role === "OWNER" ? "owner" : "member",
            },
          }),
        ]),
    db.session.updateMany({
      where: { userId: session.user.id },
      data: { activeOrganizationId: invitation.organizationId },
    }),
  ])

  return { success: true, organizationId: invitation.organizationId }
}

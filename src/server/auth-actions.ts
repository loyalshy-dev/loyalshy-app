"use server"

import { z } from "zod"
import crypto from "crypto"
import { addDays } from "date-fns"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { assertOrganizationRole } from "@/lib/dal"
import { publicFormLimiter } from "@/lib/rate-limit"

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

  // Generate invitation token
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = addDays(new Date(), 7)

  const invitation = await db.staffInvitation.create({
    data: {
      organizationId: parsed.organizationId,
      email: parsed.email,
      role: parsed.role === "owner" ? "OWNER" : "STAFF",
      token,
      expiresAt,
    },
  })

  // Dispatch invitation email
  const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${token}`
  const organizationName = org?.name ?? "An organization"

  await sendInvitationEmail({
    email: parsed.email,
    organizationName,
    role: parsed.role,
    inviteUrl,
  })

  return { success: true, invitationId: invitation.id }
}

/** Sends the invitation email via Trigger.dev or falls back to direct Resend. */
export async function sendInvitationEmail(payload: {
  email: string
  organizationName: string
  role: "owner" | "staff"
  inviteUrl: string
}) {
  if (process.env.TRIGGER_SECRET_KEY) {
    const { tasks } = await import("@trigger.dev/sdk")
    await tasks.trigger("send-invitation-email", payload)
  } else {
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { getEmailFrom } = await import("@/lib/email-templates")

    const roleLabel = payload.role === "owner" ? "an owner" : "a staff member"

    await resend.emails.send({
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
          <p style="color:#a3a3a3;font-size:13px;margin-top:24px;">This invitation expires in 7 days.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
          <p style="color:#a3a3a3;font-size:12px;">Loyalshy — Digital Wallet Passes</p>
        </div>
      `,
    })
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
    where: { token },
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

// ─── Accept Invitation ──────────────────────────────────────

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  userId: z.string().min(1),
})

export async function acceptStaffInvitation(input: z.infer<typeof acceptInvitationSchema>) {
  const parsed = acceptInvitationSchema.parse(input)

  const invitation = await db.staffInvitation.findUnique({
    where: { token: parsed.token },
  })

  if (!invitation || invitation.accepted || invitation.expiresAt < new Date()) {
    return { error: "Invalid or expired invitation" }
  }

  // Verify the accepting user's email matches the invitation email
  const user = await db.user.findUnique({
    where: { id: parsed.userId },
    select: { email: true },
  })

  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return { error: "This invitation was sent to a different email address" }
  }

  // Mark invitation as accepted and add user as org member
  await db.$transaction([
    db.staffInvitation.update({
      where: { id: invitation.id },
      data: { accepted: true },
    }),
    db.member.create({
      data: {
        userId: parsed.userId,
        organizationId: invitation.organizationId,
        role: invitation.role === "OWNER" ? "owner" : "member",
      },
    }),
  ])

  return { success: true, organizationId: invitation.organizationId }
}

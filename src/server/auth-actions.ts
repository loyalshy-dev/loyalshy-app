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

  // Dispatch invitation email via Trigger.dev
  const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${token}`

  import("@trigger.dev/sdk")
    .then(({ tasks }) =>
      tasks.trigger("send-invitation-email", {
        email: parsed.email,
        organizationName: org?.name ?? "An organization",
        role: parsed.role,
        inviteUrl,
      })
    )
    .catch((err: unknown) => console.error("Email dispatch failed:", err instanceof Error ? err.message : "Unknown error"))

  return { success: true, invitationId: invitation.id }
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

"use server"

import { z } from "zod"
import crypto from "crypto"
import { addDays } from "date-fns"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { assertRestaurantRole } from "@/lib/dal"
import { publicFormLimiter } from "@/lib/rate-limit"

// ─── Schemas ────────────────────────────────────────────────

const sendInvitationSchema = z.object({
  restaurantId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["owner", "staff"]),
})

// ─── Send Staff Invitation ──────────────────────────────────

export async function sendStaffInvitation(input: z.infer<typeof sendInvitationSchema>) {
  const parsed = sendInvitationSchema.parse(input)

  // Only owners can invite staff
  await assertRestaurantRole(parsed.restaurantId, "owner")

  // Check for existing pending invitation
  const existing = await db.staffInvitation.findFirst({
    where: {
      restaurantId: parsed.restaurantId,
      email: parsed.email,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
  })

  if (existing) {
    return { error: "An invitation has already been sent to this email" }
  }

  // Check if user is already a member
  const restaurant = await db.restaurant.findUnique({
    where: { id: parsed.restaurantId },
    include: { users: { where: { email: parsed.email } } },
  })

  if (restaurant?.users.length) {
    return { error: "This user is already a member of your restaurant" }
  }

  // Generate invitation token
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = addDays(new Date(), 7)

  const invitation = await db.staffInvitation.create({
    data: {
      restaurantId: parsed.restaurantId,
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
        restaurantName: restaurant?.name ?? "A restaurant",
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
    include: { restaurant: true },
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
      restaurantName: invitation.restaurant.name,
      restaurantId: invitation.restaurantId,
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

  // Mark invitation as accepted and link user to restaurant
  await db.$transaction([
    db.staffInvitation.update({
      where: { id: invitation.id },
      data: { accepted: true },
    }),
    db.user.update({
      where: { id: parsed.userId },
      data: { restaurantId: invitation.restaurantId },
    }),
  ])

  return { success: true, restaurantId: invitation.restaurantId }
}

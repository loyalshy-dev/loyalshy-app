"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertAuthenticated } from "@/lib/dal"
import { sanitizeText } from "@/lib/sanitize"

// ─── Schemas ────────────────────────────────────────────────

const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100),
})

// ─── Auth Helpers ────────────────────────────────────────────

/**
 * Returns the organizationId for the current user (owner of their first/only org).
 * Replaces the old User.organizationId field which no longer exists.
 */
async function getUserOrganizationId(userId: string): Promise<string | null> {
  const member = await db.member.findFirst({
    where: { userId, role: "owner" },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  })
  return member?.organizationId ?? null
}

// ─── Slug Helpers ───────────────────────────────────────────

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

  // Check if base slug is available
  const existing = await db.organization.findUnique({ where: { slug: base } })
  if (!existing) return base

  // Append random suffix
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

// ─── Create Organization ─────────────────────────────────────

export async function createOrganization(input: z.input<typeof createOrganizationSchema>) {
  const session = await assertAuthenticated()

  try {
    const parsed = createOrganizationSchema.parse(input)

    // Check if user already has an organization
    const existingOrgId = await getUserOrganizationId(session.user.id)
    if (existingOrgId) {
      // Ensure activeOrganizationId is set on the session so dashboard layout works
      if (!session.session.activeOrganizationId) {
        await db.session.updateMany({
          where: { userId: session.user.id },
          data: { activeOrganizationId: existingOrgId },
        })
      }
      return { organizationId: existingOrgId }
    }

    const name = sanitizeText(parsed.name, 100)
    const slug = await generateUniqueSlug(name)

    // Create Organization + Member in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Create organization — free tier starts as FREE/ACTIVE with no Stripe customer
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          plan: "FREE",
          subscriptionStatus: "ACTIVE",
          settings: { onboardingComplete: true },
        },
      })

      // 2. Create member (owner role)
      await tx.member.create({
        data: {
          userId: session.user.id,
          organizationId: organization.id,
          role: "owner",
        },
      })

      return organization
    })

    // Set the new organization as the active organization on the session
    await db.session.updateMany({
      where: { userId: session.user.id },
      data: { activeOrganizationId: result.id },
    })

    // Dispatch welcome email via Trigger.dev (non-blocking). Idempotency key
    // dedupes both the trigger and the Resend send so a Trigger.dev retry can't
    // mail the new owner twice.
    const welcomeIdempotencyKey = `welcome:${result.id}`
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger(
          "send-welcome-email",
          {
            email: session.user.email,
            ownerName: session.user.name,
            organizationName: name,
            organizationSlug: slug,
            idempotencyKey: welcomeIdempotencyKey,
          },
          { idempotencyKey: welcomeIdempotencyKey },
        )
      )
      .catch(() => {})

    return { organizationId: result.id }
  } catch (error) {
    console.error("[createOrganization] Failed:", error instanceof Error ? error.message : error)
    return { error: "Failed to create organization. Please try again." }
  }
}

// ─── Onboarding Checklist ──────────────────────────────────

export type OnboardingChecklistData = {
  hasLogo: boolean
  hasProgram: boolean
  hasQrPrinted: boolean
  hasContact: boolean
  hasStaff: boolean
  isDismissed: boolean
}

export async function getOnboardingChecklist(organizationId: string): Promise<OnboardingChecklistData> {
  // Verify the requesting user owns this organization
  const session = await assertAuthenticated()
  const userOrgId = await getUserOrganizationId(session.user.id)
  if (userOrgId !== organizationId) {
    return {
      hasLogo: false,
      hasProgram: false,
      hasQrPrinted: false,
      hasContact: false,
      hasStaff: false,
      isDismissed: true,
    }
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      logo: true,
      slug: true,
      settings: true,
      _count: { select: { contacts: true } },
    },
  })

  if (!organization) {
    return {
      hasLogo: false,
      hasProgram: false,
      hasQrPrinted: false,
      hasContact: false,
      hasStaff: false,
      isDismissed: true,
    }
  }

  const settings = (organization.settings as Record<string, unknown>) ?? {}

  // Check if user has created at least one program
  const programCount = await db.passTemplate.count({
    where: { organizationId },
  })

  // Check staff count (members on the organization)
  const memberCount = await db.member.count({
    where: { organizationId },
  })

  return {
    hasLogo: !!organization.logo,
    hasProgram: programCount > 0,
    hasQrPrinted: settings.qrPrinted === true,
    hasContact: organization._count.contacts > 0,
    hasStaff: memberCount > 1,
    isDismissed: settings.onboardingDismissed === true,
  }
}

export async function dismissOnboardingChecklist(organizationId: string) {
  const session = await assertAuthenticated()

  const userOrgId = await getUserOrganizationId(session.user.id)
  if (userOrgId !== organizationId) {
    return { error: "Unauthorized" }
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })

  const currentSettings = (organization?.settings as Record<string, unknown>) ?? {}

  await db.organization.update({
    where: { id: organizationId },
    data: {
      settings: { ...currentSettings, onboardingDismissed: true },
    },
  })

  revalidatePath("/dashboard")
  return { success: true }
}

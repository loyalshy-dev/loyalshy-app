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

    // Create Organization + PassTemplate + PassDesign + Member in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Create organization — free tier starts as STARTER/ACTIVE with no Stripe customer
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

      // 3. Create default stamp card pass template
      const passTemplate = await tx.passTemplate.create({
        data: {
          organizationId: organization.id,
          name: "Stamp Card",
          passType: "STAMP_CARD",
          config: {
            visitsRequired: 10,
            rewardDescription: "Free reward",
            rewardExpiryDays: 90,
          },
          status: "ACTIVE",
        },
      })

      // 4. Create default pass design linked to the pass template
      await tx.passDesign.create({
        data: {
          passTemplateId: passTemplate.id,
          cardType: "STAMP",
        },
      })

      return organization
    })

    // Set the new organization as the active organization on the session
    await db.session.updateMany({
      where: { userId: session.user.id },
      data: { activeOrganizationId: result.id },
    })

    // Dispatch welcome email via Trigger.dev (non-blocking)
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("send-welcome-email", {
          email: session.user.email,
          name: session.user.name,
          organizationName: name,
          slug,
        })
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
  hasCustomTemplate: boolean
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
      hasCustomTemplate: false,
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
      hasCustomTemplate: false,
      hasQrPrinted: false,
      hasContact: false,
      hasStaff: false,
      isDismissed: true,
    }
  }

  const settings = (organization.settings as Record<string, unknown>) ?? {}

  // Check pass template customization
  const template = await db.passTemplate.findFirst({
    where: { organizationId },
    select: { config: true },
  })

  const templateConfig = (template?.config as Record<string, unknown>) ?? {}
  const hasCustomTemplate =
    (templateConfig.stampsRequired !== 10) ||
    (templateConfig.rewardDescription !== "Free reward")

  // Check staff count (members on the organization)
  const memberCount = await db.member.count({
    where: { organizationId },
  })

  return {
    hasLogo: !!organization.logo,
    hasCustomTemplate,
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

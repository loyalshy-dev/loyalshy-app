"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { addDays } from "date-fns"
import { db } from "@/lib/db"
import { assertAuthenticated } from "@/lib/dal"
import { sanitizeText } from "@/lib/sanitize"

// ─── Schemas ────────────────────────────────────────────────

const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100),
  address: z.string().max(200).optional().default(""),
  phone: z.string().max(30).optional().default(""),
  programType: z.enum(["STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID"]).optional().default("STAMP_CARD"),
})

const updateBrandingSchema = z.object({
  organizationId: z.string().min(1),
  brandColor: z.string().max(50).optional().default(""),
})

const applyCardDesignSchema = z.object({
  organizationId: z.string().min(1),
  primaryColor: z.string().min(4).max(9),
  secondaryColor: z.string().min(4).max(9),
  textColor: z.string().min(4).max(9),
  templateId: z.string().max(50).optional(),
  showStrip: z.boolean().optional(),
  patternStyle: z.enum(["NONE", "DOTS", "WAVES", "GEOMETRIC", "CHEVRON", "CROSSHATCH", "DIAMONDS", "CONFETTI", "SOLID_PRIMARY", "SOLID_SECONDARY", "STAMP_GRID"]).optional(),
  progressStyle: z.enum(["NUMBERS", "CIRCLES", "SQUARES", "STARS", "STAMPS", "PERCENTAGE", "REMAINING"]).optional(),
  labelFormat: z.enum(["UPPERCASE", "TITLE_CASE", "LOWERCASE"]).optional(),
  editorConfig: z.record(z.string(), z.unknown()).optional(),
})

const setupPassTemplateSchema = z.object({
  organizationId: z.string().min(1),
  programType: z.enum(["STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID"]).optional().default("STAMP_CARD"),
  visitsRequired: z.number().int().min(1).max(30).optional().default(10),
  rewardDescription: z.string().min(1, "Reward description is required").max(200),
  rewardExpiryDays: z.number().int().min(0).max(365).optional().default(90),
  config: z.record(z.string(), z.unknown()).optional(),
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
  const parsed = createOrganizationSchema.parse(input)

  // Check if user already has an organization
  const existingOrgId = await getUserOrganizationId(session.user.id)
  if (existingOrgId) {
    return { error: "You already have an organization", organizationId: existingOrgId }
  }

  const name = sanitizeText(parsed.name, 100)
  const slug = await generateUniqueSlug(name)

  // Create Organization + PassTemplate + PassDesign + Member in a transaction
  const result = await db.$transaction(async (tx) => {
    // 1. Create organization
    const organization = await tx.organization.create({
      data: {
        name,
        slug,
        address: parsed.address || null,
        phone: parsed.phone || null,
        settings: { onboardingComplete: false },
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

    // 3. Map program type to card type
    const programType = parsed.programType
    const defaultCardType = programType === "COUPON"
      ? "COUPON" as const
      : programType === "MEMBERSHIP"
        ? "TIER" as const
        : programType === "POINTS"
          ? "POINTS" as const
          : "STAMP" as const

    // 4. Create default pass template
    const passTemplate = await tx.passTemplate.create({
      data: {
        organizationId: organization.id,
        name: "Pass Template",
        passType: programType,
        config: {
          visitsRequired: programType === "STAMP_CARD" ? 10 : 1,
          rewardDescription: "Free reward",
          rewardExpiryDays: 90,
        },
        status: "ACTIVE",
      },
    })

    // 5. Create default pass design linked to the pass template
    await tx.passDesign.create({
      data: {
        passTemplateId: passTemplate.id,
        cardType: defaultCardType,
      },
    })

    return organization
  })

  // Set the new organization as the active organization on the session
  await db.session.updateMany({
    where: { userId: session.user.id },
    data: { activeOrganizationId: result.id },
  })

  return { success: true, organizationId: result.id, slug: result.slug }
}

// ─── Update Organization Branding ────────────────────────────

export async function updateOrganizationBranding(input: z.infer<typeof updateBrandingSchema>) {
  const session = await assertAuthenticated()
  const parsed = updateBrandingSchema.parse(input)

  // Verify user owns this organization
  const userOrgId = await getUserOrganizationId(session.user.id)
  if (userOrgId !== parsed.organizationId) {
    return { error: "Unauthorized" }
  }

  await db.organization.update({
    where: { id: parsed.organizationId },
    data: {
      brandColor: parsed.brandColor || null,
    },
  })

  return { success: true }
}

// ─── Upload Onboarding Logo ────────────────────────────────

export async function uploadOnboardingLogo(formData: FormData) {
  const session = await assertAuthenticated()
  const organizationId = formData.get("organizationId") as string
  const file = formData.get("file") as File

  if (!organizationId || !file) {
    return { error: "Missing organization ID or file" }
  }

  // Verify user owns this organization
  const userOrgId = await getUserOrganizationId(session.user.id)
  if (userOrgId !== organizationId) {
    return { error: "Unauthorized" }
  }

  // Validate file
  const maxSize = 2 * 1024 * 1024 // 2MB
  if (file.size > maxSize) {
    return { error: "File must be under 2MB" }
  }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!validTypes.includes(file.type)) {
    return { error: "File must be PNG, JPEG, WebP, or SVG" }
  }

  const { uploadFile } = await import("@/lib/storage")
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const logoUrl = await uploadFile(fileBuffer, `logos/${organizationId}/${file.name}`, file.type)

  await db.organization.update({
    where: { id: organizationId },
    data: { logo: logoUrl },
  })

  // Extract color palette from the uploaded image (non-fatal)
  let palette: import("@/lib/color-extraction").ExtractedPalette | null = null
  try {
    const { extractPaletteFromBuffer } = await import("@/lib/color-extraction")
    const arrayBuffer = await file.arrayBuffer()
    palette = await extractPaletteFromBuffer(Buffer.from(arrayBuffer))
  } catch {
    // Palette extraction is non-fatal — return url without palette
  }

  return { success: true, url: logoUrl, palette }
}

// ─── Setup Pass Template ─────────────────────────────────

export async function setupPassTemplate(input: z.input<typeof setupPassTemplateSchema>) {
  const session = await assertAuthenticated()
  const parsed = setupPassTemplateSchema.parse(input)

  // Verify user owns this organization
  const userOrgId = await getUserOrganizationId(session.user.id)
  if (userOrgId !== parsed.organizationId) {
    return { error: "Unauthorized" }
  }

  // Find the default pass template created during organization setup
  const template = await db.passTemplate.findFirst({
    where: { organizationId: parsed.organizationId },
    include: { passDesign: { select: { id: true } } },
  })

  if (!template) {
    return { error: "Pass template not found" }
  }

  // Map program type to card type
  const programType = parsed.programType
  const cardType = programType === "COUPON"
    ? "COUPON" as const
    : programType === "MEMBERSHIP"
      ? "TIER" as const
      : programType === "POINTS"
        ? "POINTS" as const
        : "STAMP" as const

  const visitsRequired = programType === "STAMP_CARD"
    ? parsed.visitsRequired
    : 1

  await db.$transaction([
    db.passTemplate.update({
      where: { id: template.id },
      data: {
        passType: programType,
        config: {
          ...(template.config as Record<string, unknown> ?? {}),
          visitsRequired,
          rewardDescription: parsed.rewardDescription,
          rewardExpiryDays: parsed.rewardExpiryDays,
          ...(parsed.config ? parsed.config : {}),
        },
      },
    }),
    // Update pass design's cardType to match
    ...(template.passDesign
      ? [db.passDesign.update({
          where: { id: template.passDesign.id },
          data: { cardType },
        })]
      : []),
  ])

  return { success: true }
}

// ─── Initialize Trial Subscription ─────────────────────────

export async function initializeTrialSubscription(organizationId: string) {
  const session = await assertAuthenticated()

  // Verify user owns this organization
  const userOrgId = await getUserOrganizationId(session.user.id)
  if (userOrgId !== organizationId) {
    return { error: "Unauthorized" }
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      name: true,
      slug: true,
    },
  })

  if (!organization) {
    return { error: "Organization not found" }
  }

  // Skip if already has subscription
  if (organization.stripeSubscriptionId) {
    return { success: true, alreadySetup: true }
  }

  try {
    const { stripe } = await import("@/lib/stripe")

    // Create Stripe customer
    let stripeCustomerId = organization.stripeCustomerId
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: organization.name,
        metadata: { organizationId },
      })
      stripeCustomerId = customer.id
    }

    // Find the Starter monthly price
    const prices = await stripe.prices.list({
      lookup_keys: ["starter_monthly"],
      active: true,
      limit: 1,
    })

    const starterPrice = prices.data[0]

    if (!starterPrice) {
      console.error("Starter price lookup key not found in Stripe")
      return { error: "Billing setup failed — starter price not configured. Please contact support." }
    }

    // Create subscription with 14-day trial
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: starterPrice.id }],
      trial_period_days: 14,
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
    })

    const trialEndsAt = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : addDays(new Date(), 14)

    await db.organization.update({
      where: { id: organizationId },
      data: {
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: "TRIALING",
        plan: "STARTER",
        trialEndsAt,
      },
    })

    // Dispatch welcome email via Trigger.dev
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("send-welcome-email", {
          email: session.user.email,
          name: session.user.name,
          organizationName: organization.name,
          slug: organization.slug,
        })
      )
      .catch((err: unknown) => console.error("Email dispatch failed:", err instanceof Error ? err.message : "Unknown error"))

    return { success: true }
  } catch (error) {
    console.error("Failed to initialize trial:", error instanceof Error ? error.message : "Unknown error")
    return { error: "Failed to set up billing. Please try again or contact support." }
  }
}

// ─── Apply Card Design from Brand ─────────────────────────

export async function applyCardDesignFromBrand(input: z.infer<typeof applyCardDesignSchema>) {
  const session = await assertAuthenticated()
  const parsed = applyCardDesignSchema.parse(input)

  // Verify user owns this organization
  const userOrgId = await getUserOrganizationId(session.user.id)
  if (userOrgId !== parsed.organizationId) {
    return { error: "Unauthorized" }
  }

  // Find the default pass template
  const template = await db.passTemplate.findFirst({
    where: { organizationId: parsed.organizationId },
    include: { passDesign: true },
  })

  if (!template?.passDesign) {
    return { error: "Pass design not found" }
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    primaryColor: parsed.primaryColor,
    secondaryColor: parsed.secondaryColor,
    textColor: parsed.textColor,
  }

  if (parsed.templateId) updateData.templateId = parsed.templateId
  if (parsed.showStrip !== undefined) updateData.showStrip = parsed.showStrip
  if (parsed.patternStyle) updateData.patternStyle = parsed.patternStyle
  if (parsed.progressStyle) updateData.progressStyle = parsed.progressStyle
  if (parsed.labelFormat) updateData.labelFormat = parsed.labelFormat
  if (parsed.editorConfig) {
    // Merge with existing editorConfig
    const existing = (template.passDesign.editorConfig as Record<string, unknown>) ?? {}
    updateData.editorConfig = { ...existing, ...parsed.editorConfig }
  }

  await db.$transaction([
    db.passDesign.update({
      where: { id: template.passDesign.id },
      data: updateData,
    }),
    db.organization.update({
      where: { id: parsed.organizationId },
      data: { brandColor: parsed.primaryColor },
    }),
  ])

  revalidatePath("/dashboard")
  return { success: true }
}

// ─── Complete Onboarding ───────────────────────────────────

export async function completeOnboarding(organizationId: string) {
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
      settings: { ...currentSettings, onboardingComplete: true },
    },
  })

  revalidatePath("/dashboard")
  return { success: true }
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
    (templateConfig.visitsRequired !== 10) ||
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

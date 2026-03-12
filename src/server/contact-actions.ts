"use server"

import { z } from "zod"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { db, getNextMemberNumber } from "@/lib/db"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { sanitizeText } from "@/lib/sanitize"
import { parseCouponConfig } from "@/lib/pass-config"
import type { Prisma } from "@prisma/client"
import type { PassInstanceDetail } from "@/types/pass-instance"

// ─── Types ──────────────────────────────────────────────────

export type ContactRow = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  totalInteractions: number
  lastInteractionAt: Date | null
  createdAt: Date
  hasAvailableReward: boolean
  passInstanceCount: number
  primaryPassInstance: {
    templateName: string
    passType: string
    data: unknown
    templateConfig: unknown
  } | null
}

export type ContactListResult = {
  contacts: ContactRow[]
  total: number
  pageCount: number
}

export type ContactDetail = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  totalInteractions: number
  lastInteractionAt: Date | null
  createdAt: Date
  passInstances: PassInstanceDetail[]
  interactions: {
    id: string
    type: string
    createdAt: Date
    registeredBy: string | null
    templateName: string
    passType: string
  }[]
  rewards: {
    id: string
    status: string
    earnedAt: Date
    redeemedAt: Date | null
    expiresAt: Date
    description: string
    templateName: string
  }[]
}

// ─── Validation Schemas ─────────────────────────────────────

const addContactSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100),
  email: z
    .string()
    .email("Invalid email")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal("")),
})

const updateContactSchema = z.object({
  contactId: z.string().min(1),
  fullName: z.string().min(1, "Name is required").max(100),
  email: z
    .string()
    .email("Invalid email")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal("")),
})

// ─── Helpers ────────────────────────────────────────────────

async function requireOrganizationId(): Promise<string> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) redirect("/register?step=2")
  return organization.id
}

// ─── Get Contacts (Paginated, Searchable, Sortable) ────────

export type GetContactsParams = {
  page?: number
  perPage?: number
  search?: string
  sort?: string
  order?: "asc" | "desc"
  hasReward?: string
  passType?: string
}

export async function getContacts(
  params: GetContactsParams
): Promise<ContactListResult> {
  const organizationId = await requireOrganizationId()

  const page = params.page ?? 1
  const perPage = params.perPage ?? 20
  const skip = (page - 1) * perPage
  const search = params.search?.trim() ?? ""
  const sortField = params.sort ?? "createdAt"
  const sortOrder = params.order ?? "desc"
  const hasReward = params.hasReward ?? "all"
  const passType = params.passType ?? "all"

  // Build where clause (exclude soft-deleted)
  const where: Record<string, unknown> = { organizationId, deletedAt: null }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ]
  }

  // Filter by pass type
  const validTypes = ["STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID", "GIFT_CARD", "TICKET", "ACCESS", "TRANSIT", "BUSINESS_ID"]
  if (passType !== "all" && validTypes.includes(passType)) {
    where.passInstances = {
      some: {
        status: "ACTIVE",
        passTemplate: { passType },
      },
    }
  }

  // Map sortable fields
  const allowedSorts: Record<string, string> = {
    fullName: "fullName",
    totalInteractions: "totalInteractions",
    lastInteractionAt: "lastInteractionAt",
    createdAt: "createdAt",
  }
  const orderByField = allowedSorts[sortField] ?? "createdAt"

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where: where as Prisma.ContactWhereInput,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        totalInteractions: true,
        lastInteractionAt: true,
        createdAt: true,
        rewards: {
          where: { status: "AVAILABLE" },
          select: { id: true },
          take: 1,
        },
        passInstances: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            data: true,
            passTemplate: {
              select: {
                name: true,
                passType: true,
                config: true,
              },
            },
          },
          orderBy: { issuedAt: "asc" },
        },
      },
      orderBy: { [orderByField]: sortOrder },
      skip,
      take: perPage,
    }),
    db.contact.count({
      where: where as Prisma.ContactWhereInput,
    }),
  ])

  // Map to ContactRow with pass instance data
  let filtered = contacts.map((c) => {
    const activeInstances = c.passInstances
    const primary = activeInstances[0] ?? null

    return {
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      totalInteractions: c.totalInteractions,
      lastInteractionAt: c.lastInteractionAt,
      createdAt: c.createdAt,
      hasAvailableReward: c.rewards.length > 0,
      passInstanceCount: activeInstances.length,
      primaryPassInstance: primary
        ? {
            templateName: primary.passTemplate.name,
            passType: primary.passTemplate.passType,
            data: primary.data,
            templateConfig: primary.passTemplate.config,
          }
        : null,
    }
  })

  if (hasReward === "yes") {
    filtered = filtered.filter((c) => c.hasAvailableReward)
  } else if (hasReward === "no") {
    filtered = filtered.filter((c) => !c.hasAvailableReward)
  }

  return {
    contacts: filtered,
    total: hasReward !== "all" ? filtered.length : total,
    pageCount: Math.ceil(
      (hasReward !== "all" ? filtered.length : total) / perPage
    ),
  }
}

// ─── Get Contact Detail ────────────────────────────────────

export async function getContactDetail(
  contactId: string
): Promise<ContactDetail | null> {
  const organizationId = await requireOrganizationId()

  const contact = await db.contact.findFirst({
    where: { id: contactId, organizationId, deletedAt: null },
    include: {
      passInstances: {
        include: {
          passTemplate: {
            select: {
              id: true,
              name: true,
              passType: true,
              config: true,
              status: true,
              passDesign: {
                select: {
                  cardType: true,
                  primaryColor: true,
                  secondaryColor: true,
                  textColor: true,
                  showStrip: true,
                  patternStyle: true,
                  progressStyle: true,
                  labelFormat: true,
                  customProgressLabel: true,
                  stripImageUrl: true,
                  editorConfig: true,
                  logoUrl: true,
                  logoAppleUrl: true,
                  logoGoogleUrl: true,
                },
              },
            },
          },
        },
        orderBy: { issuedAt: "asc" },
      },
      interactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          createdAt: true,
          performedBy: { select: { name: true } },
          passTemplate: { select: { name: true, passType: true } },
        },
      },
      rewards: {
        orderBy: { earnedAt: "desc" },
        select: {
          id: true,
          status: true,
          description: true,
          earnedAt: true,
          redeemedAt: true,
          expiresAt: true,
          passTemplate: { select: { name: true } },
        },
      },
    },
  })

  if (!contact) return null

  const passInstances: PassInstanceDetail[] = contact.passInstances.map((pi) => ({
    passInstanceId: pi.id,
    templateId: pi.passTemplate.id,
    templateName: pi.passTemplate.name,
    passType: pi.passTemplate.passType,
    templateStatus: pi.passTemplate.status,
    data: pi.data as import("@/types/pass-instance").PassInstanceData,
    templateConfig: pi.passTemplate.config,
    status: pi.status,
    walletProvider: pi.walletProvider,
    issuedAt: pi.issuedAt,
    suspendedAt: pi.suspendedAt,
    expiresAt: pi.expiresAt,
    revokedAt: pi.revokedAt,
    passDesign: pi.passTemplate.passDesign
      ? {
          cardType: pi.passTemplate.passDesign.cardType,
          primaryColor: pi.passTemplate.passDesign.primaryColor,
          secondaryColor: pi.passTemplate.passDesign.secondaryColor,
          textColor: pi.passTemplate.passDesign.textColor,
          showStrip: pi.passTemplate.passDesign.showStrip,
          patternStyle: pi.passTemplate.passDesign.patternStyle,
          progressStyle: pi.passTemplate.passDesign.progressStyle,
          labelFormat: pi.passTemplate.passDesign.labelFormat,
          customProgressLabel: pi.passTemplate.passDesign.customProgressLabel,
          stripImageUrl: pi.passTemplate.passDesign.stripImageUrl,
          editorConfig: pi.passTemplate.passDesign.editorConfig,
          logoUrl: pi.passTemplate.passDesign.logoUrl,
          logoAppleUrl: pi.passTemplate.passDesign.logoAppleUrl,
          logoGoogleUrl: pi.passTemplate.passDesign.logoGoogleUrl,
        }
      : null,
  }))

  return {
    id: contact.id,
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    totalInteractions: contact.totalInteractions,
    lastInteractionAt: contact.lastInteractionAt,
    createdAt: contact.createdAt,
    passInstances,
    interactions: contact.interactions.map((i) => ({
      id: i.id,
      type: i.type,
      createdAt: i.createdAt,
      registeredBy: i.performedBy?.name ?? null,
      templateName: i.passTemplate.name,
      passType: i.passTemplate.passType,
    })),
    rewards: contact.rewards.map((r) => ({
      id: r.id,
      status: r.status,
      earnedAt: r.earnedAt,
      redeemedAt: r.redeemedAt,
      expiresAt: r.expiresAt,
      description: r.description ?? r.passTemplate.name,
      templateName: r.passTemplate.name,
    })),
  }
}

// ─── Add Contact ───────────────────────────────────────────

export type AddContactResult = {
  success: boolean
  contactId?: string
  error?: string
  duplicateField?: "email" | "phone"
}

export async function addContact(
  formData: FormData
): Promise<AddContactResult> {
  const organizationId = await requireOrganizationId()

  // Check plan contact limit
  const { checkContactLimit } = await import("@/server/billing-actions")
  const limitCheck = await checkContactLimit(organizationId)
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: `You've reached the ${limitCheck.limit} contact limit for your plan. Upgrade to add more contacts.`,
    }
  }

  const raw = {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
  }

  const parsed = addContactSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const fullName = sanitizeText(parsed.data.fullName, 100)
  const cleanEmail = parsed.data.email ? sanitizeText(parsed.data.email, 255) || null : null
  const cleanPhone = parsed.data.phone ? sanitizeText(parsed.data.phone, 30) || null : null

  // Duplicate detection (exclude soft-deleted)
  if (cleanEmail) {
    const existing = await db.contact.findFirst({
      where: { organizationId, email: cleanEmail, deletedAt: null },
      select: { id: true },
    })
    if (existing) {
      return {
        success: false,
        error: `A contact with email "${cleanEmail}" already exists.`,
        duplicateField: "email",
      }
    }
  }

  if (cleanPhone) {
    const existing = await db.contact.findFirst({
      where: { organizationId, phone: cleanPhone, deletedAt: null },
      select: { id: true },
    })
    if (existing) {
      return {
        success: false,
        error: `A contact with phone "${cleanPhone}" already exists.`,
        duplicateField: "phone",
      }
    }
  }

  // Create contact and auto-issue passes for all active templates
  const memberNumber = await getNextMemberNumber(organizationId)
  const contact = await db.contact.create({
    data: {
      organizationId,
      fullName,
      email: cleanEmail,
      phone: cleanPhone,
      memberNumber,
    },
    select: { id: true },
  })

  // Fetch all active pass templates for this organization
  const activeTemplates = await db.passTemplate.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { id: true, passType: true, config: true },
  })

  // Auto-issue pass instances for all active templates
  if (activeTemplates.length > 0) {
    await db.passInstance.createMany({
      data: activeTemplates.map((template) => ({
        contactId: contact.id,
        passTemplateId: template.id,
      })),
    })

    // Auto-create rewards for COUPON templates
    const couponTemplates = activeTemplates.filter((t) => t.passType === "COUPON")
    if (couponTemplates.length > 0) {
      // Fetch the newly created pass instances for coupon templates
      const couponInstances = await db.passInstance.findMany({
        where: {
          contactId: contact.id,
          passTemplateId: { in: couponTemplates.map((t) => t.id) },
        },
        select: { id: true, passTemplateId: true },
      })

      for (const instance of couponInstances) {
        const template = couponTemplates.find((t) => t.id === instance.passTemplateId)
        if (!template) continue

        const couponConfig = parseCouponConfig(template.config)
        const rewardExpiryDays = (template.config as Record<string, unknown>)?.rewardExpiryDays as number | undefined
        const expiresAt = couponConfig?.validUntil
          ? new Date(couponConfig.validUntil)
          : rewardExpiryDays && rewardExpiryDays > 0
            ? new Date(Date.now() + rewardExpiryDays * 86_400_000)
            : new Date(Date.now() + 365 * 86_400_000) // default 1 year

        await db.reward.create({
          data: {
            contactId: contact.id,
            organizationId,
            passTemplateId: template.id,
            passInstanceId: instance.id,
            status: "AVAILABLE",
            expiresAt,
          },
        })
      }
    }
  }

  revalidatePath("/dashboard/contacts")
  revalidatePath("/dashboard")

  return { success: true, contactId: contact.id }
}

// ─── Update Contact ────────────────────────────────────────

export type UpdateContactResult = {
  success: boolean
  error?: string
  duplicateField?: "email" | "phone"
}

export async function updateContact(
  formData: FormData
): Promise<UpdateContactResult> {
  const organizationId = await requireOrganizationId()

  const raw = {
    contactId: formData.get("contactId") as string,
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
  }

  const parsed = updateContactSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const contactId = parsed.data.contactId
  const fullName = sanitizeText(parsed.data.fullName, 100)
  const cleanEmail = parsed.data.email ? sanitizeText(parsed.data.email, 255) || null : null
  const cleanPhone = parsed.data.phone ? sanitizeText(parsed.data.phone, 30) || null : null

  // Verify contact belongs to this organization (exclude soft-deleted)
  const existing = await db.contact.findFirst({
    where: { id: contactId, organizationId, deletedAt: null },
    select: { id: true, email: true, phone: true },
  })

  if (!existing) {
    return { success: false, error: "Contact not found" }
  }

  // Duplicate detection (skip if unchanged, exclude soft-deleted)
  if (cleanEmail && cleanEmail !== existing.email) {
    const dup = await db.contact.findFirst({
      where: { organizationId, email: cleanEmail, deletedAt: null, NOT: { id: contactId } },
      select: { id: true },
    })
    if (dup) {
      return {
        success: false,
        error: `A contact with email "${cleanEmail}" already exists.`,
        duplicateField: "email",
      }
    }
  }

  if (cleanPhone && cleanPhone !== existing.phone) {
    const dup = await db.contact.findFirst({
      where: { organizationId, phone: cleanPhone, deletedAt: null, NOT: { id: contactId } },
      select: { id: true },
    })
    if (dup) {
      return {
        success: false,
        error: `A contact with phone "${cleanPhone}" already exists.`,
        duplicateField: "phone",
      }
    }
  }

  await db.contact.update({
    where: { id: contactId },
    data: { fullName, email: cleanEmail, phone: cleanPhone },
  })

  revalidatePath("/dashboard/contacts")
  revalidatePath("/dashboard")

  return { success: true }
}

// ─── Delete Contact ────────────────────────────────────────

export async function deleteContact(
  contactId: string
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await requireOrganizationId()

  const contact = await db.contact.findFirst({
    where: { id: contactId, organizationId, deletedAt: null },
    select: { id: true },
  })

  if (!contact) {
    return { success: false, error: "Contact not found" }
  }

  // Soft delete
  await db.contact.update({
    where: { id: contactId },
    data: { deletedAt: new Date() },
  })

  revalidatePath("/dashboard/contacts")
  revalidatePath("/dashboard")

  return { success: true }
}

// ─── Export Contacts CSV ───────────────────────────────────

export async function exportContactsCSV(): Promise<string> {
  const organizationId = await requireOrganizationId()

  const contacts = await db.contact.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      fullName: true,
      email: true,
      phone: true,
      totalInteractions: true,
      lastInteractionAt: true,
      createdAt: true,
      passInstances: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const headers = [
    "Name",
    "Email",
    "Phone",
    "Total Interactions",
    "Active Passes",
    "Last Interaction",
    "Joined",
  ]

  const rows = contacts.map((c) => [
    `"${c.fullName.replace(/"/g, '""')}"`,
    c.email ?? "",
    c.phone ?? "",
    c.totalInteractions.toString(),
    c.passInstances.length.toString(),
    c.lastInteractionAt?.toISOString() ?? "",
    c.createdAt.toISOString(),
  ])

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
}

// ─── Export Contact Data (GDPR) ────────────────────────────

export async function exportContactData(contactId: string) {
  const organizationId = await requireOrganizationId()

  // Owner-only for GDPR data export
  await assertOrganizationRole(organizationId, "owner")

  const contact = await db.contact.findFirst({
    where: { id: contactId, organizationId },
    include: {
      passInstances: {
        include: {
          passTemplate: {
            select: {
              id: true,
              name: true,
              config: true,
              status: true,
            },
          },
        },
        orderBy: { issuedAt: "asc" },
      },
      interactions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          createdAt: true,
          passTemplate: { select: { name: true } },
        },
      },
      rewards: {
        orderBy: { earnedAt: "desc" },
        select: {
          id: true,
          status: true,
          earnedAt: true,
          redeemedAt: true,
          expiresAt: true,
          passTemplate: { select: { name: true } },
        },
      },
    },
  })

  if (!contact) {
    return { error: "Contact not found" }
  }

  return {
    contact: {
      id: contact.id,
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      totalInteractions: contact.totalInteractions,
      lastInteractionAt: contact.lastInteractionAt,
      deletedAt: contact.deletedAt,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    },
    passInstances: contact.passInstances.map((pi) => ({
      id: pi.id,
      templateName: pi.passTemplate.name,
      templateStatus: pi.passTemplate.status,
      data: pi.data,
      walletProvider: pi.walletProvider,
      status: pi.status,
      issuedAt: pi.issuedAt,
    })),
    interactions: contact.interactions.map((i) => ({
      id: i.id,
      type: i.type,
      createdAt: i.createdAt,
      templateName: i.passTemplate.name,
    })),
    rewards: contact.rewards.map((r) => ({
      id: r.id,
      status: r.status,
      earnedAt: r.earnedAt,
      redeemedAt: r.redeemedAt,
      expiresAt: r.expiresAt,
      templateName: r.passTemplate.name,
    })),
  }
}

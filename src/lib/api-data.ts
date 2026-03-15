import "server-only"

import { randomUUID } from "crypto"
import { db, getNextMemberNumber } from "@/lib/db"
import { sanitizeText } from "@/lib/sanitize"
import { buildCardUrl } from "@/lib/card-access"
import {
  buildWalletDownloadUrl,
  buildPassIssuedEmailHtml,
  getEmailFrom,
} from "@/lib/email-templates"
import {
  parseCouponConfig,
  parsePrepaidConfig,
  parseMembershipConfig,
  computeMembershipExpiresAt,
  parseMinigameConfig,
  weightedRandomPrize,
  parseGiftCardConfig,
  parseAccessConfig,
  parseBusinessIdConfig,
  parseTransitConfig,
  parseTicketConfig,
  parsePointsConfig,
  parseStampCardConfig,
  computeDurationExpiresAt,
  formatCouponValue,
} from "@/lib/pass-config"
import type { Prisma } from "@prisma/client"

// ─── Contacts: Query List ──────────────────────────────────

export type ContactListParams = {
  page: number
  perPage: number
  search?: string
  sort: string
  order: "asc" | "desc"
  passType?: string
}

export type ContactListResult = {
  contacts: Array<{
    id: string
    fullName: string
    email: string | null
    phone: string | null
    memberNumber: number
    totalInteractions: number
    lastInteractionAt: Date | null
    metadata: unknown
    createdAt: Date
    _count: { passInstances: number }
  }>
  total: number
  pageCount: number
}

export async function queryContacts(
  organizationId: string,
  params: ContactListParams
): Promise<ContactListResult> {
  const { page, perPage, search, sort, order, passType } = params
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = { organizationId, deletedAt: null }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ]
  }

  if (passType) {
    where.passInstances = {
      some: { status: "ACTIVE", passTemplate: { passType } },
    }
  }

  const allowedSorts: Record<string, string> = {
    fullName: "fullName",
    totalInteractions: "totalInteractions",
    lastInteractionAt: "lastInteractionAt",
    createdAt: "createdAt",
  }
  const orderByField = allowedSorts[sort] ?? "createdAt"

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where: where as Prisma.ContactWhereInput,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        memberNumber: true,
        totalInteractions: true,
        lastInteractionAt: true,
        metadata: true,
        createdAt: true,
        _count: { select: { passInstances: true } },
      },
      orderBy: { [orderByField]: order },
      skip,
      take: perPage,
    }),
    db.contact.count({ where: where as Prisma.ContactWhereInput }),
  ])

  return {
    contacts,
    total,
    pageCount: Math.ceil(total / perPage),
  }
}

// ─── Contacts: Query Detail ────────────────────────────────

export async function queryContactDetail(
  organizationId: string,
  contactId: string
) {
  return db.contact.findFirst({
    where: { id: contactId, organizationId, deletedAt: null },
    include: {
      passInstances: {
        include: {
          passTemplate: {
            select: { id: true, name: true, passType: true },
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
        },
      },
    },
  })
}

// ─── Contacts: Create ──────────────────────────────────────

export type CreateContactData = {
  fullName: string
  email?: string | null
  phone?: string | null
  metadata?: Record<string, unknown>
}

export type CreateContactResult =
  | { success: true; contactId: string }
  | { success: false; error: string; duplicateField?: "email" | "phone" }

export async function createContact(
  organizationId: string,
  data: CreateContactData
): Promise<CreateContactResult> {
  const fullName = sanitizeText(data.fullName, 100)
  const cleanEmail = data.email ? sanitizeText(data.email, 255) || null : null
  const cleanPhone = data.phone ? sanitizeText(data.phone, 30) || null : null

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

  const memberNumber = await getNextMemberNumber(organizationId)
  const contact = await db.contact.create({
    data: {
      organizationId,
      fullName,
      email: cleanEmail,
      phone: cleanPhone,
      memberNumber,
      ...(data.metadata ? { metadata: data.metadata as Prisma.JsonObject } : {}),
    },
    select: { id: true },
  })

  // Auto-issue pass instances for all active templates
  const activeTemplates = await db.passTemplate.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { id: true, passType: true, config: true },
  })

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
        const rewardExpiryDays = (template.config as Record<string, unknown>)
          ?.rewardExpiryDays as number | undefined
        const expiresAt = couponConfig?.validUntil
          ? new Date(couponConfig.validUntil)
          : rewardExpiryDays && rewardExpiryDays > 0
            ? new Date(Date.now() + rewardExpiryDays * 86_400_000)
            : new Date(Date.now() + 365 * 86_400_000)

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

  return { success: true, contactId: contact.id }
}

// ─── Contacts: Find or Create (for API inline contact) ────

export type FindOrCreateContactResult = {
  contactId: string
  created: boolean
}

export async function findOrCreateContact(
  organizationId: string,
  data: { fullName: string; email?: string; phone?: string }
): Promise<FindOrCreateContactResult> {
  const fullName = sanitizeText(data.fullName, 100)
  const cleanEmail = data.email ? sanitizeText(data.email, 255) || null : null
  const cleanPhone = data.phone ? sanitizeText(data.phone, 30) || null : null

  // Look up existing contact by email first, then phone
  if (cleanEmail) {
    const existing = await db.contact.findFirst({
      where: { organizationId, email: cleanEmail, deletedAt: null },
      select: { id: true },
    })
    if (existing) return { contactId: existing.id, created: false }
  }

  if (cleanPhone) {
    const existing = await db.contact.findFirst({
      where: { organizationId, phone: cleanPhone, deletedAt: null },
      select: { id: true },
    })
    if (existing) return { contactId: existing.id, created: false }
  }

  // Create new contact (no auto-issue for all templates — only the specific pass will be issued)
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

  return { contactId: contact.id, created: true }
}

// ─── Pass Email Sending (for API) ─────────────────────────

const PASS_TYPE_LABELS: Record<string, string> = {
  STAMP_CARD: "Stamp Card",
  COUPON: "Coupon",
  MEMBERSHIP: "Membership Card",
  POINTS: "Points Card",
  PREPAID: "Prepaid Card",
  GIFT_CARD: "Gift Card",
  TICKET: "Ticket",
  ACCESS: "Access Pass",
  TRANSIT: "Transit Pass",
  BUSINESS_ID: "Business ID",
}

export type WalletUrls = {
  cardUrl: string
  appleWalletUrl: string | null
  googleWalletUrl: string
}

export async function buildWalletUrls(
  passInstanceId: string,
  organizationId: string
): Promise<WalletUrls> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  })
  const slug = org?.slug ?? ""
  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"

  const cardUrl = `${baseUrl}${buildCardUrl(slug, passInstanceId)}`
  const googleWalletUrl = `${baseUrl}${buildWalletDownloadUrl(passInstanceId, "google")}`

  // Check if Apple pass already exists on R2
  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    select: { walletProvider: true, walletPassId: true },
  })

  let appleWalletUrl: string | null = null
  if (passInstance?.walletProvider === "APPLE" || passInstance?.walletPassId) {
    // Apple pass was generated — use R2 URL
    const r2Url = process.env.R2_PUBLIC_URL ?? "https://pub-7c8a43a8edf44acb9ce148cb7547aa00.r2.dev"
    appleWalletUrl = `${r2Url.replace(/\/$/, "")}/passes/${passInstanceId}.pkpass`
  }

  return { cardUrl, appleWalletUrl, googleWalletUrl }
}

export async function sendPassIssuedEmail(
  passInstanceId: string,
  organizationId: string
): Promise<{ emailSent: boolean }> {
  try {
    const passInstance = await db.passInstance.findFirst({
      where: { id: passInstanceId, passTemplate: { organizationId } },
      select: {
        id: true,
        contact: { select: { fullName: true, email: true } },
        passTemplate: {
          select: {
            name: true,
            passType: true,
            organization: { select: { name: true, slug: true } },
          },
        },
      },
    })

    if (!passInstance?.contact.email) return { emailSent: false }

    const { contact, passTemplate: template } = passInstance
    const org = template.organization
    const passTypeLabel = PASS_TYPE_LABELS[template.passType] ?? "Pass"
    const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"

    const cardUrl = buildCardUrl(org.slug, passInstanceId)
    const googleWalletUrl = buildWalletDownloadUrl(passInstanceId, "google")

    // Generate Apple pass and upload to R2
    const { generateApplePassForEmail } = await import(
      "@/lib/wallet/generate-pass-for-email"
    )
    const applePass = await generateApplePassForEmail(passInstanceId)

    if (process.env.TRIGGER_SECRET_KEY) {
      const { tasks } = await import("@trigger.dev/sdk")
      await tasks.trigger("send-pass-issued-email", {
        email: contact.email,
        contactName: contact.fullName,
        organizationName: org.name,
        templateName: template.name,
        passTypeLabel,
        cardUrl,
        appleWalletUrl: applePass?.url,
        googleWalletUrl,
      })
    } else {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)

      await resend.emails.send({
        from: getEmailFrom(),
        to: contact.email!,
        subject: `Your ${passTypeLabel} from ${org.name}`,
        html: buildPassIssuedEmailHtml({
          contactName: contact.fullName,
          organizationName: org.name,
          templateName: template.name,
          passTypeLabel,
          cardUrl: `${baseUrl}${cardUrl}`,
          appleWalletUrl: applePass?.url,
          googleWalletUrl: `${baseUrl}${googleWalletUrl}`,
        }),
      })
    }

    return { emailSent: true }
  } catch (err) {
    console.error(
      "API: Failed to send pass issued email:",
      err instanceof Error ? err.message : "Unknown error"
    )
    return { emailSent: false }
  }
}

// ─── Contacts: Update ──────────────────────────────────────

export type UpdateContactData = {
  fullName?: string
  email?: string | null
  phone?: string | null
  metadata?: Record<string, unknown>
}

export type UpdateContactResult =
  | { success: true }
  | { success: false; error: string; duplicateField?: "email" | "phone" }

export async function updateContact(
  organizationId: string,
  contactId: string,
  data: UpdateContactData
): Promise<UpdateContactResult> {
  const existing = await db.contact.findFirst({
    where: { id: contactId, organizationId, deletedAt: null },
    select: { id: true, email: true, phone: true },
  })

  if (!existing) {
    return { success: false, error: "Contact not found" }
  }

  const fullName = data.fullName ? sanitizeText(data.fullName, 100) : undefined
  const cleanEmail =
    data.email !== undefined
      ? data.email
        ? sanitizeText(data.email, 255) || null
        : null
      : undefined
  const cleanPhone =
    data.phone !== undefined
      ? data.phone
        ? sanitizeText(data.phone, 30) || null
        : null
      : undefined

  // Duplicate detection (skip if unchanged)
  if (cleanEmail && cleanEmail !== existing.email) {
    const dup = await db.contact.findFirst({
      where: {
        organizationId,
        email: cleanEmail,
        deletedAt: null,
        NOT: { id: contactId },
      },
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
      where: {
        organizationId,
        phone: cleanPhone,
        deletedAt: null,
        NOT: { id: contactId },
      },
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

  const updateData: Prisma.ContactUpdateInput = {}
  if (fullName !== undefined) updateData.fullName = fullName
  if (cleanEmail !== undefined) updateData.email = cleanEmail
  if (cleanPhone !== undefined) updateData.phone = cleanPhone
  if (data.metadata !== undefined) updateData.metadata = data.metadata as Prisma.JsonObject

  await db.contact.update({
    where: { id: contactId },
    data: updateData,
  })

  return { success: true }
}

// ─── Contacts: Soft Delete ─────────────────────────────────

export async function softDeleteContact(
  organizationId: string,
  contactId: string
): Promise<{ success: boolean; error?: string }> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, organizationId, deletedAt: null },
    select: { id: true },
  })

  if (!contact) {
    return { success: false, error: "Contact not found" }
  }

  await db.contact.update({
    where: { id: contactId },
    data: { deletedAt: new Date() },
  })

  return { success: true }
}

// ─── Templates: Query List ─────────────────────────────────

export type TemplateListParams = {
  page: number
  perPage: number
  status?: string
  passType?: string
}

export async function queryTemplates(
  organizationId: string,
  params: TemplateListParams
) {
  const { page, perPage, status, passType } = params
  const skip = (page - 1) * perPage

  const where: Prisma.PassTemplateWhereInput = { organizationId }
  if (status) where.status = status as Prisma.EnumTemplateStatusFilter
  if (passType) where.passType = passType as Prisma.EnumPassTypeFilter

  const [templates, total] = await Promise.all([
    db.passTemplate.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        passType: true,
        joinMode: true,
        status: true,
        config: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        _count: { select: { passInstances: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    db.passTemplate.count({ where }),
  ])

  return { templates, total, pageCount: Math.ceil(total / perPage) }
}

// ─── Templates: Query Detail ───────────────────────────────

export async function queryTemplateDetail(
  organizationId: string,
  templateId: string
) {
  const template = await db.passTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: {
      id: true,
      name: true,
      description: true,
      passType: true,
      joinMode: true,
      status: true,
      config: true,
      startsAt: true,
      endsAt: true,
      termsAndConditions: true,
      createdAt: true,
      _count: { select: { passInstances: true } },
    },
  })

  if (!template) return null

  const [activeInstances, totalInteractions, availableRewards, redeemedRewards] =
    await Promise.all([
      db.passInstance.count({
        where: { passTemplateId: templateId, status: "ACTIVE" },
      }),
      db.interaction.count({
        where: { passTemplateId: templateId },
      }),
      db.reward.count({
        where: { passTemplateId: templateId, status: "AVAILABLE" },
      }),
      db.reward.count({
        where: { passTemplateId: templateId, status: "REDEEMED" },
      }),
    ])

  return {
    template,
    stats: { activeInstances, totalInteractions, availableRewards, redeemedRewards },
  }
}

// ─── Pass Instances: Query List ────────────────────────────

export type PassListParams = {
  page: number
  perPage: number
  contactId?: string
  templateId?: string
  status?: string
  passType?: string
}

export async function queryPassInstances(
  organizationId: string,
  params: PassListParams
) {
  const { page, perPage, contactId, templateId, status, passType } = params
  const skip = (page - 1) * perPage

  const where: Prisma.PassInstanceWhereInput = {
    passTemplate: { organizationId },
  }
  if (contactId) where.contactId = contactId
  if (templateId) where.passTemplateId = templateId
  if (status) where.status = status as Prisma.EnumPassInstanceStatusFilter
  if (passType) {
    where.passTemplate = {
      ...(where.passTemplate as Prisma.PassTemplateWhereInput),
      passType: passType as Prisma.EnumPassTypeFilter,
    }
  }

  const [instances, total] = await Promise.all([
    db.passInstance.findMany({
      where,
      select: {
        id: true,
        contactId: true,
        status: true,
        data: true,
        walletProvider: true,
        issuedAt: true,
        expiresAt: true,
        createdAt: true,
        passTemplate: {
          select: { id: true, name: true, passType: true },
        },
      },
      orderBy: { issuedAt: "desc" },
      skip,
      take: perPage,
    }),
    db.passInstance.count({ where }),
  ])

  return { instances, total, pageCount: Math.ceil(total / perPage) }
}

// ─── Pass Instances: Query Detail ──────────────────────────

export async function queryPassInstanceDetail(
  organizationId: string,
  passInstanceId: string
) {
  return db.passInstance.findFirst({
    where: {
      id: passInstanceId,
      passTemplate: { organizationId },
    },
    include: {
      passTemplate: {
        select: { id: true, name: true, passType: true },
      },
      contact: {
        select: { id: true, fullName: true, email: true },
      },
      interactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          createdAt: true,
          passTemplate: { select: { name: true, passType: true } },
        },
      },
    },
  })
}

// ─── Pass Instances: Issue ─────────────────────────────────

export type IssuePassResult =
  | { success: true; passInstanceId: string }
  | { success: false; error: string }

export async function issuePass(
  organizationId: string,
  templateId: string,
  contactId: string
): Promise<IssuePassResult> {
  // Verify template belongs to org and is active
  const template = await db.passTemplate.findFirst({
    where: { id: templateId, organizationId, status: "ACTIVE" },
    select: { id: true, name: true, passType: true, config: true },
  })

  if (!template) {
    return { success: false, error: "Template not found or not active." }
  }

  // Verify contact belongs to org
  const contact = await db.contact.findFirst({
    where: { id: contactId, organizationId, deletedAt: null },
    select: { id: true, fullName: true },
  })

  if (!contact) {
    return { success: false, error: "Contact not found." }
  }

  // Check for existing pass instance
  const existing = await db.passInstance.findUnique({
    where: {
      contactId_passTemplateId: {
        contactId: contact.id,
        passTemplateId: template.id,
      },
    },
    select: { id: true },
  })

  if (existing) {
    return { success: false, error: "Pass already issued to this contact for this template." }
  }

  // Build type-specific data
  const walletPassId = randomUUID()
  const templateConfig = (template.config as Record<string, unknown>) ?? {}
  const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 90
  const instanceData: Record<string, unknown> = {
    currentCycleVisits: 0,
    totalInteractions: 0,
  }
  let expiresAt: Date | null = null

  if (template.passType === "PREPAID") {
    const cfg = parsePrepaidConfig(template.config)
    if (cfg) {
      instanceData.remainingUses = cfg.totalUses
      if (cfg.validUntil) expiresAt = new Date(cfg.validUntil)
    }
  }

  if (template.passType === "MEMBERSHIP") {
    const cfg = parseMembershipConfig(template.config)
    if (cfg) expiresAt = computeMembershipExpiresAt(cfg)
  }

  if (template.passType === "GIFT_CARD") {
    const cfg = parseGiftCardConfig(template.config)
    if (cfg) {
      instanceData.balanceCents = cfg.initialBalanceCents
      instanceData.currency = cfg.currency
      if (cfg.expiryMonths) {
        const d = new Date()
        d.setMonth(d.getMonth() + cfg.expiryMonths)
        expiresAt = d
      }
    }
  }

  if (template.passType === "ACCESS") {
    const cfg = parseAccessConfig(template.config)
    if (cfg) expiresAt = computeDurationExpiresAt(cfg.validDuration, cfg.customDurationDays)
  }

  if (template.passType === "BUSINESS_ID") {
    const cfg = parseBusinessIdConfig(template.config)
    if (cfg) expiresAt = computeDurationExpiresAt(cfg.validDuration, cfg.customDurationDays)
  }

  if (template.passType === "TICKET") instanceData.scanCount = 0
  if (template.passType === "POINTS") instanceData.pointsBalance = 0

  const passInstance = await db.passInstance.create({
    data: {
      contactId: contact.id,
      passTemplateId: template.id,
      walletPassId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: instanceData as any,
      ...(expiresAt ? { expiresAt } : {}),
    },
    select: { id: true },
  })

  // Auto-create coupon reward
  if (template.passType === "COUPON") {
    const couponConfig = parseCouponConfig(template.config)
    const couponExpiresAt = couponConfig?.validUntil
      ? new Date(couponConfig.validUntil)
      : rewardExpiryDays > 0
        ? new Date(Date.now() + rewardExpiryDays * 86_400_000)
        : new Date(Date.now() + 365 * 86_400_000)

    const mgConfig = parseMinigameConfig(template.config)
    const hasPrizes = mgConfig?.enabled && mgConfig.prizes?.length
    const selectedPrize = hasPrizes ? weightedRandomPrize(mgConfig.prizes!) : null

    await db.reward.create({
      data: {
        contactId: contact.id,
        organizationId,
        passTemplateId: template.id,
        passInstanceId: passInstance.id,
        status: "AVAILABLE",
        expiresAt: couponExpiresAt,
        ...(selectedPrize ? { description: selectedPrize, revealedAt: null } : {}),
      },
    })
  }

  return { success: true, passInstanceId: passInstance.id }
}

// ─── Interactions: Query List ──────────────────────────────

export type InteractionListParams = {
  page: number
  perPage: number
  type?: string
  contactId?: string
  templateId?: string
  since?: string
  until?: string
}

export async function queryInteractions(
  organizationId: string,
  params: InteractionListParams
) {
  const { page, perPage, type, contactId, templateId, since, until } = params
  const skip = (page - 1) * perPage

  const where: Prisma.InteractionWhereInput = { organizationId }
  if (type) where.type = type as Prisma.EnumInteractionTypeFilter
  if (contactId) where.contactId = contactId
  if (templateId) where.passTemplateId = templateId
  if (since || until) {
    where.createdAt = {}
    if (since) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(since)
    if (until) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(until)
  }

  const [interactions, total] = await Promise.all([
    db.interaction.findMany({
      where,
      select: {
        id: true,
        type: true,
        metadata: true,
        createdAt: true,
        passInstance: {
          select: {
            id: true,
            status: true,
            passTemplate: { select: { name: true, passType: true } },
          },
        },
        contact: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    db.interaction.count({ where }),
  ])

  return { interactions, total, pageCount: Math.ceil(total / perPage) }
}

// ─── Interactions: Query Detail ────────────────────────────

export async function queryInteractionDetail(
  organizationId: string,
  interactionId: string
) {
  return db.interaction.findFirst({
    where: { id: interactionId, organizationId },
    select: {
      id: true,
      type: true,
      metadata: true,
      createdAt: true,
      passInstance: {
        select: {
          id: true,
          status: true,
          passTemplate: { select: { name: true, passType: true } },
        },
      },
      contact: { select: { id: true, fullName: true } },
    },
  })
}

// ─── Interactions: Query for Pass Instance ─────────────────

export async function queryPassInteractions(
  organizationId: string,
  passInstanceId: string,
  params: { page: number; perPage: number; type?: string }
) {
  const { page, perPage, type } = params
  const skip = (page - 1) * perPage

  const where: Prisma.InteractionWhereInput = {
    passInstanceId,
    organizationId,
  }
  if (type) where.type = type as Prisma.EnumInteractionTypeFilter

  const [interactions, total] = await Promise.all([
    db.interaction.findMany({
      where,
      select: {
        id: true,
        type: true,
        metadata: true,
        createdAt: true,
        passInstance: {
          select: {
            id: true,
            status: true,
            passTemplate: { select: { name: true, passType: true } },
          },
        },
        contact: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    db.interaction.count({ where }),
  ])

  return { interactions, total, pageCount: Math.ceil(total / perPage) }
}

// ═══════════════════════════════════════════════════════════
// Type-Specific Actions (Phase API-3)
// ═══════════════════════════════════════════════════════════

export type ActionResult = {
  action: string
  passInstanceId: string
  result: Record<string, unknown>
  interaction: { id: string; type: string; createdAt: Date }
}

/** Shared helper: fetch + validate pass instance for an action. */
async function fetchPassForAction(organizationId: string, passInstanceId: string) {
  const pi = await db.passInstance.findFirst({
    where: { id: passInstanceId, passTemplate: { organizationId } },
    include: {
      passTemplate: { select: { id: true, name: true, passType: true, config: true, status: true, endsAt: true } },
      contact: { select: { id: true, fullName: true, deletedAt: true } },
    },
  })
  if (!pi) return { error: "Pass instance not found." }
  if (pi.contact.deletedAt) return { error: "Contact has been deleted." }
  if (pi.status !== "ACTIVE") return { error: `Pass instance is ${pi.status}. Only ACTIVE passes accept actions.` }
  if (pi.passTemplate.status !== "ACTIVE") return { error: "Template is not active." }
  if (pi.passTemplate.endsAt && pi.passTemplate.endsAt < new Date()) return { error: "Template has expired." }
  return { passInstance: pi }
}

/** Shared helper: update contact stats after interaction. */
async function bumpContactStats(contactId: string, tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) {
  await tx.contact.update({
    where: { id: contactId },
    data: { totalInteractions: { increment: 1 }, lastInteractionAt: new Date() },
  })
}

// ─── STAMP_CARD: stamp ─────────────────────────────────────

export async function performStamp(
  organizationId: string,
  passInstanceId: string
): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!

  const data = pi.data as Record<string, unknown>
  const config = parseStampCardConfig(pi.passTemplate.config)
  const visitsRequired = config?.stampsRequired ?? 10
  const rewardExpiryDays = (pi.passTemplate.config as Record<string, unknown>)?.rewardExpiryDays as number ?? 90

  const currentCycle = (data.currentCycleVisits as number) ?? 0
  const totalVisits = (data.totalVisits as number) ?? 0
  const newCycleVisits = currentCycle + 1
  const newTotalVisits = totalVisits + 1
  const wasRewardEarned = newCycleVisits >= visitsRequired

  const txResult = await db.$transaction(async (tx) => {
    const interaction = await tx.interaction.create({
      data: {
        contactId: pi.contactId, organizationId,
        passTemplateId: pi.passTemplate.id, passInstanceId: pi.id,
        type: "STAMP",
        metadata: { visitNumber: newCycleVisits } as Prisma.JsonObject,
      },
      select: { id: true, type: true, createdAt: true },
    })

    await tx.passInstance.update({
      where: { id: pi.id },
      data: {
        data: { ...data, currentCycleVisits: wasRewardEarned ? 0 : newCycleVisits, totalVisits: newTotalVisits } as Prisma.JsonObject,
      },
    })

    if (wasRewardEarned) {
      const mgConfig = parseMinigameConfig(pi.passTemplate.config)
      const hasPrizes = mgConfig?.enabled && mgConfig.prizes?.length
      const selectedPrize = hasPrizes ? weightedRandomPrize(mgConfig.prizes!) : null
      await tx.reward.create({
        data: {
          contactId: pi.contactId, organizationId,
          passTemplateId: pi.passTemplate.id, passInstanceId: pi.id,
          status: "AVAILABLE",
          expiresAt: new Date(Date.now() + rewardExpiryDays * 86_400_000),
          ...(selectedPrize ? { description: selectedPrize, revealedAt: null } : { revealedAt: new Date() }),
        },
      })
    }

    await bumpContactStats(pi.contactId, tx)
    return interaction
  })

  return {
    action: "stamp", passInstanceId: pi.id,
    result: { newCycleVisits: wasRewardEarned ? 0 : newCycleVisits, visitsRequired, totalVisits: newTotalVisits, wasRewardEarned },
    interaction: txResult,
  }
}

// ─── COUPON: redeem ────────────────────────────────────────

export async function performCouponRedeem(organizationId: string, passInstanceId: string, value?: string): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  if (data.redeemed) return { error: "Coupon has already been redeemed." }
  const couponConfig = parseCouponConfig(pi.passTemplate.config)
  const isUnlimited = couponConfig?.redemptionLimit === "unlimited"
  const discountText = value ?? (couponConfig ? formatCouponValue(couponConfig) : "")

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, redeemed: true, redeemedAt: new Date().toISOString() } as Prisma.JsonObject, status: isUnlimited ? "ACTIVE" : "COMPLETED" } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "COUPON_REDEEM", metadata: { discountText } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "redeem", passInstanceId: pi.id, result: { discountText, isUnlimited }, interaction: txResult }
}

// ─── MEMBERSHIP: check_in ──────────────────────────────────

export async function performCheckIn(organizationId: string, passInstanceId: string): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  const totalCheckIns = ((data.totalCheckIns as number) ?? 0) + 1

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, totalCheckIns, lastCheckInAt: new Date().toISOString() } as Prisma.JsonObject } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "CHECK_IN", metadata: { totalCheckIns } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "check_in", passInstanceId: pi.id, result: { totalCheckIns }, interaction: txResult }
}

// ─── POINTS: earn_points ───────────────────────────────────

export async function performEarnPoints(organizationId: string, passInstanceId: string, points: number): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  const newBalance = ((data.pointsBalance as number) ?? 0) + points
  const totalEarned = ((data.totalPointsEarned as number) ?? 0) + points

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, pointsBalance: newBalance, totalPointsEarned: totalEarned } as Prisma.JsonObject } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "POINTS_EARN", metadata: { pointsEarned: points, newBalance } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "earn_points", passInstanceId: pi.id, result: { pointsEarned: points, newBalance, totalPointsEarned: totalEarned }, interaction: txResult }
}

// ─── POINTS: redeem_points ─────────────────────────────────

export async function performRedeemPoints(organizationId: string, passInstanceId: string, points: number): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  const balance = (data.pointsBalance as number) ?? 0
  if (balance < points) return { error: `Insufficient points. Balance: ${balance}, requested: ${points}.` }
  const newBalance = balance - points
  const totalSpent = ((data.totalPointsSpent as number) ?? 0) + points

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, pointsBalance: newBalance, totalPointsSpent: totalSpent } as Prisma.JsonObject } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "POINTS_REDEEM", metadata: { pointsSpent: points, newBalance } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "redeem_points", passInstanceId: pi.id, result: { pointsSpent: points, newBalance }, interaction: txResult }
}

// ─── PREPAID: use ──────────────────────────────────────────

export async function performPrepaidUse(organizationId: string, passInstanceId: string, amount: number): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  const remaining = (data.remainingUses as number) ?? 0
  if (remaining < amount) return { error: `Insufficient uses. Remaining: ${remaining}, requested: ${amount}.` }
  const newRemaining = remaining - amount
  const totalUsed = ((data.totalUsed as number) ?? 0) + amount
  const isDepleted = newRemaining <= 0

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, remainingUses: newRemaining, totalUsed, lastUsedAt: new Date().toISOString() } as Prisma.JsonObject, status: isDepleted ? "COMPLETED" : "ACTIVE" } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "PREPAID_USE", metadata: { remainingUses: newRemaining, totalUsed } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "use", passInstanceId: pi.id, result: { remainingUses: newRemaining, totalUsed, isDepleted }, interaction: txResult }
}

// ─── PREPAID: recharge (NEW) ───────────────────────────────

export async function performPrepaidRecharge(organizationId: string, passInstanceId: string, uses: number): Promise<ActionResult | { error: string }> {
  const pi = await db.passInstance.findFirst({
    where: { id: passInstanceId, passTemplate: { organizationId } },
    include: { passTemplate: { select: { id: true, name: true, passType: true, config: true, status: true, endsAt: true } }, contact: { select: { id: true, fullName: true, deletedAt: true } } },
  })
  if (!pi) return { error: "Pass instance not found." }
  if (pi.contact.deletedAt) return { error: "Contact has been deleted." }
  if (!["ACTIVE", "COMPLETED"].includes(pi.status)) return { error: `Pass instance is ${pi.status}. Cannot recharge.` }
  const data = pi.data as Record<string, unknown>
  const newRemaining = ((data.remainingUses as number) ?? 0) + uses

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, remainingUses: newRemaining } as Prisma.JsonObject, status: "ACTIVE" } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "PREPAID_RECHARGE", metadata: { usesAdded: uses, newRemaining } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "recharge", passInstanceId: pi.id, result: { usesAdded: uses, remainingUses: newRemaining }, interaction: txResult }
}

// ─── GIFT_CARD: charge ─────────────────────────────────────

export async function performGiftCardCharge(organizationId: string, passInstanceId: string, amountCents: number): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  const balance = (data.balanceCents as number) ?? 0
  if (balance < amountCents) return { error: `Insufficient balance. Current: ${balance}, requested: ${amountCents}.` }
  const newBalance = balance - amountCents
  const totalCharged = ((data.totalChargedCents as number) ?? 0) + amountCents
  const currency = (data.currency as string) ?? "USD"
  const isDepleted = newBalance <= 0

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, balanceCents: newBalance, totalChargedCents: totalCharged } as Prisma.JsonObject, status: isDepleted ? "COMPLETED" : "ACTIVE" } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "GIFT_CHARGE", metadata: { amountCents, newBalanceCents: newBalance, currency } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "charge", passInstanceId: pi.id, result: { amountCharged: amountCents, newBalanceCents: newBalance, currency, isDepleted }, interaction: txResult }
}

// ─── GIFT_CARD: refund ─────────────────────────────────────

export async function performGiftCardRefund(organizationId: string, passInstanceId: string, amountCents: number): Promise<ActionResult | { error: string }> {
  const pi = await db.passInstance.findFirst({
    where: { id: passInstanceId, passTemplate: { organizationId } },
    include: { passTemplate: { select: { id: true, name: true, passType: true, config: true, status: true, endsAt: true } }, contact: { select: { id: true, fullName: true, deletedAt: true } } },
  })
  if (!pi) return { error: "Pass instance not found." }
  if (pi.contact.deletedAt) return { error: "Contact has been deleted." }
  if (!["ACTIVE", "COMPLETED"].includes(pi.status)) return { error: `Pass instance is ${pi.status}. Cannot refund.` }
  const data = pi.data as Record<string, unknown>
  const newBalance = ((data.balanceCents as number) ?? 0) + amountCents
  const currency = (data.currency as string) ?? "USD"

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, balanceCents: newBalance } as Prisma.JsonObject, status: "ACTIVE" } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "GIFT_REFUND", metadata: { amountCents, newBalanceCents: newBalance, currency } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "refund", passInstanceId: pi.id, result: { amountRefunded: amountCents, newBalanceCents: newBalance, currency }, interaction: txResult }
}

// ─── TICKET: scan ──────────────────────────────────────────

export async function performTicketScan(organizationId: string, passInstanceId: string): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  const ticketConfig = parseTicketConfig(pi.passTemplate.config)
  const maxScans = ticketConfig?.maxScans ?? 1
  const currentScans = (data.scanCount as number) ?? 0
  if (currentScans >= maxScans) return { error: `Ticket has reached maximum scans (${maxScans}).` }
  const newScanCount = currentScans + 1
  const isMaxedOut = newScanCount >= maxScans
  const now = new Date().toISOString()

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, scanCount: newScanCount, firstScannedAt: (data.firstScannedAt as string) ?? now, lastScannedAt: now } as Prisma.JsonObject, status: isMaxedOut ? "COMPLETED" : "ACTIVE" } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "TICKET_SCAN", metadata: { scanCount: newScanCount, maxScans } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "scan", passInstanceId: pi.id, result: { scanCount: newScanCount, maxScans, isMaxedOut }, interaction: txResult }
}

// ─── TICKET: void ──────────────────────────────────────────

export async function performTicketVoid(organizationId: string, passInstanceId: string): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, voidedAt: new Date().toISOString() } as Prisma.JsonObject, status: "VOIDED" } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "TICKET_VOID", metadata: {} as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "void", passInstanceId: pi.id, result: {}, interaction: txResult }
}

// ─── ACCESS: grant ─────────────────────────────────────────

export async function performAccessGrant(organizationId: string, passInstanceId: string): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  const today = new Date().toISOString().slice(0, 10)
  const todayGranted = (data.todayDate as string) === today ? ((data.todayGranted as number) ?? 0) + 1 : 1
  const totalGranted = ((data.totalGranted as number) ?? 0) + 1

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, totalGranted, todayGranted, todayDate: today, lastGrantedAt: new Date().toISOString() } as Prisma.JsonObject } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "ACCESS_GRANT", metadata: { totalGranted, todayGranted } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "grant", passInstanceId: pi.id, result: { totalGranted, todayGranted }, interaction: txResult }
}

// ─── ACCESS: deny ──────────────────────────────────────────

export async function performAccessDeny(organizationId: string, passInstanceId: string): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  const totalDenied = ((data.totalDenied as number) ?? 0) + 1

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, totalDenied } as Prisma.JsonObject } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "ACCESS_DENY", metadata: { totalDenied } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "deny", passInstanceId: pi.id, result: { totalDenied }, interaction: txResult }
}

// ─── TRANSIT: board ────────────────────────────────────────

export async function performTransitBoard(organizationId: string, passInstanceId: string): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  if (data.isBoarded) return { error: "Already boarded. Must exit first." }
  const transitConfig = parseTransitConfig(pi.passTemplate.config)

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, isBoarded: true, boardedAt: new Date().toISOString(), exitedAt: undefined } as Prisma.JsonObject } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "TRANSIT_BOARD", metadata: { transitType: transitConfig?.transitType, originName: transitConfig?.originName, destinationName: transitConfig?.destinationName } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "board", passInstanceId: pi.id, result: { isBoarded: true }, interaction: txResult }
}

// ─── TRANSIT: exit ─────────────────────────────────────────

export async function performTransitExit(organizationId: string, passInstanceId: string): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  if (!data.isBoarded) return { error: "Not currently boarded. Must board first." }

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, isBoarded: false, exitedAt: new Date().toISOString() } as Prisma.JsonObject } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "TRANSIT_EXIT", metadata: {} as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "exit", passInstanceId: pi.id, result: { isBoarded: false }, interaction: txResult }
}

// ─── BUSINESS_ID: verify ───────────────────────────────────

export async function performIdVerify(organizationId: string, passInstanceId: string): Promise<ActionResult | { error: string }> {
  const fetched = await fetchPassForAction(organizationId, passInstanceId)
  if (fetched.error) return { error: fetched.error }
  const pi = fetched.passInstance!
  const data = pi.data as Record<string, unknown>
  const totalVerifications = ((data.totalVerifications as number) ?? 0) + 1

  const txResult = await db.$transaction(async (tx) => {
    await tx.passInstance.update({ where: { id: pi.id }, data: { data: { ...data, totalVerifications, lastVerifiedAt: new Date().toISOString() } as Prisma.JsonObject } })
    const interaction = await tx.interaction.create({ data: { contactId: pi.contactId, organizationId, passTemplateId: pi.passTemplate.id, passInstanceId: pi.id, type: "ID_VERIFY", metadata: { totalVerifications } as Prisma.JsonObject }, select: { id: true, type: true, createdAt: true } })
    await bumpContactStats(pi.contactId, tx)
    return interaction
  })
  return { action: "verify", passInstanceId: pi.id, result: { totalVerifications, contactName: pi.contact.fullName }, interaction: txResult }
}

// ═══════════════════════════════════════════════════════════
// Bulk Operations (Phase API-3)
// ═══════════════════════════════════════════════════════════

export type BulkContactRow = { fullName: string; email?: string; phone?: string; metadata?: Record<string, unknown> }
export type BulkContactResult = { created: number; skipped: number; errors: Array<{ index: number; error: string }> }

export async function bulkCreateContacts(organizationId: string, rows: BulkContactRow[], issueTemplateId?: string): Promise<BulkContactResult> {
  const result: BulkContactResult = { created: 0, skipped: 0, errors: [] }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    try {
      const cr = await createContact(organizationId, { fullName: row.fullName, email: row.email || undefined, phone: row.phone || undefined, metadata: row.metadata })
      if (!cr.success) { cr.duplicateField ? result.skipped++ : result.errors.push({ index: i, error: cr.error }); continue }
      if (issueTemplateId) await issuePass(organizationId, issueTemplateId, cr.contactId)
      result.created++
    } catch { result.errors.push({ index: i, error: "Unexpected error" }) }
  }
  return result
}

export type BulkIssueResult = { issued: number; skipped: number; errors: Array<{ contactId: string; error: string }> }

export async function bulkIssuePasses(organizationId: string, templateId: string, contactIds: string[]): Promise<BulkIssueResult> {
  const result: BulkIssueResult = { issued: 0, skipped: 0, errors: [] }
  for (const contactId of contactIds) {
    const ir = await issuePass(organizationId, templateId, contactId)
    if (ir.success) result.issued++
    else if (ir.error.includes("already issued")) result.skipped++
    else result.errors.push({ contactId, error: ir.error })
  }
  return result
}

// ═══════════════════════════════════════════════════════════
// Statistics (Phase API-3)
// ═══════════════════════════════════════════════════════════

export async function queryOrgStats(organizationId: string) {
  const [totalContacts, activeContacts, totalPassInstances, activePassInstances, totalInteractionsCount, rewardsEarned, rewardsRedeemed] = await Promise.all([
    db.contact.count({ where: { organizationId, deletedAt: null } }),
    db.contact.count({ where: { organizationId, deletedAt: null, passInstances: { some: { status: "ACTIVE" } } } }),
    db.passInstance.count({ where: { passTemplate: { organizationId } } }),
    db.passInstance.count({ where: { passTemplate: { organizationId }, status: "ACTIVE" } }),
    db.interaction.count({ where: { organizationId } }),
    db.reward.count({ where: { organizationId } }),
    db.reward.count({ where: { organizationId, status: "REDEEMED" } }),
  ])
  return { totalContacts, activeContacts, totalPassInstances, activePassInstances, totalInteractions: totalInteractionsCount, rewardsEarned, rewardsRedeemed }
}

export async function queryDailyStats(organizationId: string, since: string, until: string) {
  return db.analyticsSnapshot.findMany({
    where: { organizationId, date: { gte: new Date(since), lte: new Date(until) } },
    select: { date: true, totalContacts: true, newContacts: true, totalInteractions: true, rewardsEarned: true, rewardsRedeemed: true },
    orderBy: { date: "asc" },
  })
}

export async function queryTemplateStats(organizationId: string, templateId: string) {
  const template = await db.passTemplate.findFirst({ where: { id: templateId, organizationId }, select: { id: true } })
  if (!template) return null

  const [active, completed, suspended, revoked, expired, voided, totalInteractionsCount, rewardsEarned, rewardsRedeemed, rewardsExpired, rewardsAvailable, interactionsByType] = await Promise.all([
    db.passInstance.count({ where: { passTemplateId: templateId, status: "ACTIVE" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, status: "COMPLETED" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, status: "SUSPENDED" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, status: "REVOKED" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, status: "EXPIRED" } }),
    db.passInstance.count({ where: { passTemplateId: templateId, status: "VOIDED" } }),
    db.interaction.count({ where: { passTemplateId: templateId } }),
    db.reward.count({ where: { passTemplateId: templateId } }),
    db.reward.count({ where: { passTemplateId: templateId, status: "REDEEMED" } }),
    db.reward.count({ where: { passTemplateId: templateId, status: "EXPIRED" } }),
    db.reward.count({ where: { passTemplateId: templateId, status: "AVAILABLE" } }),
    db.interaction.groupBy({ by: ["type"], where: { passTemplateId: templateId }, _count: true }),
  ])
  const byType: Record<string, number> = {}
  for (const row of interactionsByType) byType[row.type] = row._count

  return {
    templateId,
    passInstances: { active, completed, suspended, revoked, expired, voided },
    interactions: { total: totalInteractionsCount, byType },
    rewards: { earned: rewardsEarned, redeemed: rewardsRedeemed, expired: rewardsExpired, available: rewardsAvailable },
  }
}


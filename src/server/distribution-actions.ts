"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { db, getNextMemberNumber } from "@/lib/db"
import {
  assertAuthenticated,
  getOrganizationForUser,
  assertOrganizationRole,
} from "@/lib/dal"
import { buildCardUrl } from "@/lib/card-access"
import { buildPassIssuedEmailHtml, getEmailFrom, buildWalletDownloadUrl } from "@/lib/email-templates"
import { generateApplePassForEmail } from "@/lib/wallet/generate-pass-for-email"
import { sanitizeText } from "@/lib/sanitize"
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
  computeDurationExpiresAt,
} from "@/lib/pass-config"

// ─── Types ──────────────────────────────────────────────────

export type DirectIssueContact = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
}

export type IssueContactResult = {
  contactId: string
  contactName: string
  status: "issued" | "already_exists" | "no_email" | "error"
  error?: string
}

export type IssuePassToContactsResult = {
  success: boolean
  results: IssueContactResult[]
  issuedCount: number
  skippedCount: number
  error?: string
}

export type BulkImportRow = {
  fullName: string
  email?: string
  phone?: string
}

export type BulkImportResult = {
  success: boolean
  results: IssueContactResult[]
  createdCount: number
  issuedCount: number
  skippedCount: number
  errorCount: number
  error?: string
}

// ─── Validation ─────────────────────────────────────────────

const issuePassSchema = z.object({
  templateId: z.string().min(1),
  contactIds: z.array(z.string().min(1)).min(1).max(100),
})

// ─── Pass Type Labels ───────────────────────────────────────

const PASS_TYPE_LABELS: Record<string, string> = {
  STAMP_CARD: "Stamp Card",
  COUPON: "Coupon",
  MEMBERSHIP: "Membership Card",
  POINTS: "Points Card",
  PREPAID: "Prepaid Pass",
  GIFT_CARD: "Gift Card",
  TICKET: "Event Ticket",
  ACCESS: "Access Pass",
  TRANSIT: "Transit Pass",
  BUSINESS_ID: "Business ID",
}

// ─── Search Contacts for Direct Issue ───────────────────────

export async function searchContactsForIssue(
  query: string,
  templateId: string
): Promise<DirectIssueContact[]> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) return []

  const search = query.trim()
  if (!search) return []

  const contacts = await db.contact.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
      // Exclude contacts who already have a pass for this template
      NOT: {
        passInstances: {
          some: { passTemplateId: templateId },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
    orderBy: { fullName: "asc" },
    take: 20,
  })

  return contacts
}

// ─── Issue Pass to Contacts ─────────────────────────────────

export async function issuePassToContacts(
  templateId: string,
  contactIds: string[]
): Promise<IssuePassToContactsResult> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { success: false, results: [], issuedCount: 0, skippedCount: 0, error: "No organization found" }
  }

  await assertOrganizationRole(organization.id, "owner")

  const parsed = issuePassSchema.safeParse({ templateId, contactIds })
  if (!parsed.success) {
    return {
      success: false,
      results: [],
      issuedCount: 0,
      skippedCount: 0,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  // Fetch template and verify it belongs to this org and is active
  const template = await db.passTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: organization.id,
      status: "ACTIVE",
    },
    select: { id: true, name: true, passType: true, config: true },
  })

  if (!template) {
    return {
      success: false,
      results: [],
      issuedCount: 0,
      skippedCount: 0,
      error: "Program not found or not active",
    }
  }

  const results: IssueContactResult[] = []
  let issuedCount = 0
  let skippedCount = 0

  for (const contactId of parsed.data.contactIds) {
    // Verify contact belongs to this org
    const contact = await db.contact.findFirst({
      where: {
        id: contactId,
        organizationId: organization.id,
        deletedAt: null,
      },
      select: { id: true, fullName: true, email: true },
    })

    if (!contact) {
      results.push({
        contactId,
        contactName: "Unknown",
        status: "error",
        error: "Contact not found",
      })
      continue
    }

    // Check if pass instance already exists
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
      skippedCount++
      results.push({
        contactId: contact.id,
        contactName: contact.fullName,
        status: "already_exists",
      })
      continue
    }

    // Create pass instance with type-specific initialization
    const walletPassId = randomUUID()
    const templateConfig = (template.config as Record<string, unknown>) ?? {}
    const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 90

    const instanceDataObj: Record<string, unknown> = {
      currentCycleVisits: 0,
      totalInteractions: 0,
    }

    // Type-specific data initialization
    let expiresAt: Date | null = null

    if (template.passType === "PREPAID") {
      const prepaidConfig = parsePrepaidConfig(template.config)
      if (prepaidConfig) {
        instanceDataObj.remainingUses = prepaidConfig.totalUses
        if (prepaidConfig.validUntil) expiresAt = new Date(prepaidConfig.validUntil)
      }
    }

    if (template.passType === "MEMBERSHIP") {
      const membershipConfig = parseMembershipConfig(template.config)
      if (membershipConfig) {
        expiresAt = computeMembershipExpiresAt(membershipConfig)
      }
    }

    if (template.passType === "GIFT_CARD") {
      const giftCardConfig = parseGiftCardConfig(template.config)
      if (giftCardConfig) {
        instanceDataObj.balanceCents = giftCardConfig.initialBalanceCents
        instanceDataObj.currency = giftCardConfig.currency
        if (giftCardConfig.expiryMonths) {
          const d = new Date()
          d.setMonth(d.getMonth() + giftCardConfig.expiryMonths)
          expiresAt = d
        }
      }
    }

    if (template.passType === "ACCESS") {
      const accessConfig = parseAccessConfig(template.config)
      if (accessConfig) {
        expiresAt = computeDurationExpiresAt(accessConfig.validDuration, accessConfig.customDurationDays)
      }
    }

    if (template.passType === "BUSINESS_ID") {
      const bizConfig = parseBusinessIdConfig(template.config)
      if (bizConfig) {
        expiresAt = computeDurationExpiresAt(bizConfig.validDuration, bizConfig.customDurationDays)
      }
    }

    if (template.passType === "TICKET") {
      instanceDataObj.scanCount = 0
    }

    if (template.passType === "POINTS") {
      instanceDataObj.pointsBalance = 0
    }

    const passInstance = await db.passInstance.create({
      data: {
        contactId: contact.id,
        passTemplateId: template.id,
        walletPassId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: instanceDataObj as any,
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
          organizationId: organization.id,
          passTemplateId: template.id,
          passInstanceId: passInstance.id,
          status: "AVAILABLE",
          expiresAt: couponExpiresAt,
          ...(selectedPrize ? { description: selectedPrize, revealedAt: null } : {}),
        },
      })
    }

    // Send email notification if contact has email
    if (contact.email) {
      const cardUrl = buildCardUrl(organization.slug, passInstance.id)

      const googleWalletUrl = buildWalletDownloadUrl(passInstance.id, "google")
      const passTypeLabel = PASS_TYPE_LABELS[template.passType] ?? "Pass"

      try {
        // Generate Apple pass and upload to R2 for direct wallet add from email
        const applePass = await generateApplePassForEmail(passInstance.id)

        if (process.env.TRIGGER_SECRET_KEY) {
          const { tasks } = await import("@trigger.dev/sdk")
          await tasks.trigger("send-pass-issued-email", {
            email: contact.email,
            contactName: contact.fullName,
            organizationName: organization.name,
            templateName: template.name,
            passTypeLabel,
            cardUrl,
            appleWalletUrl: applePass?.url,
            googleWalletUrl,
          })
        } else {
          const { Resend } = await import("resend")
          const resend = new Resend(process.env.RESEND_API_KEY)
          const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"

          const { error: resendError } = await resend.emails.send({
            from: getEmailFrom(),
            to: contact.email,
            subject: `Your ${passTypeLabel} from ${organization.name}`,
            html: buildPassIssuedEmailHtml({
              contactName: contact.fullName,
              organizationName: organization.name,
              templateName: template.name,
              passTypeLabel,
              cardUrl: `${baseUrl}${cardUrl}`,
              appleWalletUrl: applePass?.url,
              googleWalletUrl: `${baseUrl}${googleWalletUrl}`,
            }),
          })
          if (resendError) {
            console.error("Resend error (direct issue):", resendError.message)
          }
        }
      } catch (err) {
        console.error(
          "Failed to send pass issued email:",
          err instanceof Error ? err.message : "Unknown error"
        )
        // Don't fail the whole operation — pass was still created
      }
    }

    issuedCount++
    results.push({
      contactId: contact.id,
      contactName: contact.fullName,
      status: contact.email ? "issued" : "no_email",
    })
  }

  revalidatePath(`/dashboard/programs/${templateId}`)
  revalidatePath("/dashboard/contacts")
  revalidatePath("/dashboard")

  return { success: true, results, issuedCount, skippedCount }
}

// ─── Create Contact & Issue Pass ────────────────────────────

export type CreateAndIssueResult = {
  success: boolean
  contactId?: string
  contactName?: string
  error?: string
  duplicateField?: "email" | "phone"
}

const createAndIssueSchema = z.object({
  templateId: z.string().min(1),
  fullName: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
})

export async function createContactAndIssuePass(
  templateId: string,
  fullName: string,
  email: string,
  phone: string
): Promise<CreateAndIssueResult> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { success: false, error: "No organization found" }
  }

  await assertOrganizationRole(organization.id, "owner")

  const parsed = createAndIssueSchema.safeParse({ templateId, fullName, email, phone })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const cleanName = sanitizeText(parsed.data.fullName, 100)
  const cleanEmail = parsed.data.email ? sanitizeText(parsed.data.email, 255) || null : null
  const cleanPhone = parsed.data.phone ? sanitizeText(parsed.data.phone, 30) || null : null

  // Verify template
  const template = await db.passTemplate.findFirst({
    where: { id: templateId, organizationId: organization.id, status: "ACTIVE" },
    select: { id: true, name: true, passType: true, config: true },
  })

  if (!template) {
    return { success: false, error: "Program not found or not active" }
  }

  // Find existing contact by email or phone, or create a new one
  let existingContact: { id: string; fullName: string; email: string | null } | null = null

  if (cleanEmail) {
    existingContact = await db.contact.findFirst({
      where: { organizationId: organization.id, email: cleanEmail, deletedAt: null },
      select: { id: true, fullName: true, email: true },
    })
  }

  if (!existingContact && cleanPhone) {
    existingContact = await db.contact.findFirst({
      where: { organizationId: organization.id, phone: cleanPhone, deletedAt: null },
      select: { id: true, fullName: true, email: true },
    })
  }

  // If existing contact found, check if they already have a pass for this program
  if (existingContact) {
    const existingPass = await db.passInstance.findUnique({
      where: {
        contactId_passTemplateId: {
          contactId: existingContact.id,
          passTemplateId: template.id,
        },
      },
      select: { id: true },
    })
    if (existingPass) {
      return { success: false, error: "This contact already has a pass for this program." }
    }
  }

  const contact = existingContact ?? await (async () => {
    const memberNumber = await getNextMemberNumber(organization.id)
    return db.contact.create({
      data: {
        organizationId: organization.id,
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        memberNumber,
      },
      select: { id: true, fullName: true, email: true },
    })
  })()

  // Issue pass via existing action
  const issueResult = await issuePassToContacts(templateId, [contact.id])

  if (!issueResult.success) {
    return { success: false, error: issueResult.error }
  }

  revalidatePath("/dashboard/contacts")

  return { success: true, contactId: contact.id, contactName: contact.fullName }
}

// ─── Bulk Import Contacts & Issue Passes ────────────────────

const bulkImportSchema = z.object({
  templateId: z.string().min(1),
  rows: z
    .array(
      z.object({
        fullName: z.string().min(1).max(100),
        email: z.string().email().max(255).optional().or(z.literal("")),
        phone: z.string().max(30).optional().or(z.literal("")),
      })
    )
    .min(1)
    .max(500),
})

export async function bulkImportAndIssue(
  templateId: string,
  rows: BulkImportRow[]
): Promise<BulkImportResult> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { success: false, results: [], createdCount: 0, issuedCount: 0, skippedCount: 0, errorCount: 0, error: "No organization found" }
  }

  await assertOrganizationRole(organization.id, "owner")

  const parsed = bulkImportSchema.safeParse({ templateId, rows })
  if (!parsed.success) {
    return {
      success: false,
      results: [],
      createdCount: 0,
      issuedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  // Verify template
  const template = await db.passTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: organization.id,
      status: "ACTIVE",
    },
    select: { id: true, name: true, passType: true, config: true },
  })

  if (!template) {
    return {
      success: false,
      results: [],
      createdCount: 0,
      issuedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      error: "Program not found or not active",
    }
  }

  const results: IssueContactResult[] = []
  let createdCount = 0
  let issuedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const row of parsed.data.rows) {
    const fullName = sanitizeText(row.fullName, 100)
    const cleanEmail = row.email ? sanitizeText(row.email, 255) || null : null
    const cleanPhone = row.phone ? sanitizeText(row.phone, 30) || null : null

    if (!fullName) {
      errorCount++
      results.push({
        contactId: "",
        contactName: row.fullName || "Empty name",
        status: "error",
        error: "Name is required",
      })
      continue
    }

    try {
      // Find existing contact by email or phone
      let contact: { id: string; fullName: string; email: string | null } | null = null

      if (cleanEmail) {
        contact = await db.contact.findFirst({
          where: { organizationId: organization.id, email: cleanEmail, deletedAt: null },
          select: { id: true, fullName: true, email: true },
        })
      }

      if (!contact && cleanPhone) {
        contact = await db.contact.findFirst({
          where: { organizationId: organization.id, phone: cleanPhone, deletedAt: null },
          select: { id: true, fullName: true, email: true },
        })
      }

      // Create contact if not found
      if (!contact) {
        const memberNumber = await getNextMemberNumber(organization.id)
        contact = await db.contact.create({
          data: {
            organizationId: organization.id,
            fullName,
            email: cleanEmail,
            phone: cleanPhone,
            memberNumber,
          },
          select: { id: true, fullName: true, email: true },
        })
        createdCount++
      }

      // Check if pass instance already exists
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
        skippedCount++
        results.push({
          contactId: contact.id,
          contactName: contact.fullName,
          status: "already_exists",
        })
        continue
      }

      // Create pass instance (reuse same type-specific logic)
      const walletPassId = randomUUID()
      const templateConfig = (template.config as Record<string, unknown>) ?? {}
      const rewardExpiryDays = (templateConfig.rewardExpiryDays as number) ?? 90

      const instanceDataObj: Record<string, unknown> = {
        currentCycleVisits: 0,
        totalInteractions: 0,
      }

      let expiresAt: Date | null = null

      if (template.passType === "PREPAID") {
        const prepaidConfig = parsePrepaidConfig(template.config)
        if (prepaidConfig) {
          instanceDataObj.remainingUses = prepaidConfig.totalUses
          if (prepaidConfig.validUntil) expiresAt = new Date(prepaidConfig.validUntil)
        }
      }

      if (template.passType === "MEMBERSHIP") {
        const membershipConfig = parseMembershipConfig(template.config)
        if (membershipConfig) expiresAt = computeMembershipExpiresAt(membershipConfig)
      }

      if (template.passType === "GIFT_CARD") {
        const giftCardConfig = parseGiftCardConfig(template.config)
        if (giftCardConfig) {
          instanceDataObj.balanceCents = giftCardConfig.initialBalanceCents
          instanceDataObj.currency = giftCardConfig.currency
          if (giftCardConfig.expiryMonths) {
            const d = new Date()
            d.setMonth(d.getMonth() + giftCardConfig.expiryMonths)
            expiresAt = d
          }
        }
      }

      if (template.passType === "ACCESS") {
        const accessConfig = parseAccessConfig(template.config)
        if (accessConfig) expiresAt = computeDurationExpiresAt(accessConfig.validDuration, accessConfig.customDurationDays)
      }

      if (template.passType === "BUSINESS_ID") {
        const bizConfig = parseBusinessIdConfig(template.config)
        if (bizConfig) expiresAt = computeDurationExpiresAt(bizConfig.validDuration, bizConfig.customDurationDays)
      }

      if (template.passType === "TICKET") instanceDataObj.scanCount = 0
      if (template.passType === "POINTS") instanceDataObj.pointsBalance = 0

      const passInstance = await db.passInstance.create({
        data: {
          contactId: contact.id,
          passTemplateId: template.id,
          walletPassId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: instanceDataObj as any,
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
            organizationId: organization.id,
            passTemplateId: template.id,
            passInstanceId: passInstance.id,
            status: "AVAILABLE",
            expiresAt: couponExpiresAt,
            ...(selectedPrize ? { description: selectedPrize, revealedAt: null } : {}),
          },
        })
      }

      // Send email if contact has email
      if (contact.email) {
        const cardUrl = buildCardUrl(organization.slug, passInstance.id)
  
        const googleWalletUrl = buildWalletDownloadUrl(passInstance.id, "google")
        const passTypeLabel = PASS_TYPE_LABELS[template.passType] ?? "Pass"

        try {
          const applePass = await generateApplePassForEmail(passInstance.id)

          if (process.env.TRIGGER_SECRET_KEY) {
            const { tasks } = await import("@trigger.dev/sdk")
            await tasks.trigger("send-pass-issued-email", {
              email: contact.email,
              contactName: contact.fullName,
              organizationName: organization.name,
              templateName: template.name,
              passTypeLabel,
              cardUrl,
              appleWalletUrl: applePass?.url,
              googleWalletUrl,
            })
          } else {
            const { Resend } = await import("resend")
            const resend = new Resend(process.env.RESEND_API_KEY)
            const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"

            const { error: resendError } = await resend.emails.send({
              from: getEmailFrom(),
              to: contact.email,
              subject: `Your ${passTypeLabel} from ${organization.name}`,
              html: buildPassIssuedEmailHtml({
                contactName: contact.fullName,
                organizationName: organization.name,
                templateName: template.name,
                passTypeLabel,
                cardUrl: `${baseUrl}${cardUrl}`,
                appleWalletUrl: applePass?.url,
                googleWalletUrl: `${baseUrl}${googleWalletUrl}`,
              }),
            })
            if (resendError) {
              console.error("Resend error (bulk import):", resendError.message)
            }
          }
        } catch (err) {
          console.error(
            "Failed to send pass issued email (bulk):",
            err instanceof Error ? err.message : "Unknown error"
          )
        }
      }

      issuedCount++
      results.push({
        contactId: contact.id,
        contactName: contact.fullName,
        status: contact.email ? "issued" : "no_email",
      })
    } catch (err) {
      errorCount++
      results.push({
        contactId: "",
        contactName: fullName,
        status: "error",
        error: err instanceof Error ? err.message : "Unexpected error",
      })
    }
  }

  revalidatePath(`/dashboard/programs/${templateId}`)
  revalidatePath("/dashboard/contacts")
  revalidatePath("/dashboard")

  return { success: true, results, createdCount, issuedCount, skippedCount, errorCount }
}

// ─── Send Pass Email (re-send to existing pass instance) ────

export async function sendPassEmail(
  passInstanceId: string
): Promise<{ success: boolean; error?: string }> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { success: false, error: "No organization found" }
  }

  const passInstance = await db.passInstance.findFirst({
    where: {
      id: passInstanceId,
      passTemplate: { organizationId: organization.id },
    },
    select: {
      id: true,
      contact: {
        select: { id: true, fullName: true, email: true },
      },
      passTemplate: {
        select: {
          name: true,
          passType: true,
          organization: {
            select: { name: true, slug: true },
          },
        },
      },
    },
  })

  if (!passInstance) {
    return { success: false, error: "Pass not found" }
  }

  if (!passInstance.contact.email) {
    return { success: false, error: "Contact has no email address" }
  }

  const cardUrl = buildCardUrl(
    passInstance.passTemplate.organization.slug,
    passInstance.id
  )
  const passTypeLabel = PASS_TYPE_LABELS[passInstance.passTemplate.passType] ?? "Pass"
  const orgName = passInstance.passTemplate.organization.name

  const googleWalletUrl = buildWalletDownloadUrl(passInstance.id, "google")

  try {
    const applePass = await generateApplePassForEmail(passInstance.id)

    if (process.env.TRIGGER_SECRET_KEY) {
      const { tasks } = await import("@trigger.dev/sdk")
      await tasks.trigger("send-pass-issued-email", {
        email: passInstance.contact.email,
        contactName: passInstance.contact.fullName,
        organizationName: orgName,
        templateName: passInstance.passTemplate.name,
        passTypeLabel,
        cardUrl,
        appleWalletUrl: applePass?.url,
        googleWalletUrl,
      })
    } else {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"

      const { error: resendError } = await resend.emails.send({
        from: getEmailFrom(),
        to: passInstance.contact.email,
        subject: `Your ${passTypeLabel} from ${orgName}`,
        html: buildPassIssuedEmailHtml({
          contactName: passInstance.contact.fullName,
          organizationName: orgName,
          templateName: passInstance.passTemplate.name,
          passTypeLabel,
          cardUrl: `${baseUrl}${cardUrl}`,
          appleWalletUrl: applePass?.url,
          googleWalletUrl: `${baseUrl}${googleWalletUrl}`,
        }),
      })

      if (resendError) {
        return { success: false, error: resendError.message }
      }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to send pass email:", message)
    return { success: false, error: message }
  }
}

